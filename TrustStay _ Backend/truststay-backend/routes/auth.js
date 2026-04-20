import express from "express";
import crypto from "crypto";
import { db } from "../config/firebase.js";

const router = express.Router();

const normalizePhone = (phone) => (phone ?? "").toString().trim();

const OTP_TTL_MS = 5 * 60 * 1000;
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

router.post("/landlord/request-otp", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const password = (req.body.password ?? "").toString();
    if (!phone || !password) return res.status(400).json({ message: "Phone and password are required" });

    const snap = await db.collection("landlords").where("phone", "==", phone).limit(1).get();
    if (snap.empty) return res.status(401).json({ message: "Invalid credentials" });

    const doc = snap.docs[0];
    const landlord = doc.data();
    if ((landlord.password ?? "") !== password) return res.status(401).json({ message: "Invalid credentials" });

    const requestId = crypto.randomUUID();
    const otp = generateOtp();
    await db.collection("otpRequests").doc(requestId).set({
      purpose: "landlord_login",
      phone,
      landlordId: doc.id,
      otp,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      createdAt: new Date(),
      verifiedAt: null,
    });

    res.json({ requestId, simulated: true, simulatedOtp: otp, message: "OTP sent (simulated)." });
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
      landlord: { id: landlordDoc.id, name: landlord.name, phone: landlord.phone, verified: !!landlord.verified },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tenant/login", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = (req.body.code ?? "").toString().trim().toUpperCase();
    if (!phone || !code) return res.status(400).json({ message: "Phone and code are required" });

    const codeSnap = await db.collection("tenantCodes").doc(code).get();
    if (!codeSnap.exists) return res.status(401).json({ message: "Invalid login code" });
    const codeData = codeSnap.data();
    if (!codeData?.active) return res.status(401).json({ message: "Login code is inactive" });
    if (normalizePhone(codeData.tenantPhone) !== phone) return res.status(401).json({ message: "Invalid login code" });

    const token = crypto.randomUUID();
    await db.collection("sessions").doc(token).set({
      role: "tenant",
      userId: codeData.tenantId ?? `${phone}:${code}`,
      createdAt: new Date(),
      propertyId: codeData.propertyId ?? null,
      landlordId: codeData.landlordId ?? null,
    });

    res.json({
      token,
      role: "tenant",
      tenant: { phone, propertyId: codeData.propertyId ?? null, landlordId: codeData.landlordId ?? null },
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