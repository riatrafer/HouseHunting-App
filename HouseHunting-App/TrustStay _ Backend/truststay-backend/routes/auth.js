import express from "express";
import crypto from "crypto";
import { db } from "../config/firebase.js";
import { sendEmail } from "../services/email.js";

const router = express.Router();

const normalizeEmail = (email) => (email ?? "").toString().trim().toLowerCase();

const OTP_TTL_MS = 5 * 60 * 1000;
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

router.post("/landlord/request-otp", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = (req.body.password ?? "").toString();
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const snap = await db.collection("landlords").where("email", "==", email).limit(1).get();
    if (snap.empty) return res.status(401).json({ message: "Invalid credentials" });

    const doc = snap.docs[0];
    const landlord = doc.data();
    if ((landlord.password ?? "") !== password) return res.status(401).json({ message: "Invalid credentials" });

    const requestId = crypto.randomUUID();
    const otp = generateOtp();
    await db.collection("otpRequests").doc(requestId).set({
      purpose: "landlord_login",
      email,
      landlordId: doc.id,
      otp,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      createdAt: new Date(),
      verifiedAt: null,
    });

    await sendEmail({
      to: email,
      subject: "TrustStay landlord login OTP",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;border:1px solid #ddd;padding:16px;border-radius:8px;max-width:460px"><h3 style="margin-top:0">TrustStay Login OTP</h3><p>Your one-time password is:</p><p style="font-size:28px;font-weight:700;letter-spacing:2px">${otp}</p><p>This code expires in 5 minutes.</p></div>`,
    });

    res.json({ requestId, message: "OTP sent to your email." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/landlord/verify-otp", async (req, res) => {
  try {
    const requestId = (req.body?.requestId ?? "").toString().trim();
    const otp = (req.body?.otp ?? "").toString().trim();
    if (!requestId || !otp) return res.status(400).json({ message: "requestId and otp are required" });

    const ref = db.collection("otpRequests").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(401).json({ message: "Invalid OTP request" });

    const data = snap.data();
    if (data.purpose !== "landlord_login") return res.status(401).json({ message: "Invalid OTP request" });
    if (data.verifiedAt) return res.status(401).json({ message: "OTP already used" });
    if (data.expiresAt?.toDate ? data.expiresAt.toDate() < new Date() : data.expiresAt < new Date()) {
      return res.status(401).json({ message: "OTP expired" });
    }
    if ((data.otp ?? "") !== otp) return res.status(401).json({ message: "Invalid OTP" });

    await ref.update({ verifiedAt: new Date() });

    const landlordDoc = await db.collection("landlords").doc(data.landlordId).get();
    if (!landlordDoc.exists) return res.status(401).json({ message: "Invalid landlord" });
    const landlord = landlordDoc.data();

    const token = crypto.randomUUID();
    await db.collection("sessions").doc(token).set({ role: "landlord", userId: landlordDoc.id, createdAt: new Date() });

    res.json({
      token,
      role: "landlord",
      landlord: { id: landlordDoc.id, name: landlord.name, email: landlord.email, verified: !!landlord.verified },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tenant/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = (req.body.code ?? "").toString().trim().toUpperCase();
    if (!email || !code) return res.status(400).json({ message: "Email and code are required" });

    let codeData = null;
    const codeSnap = await db.collection("tenantCodes").doc(code).get();
    if (codeSnap.exists) {
      codeData = codeSnap.data();
    } else {
      const codeByField = await db.collection("tenantCodes").where("code", "==", code).limit(1).get();
      if (!codeByField.empty) codeData = codeByField.docs[0].data();
    }
    if (!codeData) return res.status(401).json({ message: "Invalid login code" });
    if (!codeData?.active) return res.status(401).json({ message: "Login code is inactive" });
    if (normalizeEmail(codeData.tenantEmail) !== email) return res.status(401).json({ message: "Invalid login code" });

    const token = crypto.randomUUID();
    await db.collection("sessions").doc(token).set({
      role: "tenant",
      userId: codeData.tenantId ?? `${email}:${code}`,
      createdAt: new Date(),
      propertyId: codeData.propertyId ?? null,
      landlordId: codeData.landlordId ?? null,
    });

    res.json({
      token,
      role: "tenant",
      tenant: { email, propertyId: codeData.propertyId ?? null, landlordId: codeData.landlordId ?? null },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const auth = (req.headers.authorization ?? "").toString();
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
    if (!token) return res.json({ ok: true });
    await db.collection("sessions").doc(token).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;