import express from "express";
import { db } from "../config/firebase.js";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

router.post("/register/request-otp", async (req, res) => {
  try {
    const { name, phone, idNumber, lrNumber, ocNumber, password } = req.body ?? {};

    if (!name || !phone || !idNumber || !lrNumber || !password) {
      return res.status(400).json({ message: "Missing required registration fields" });
    }

    // Simulate Safaricom + Government verification
    if (!lrNumber || !ocNumber) {
      return res.status(400).json({ message: "Invalid property credentials" });
    }

    const requestId = crypto.randomUUID();
    const otp = generateOtp();

    await db.collection("otpRequests").doc(requestId).set({
      purpose: "landlord_register",
      phone: String(phone).trim(),
      otp,
      registration: {
        name: String(name).trim(),
        phone: String(phone).trim(),
        idNumber: String(idNumber).trim(),
        lrNumber: String(lrNumber).trim(),
        ocNumber: String(ocNumber).trim(),
        password: String(password),
      },
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      createdAt: new Date(),
      verifiedAt: null,
    });

    res.json({ requestId, simulated: true, simulatedOtp: otp, message: "OTP sent (simulated)." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/register/verify-otp", async (req, res) => {
  try {
    const requestId = (req.body?.requestId ?? "").toString().trim();
    const otp = (req.body?.otp ?? "").toString().trim();
    if (!requestId || !otp) return res.status(400).json({ message: "requestId and otp are required" });

    const ref = db.collection("otpRequests").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(401).json({ message: "Invalid OTP request" });

    const data = snap.data();
    if (data.purpose !== "landlord_register") return res.status(401).json({ message: "Invalid OTP request" });
    if (data.verifiedAt) return res.status(401).json({ message: "OTP already used" });
    if (data.expiresAt?.toDate ? data.expiresAt.toDate() < new Date() : data.expiresAt < new Date()) {
      return res.status(401).json({ message: "OTP expired" });
    }
    if ((data.otp ?? "") !== otp) return res.status(401).json({ message: "Invalid OTP" });

    await ref.update({ verifiedAt: new Date() });

    const registration = data.registration;
    if (!registration?.phone) return res.status(400).json({ message: "Invalid registration payload" });

    const existing = await db.collection("landlords").where("phone", "==", registration.phone).limit(1).get();
    if (!existing.empty) return res.status(409).json({ message: "Landlord with this phone already exists" });

    const landlord = {
      ...registration,
      verified: true,
      createdAt: new Date(),
    };

    const landlordRef = await db.collection("landlords").add(landlord);
    res.json({ message: "Landlord registered successfully", landlordId: landlordRef.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backwards compatibility: direct register (no OTP)
router.post("/register", async (req, res) => {
  try {
    const { name, phone, idNumber, lrNumber, ocNumber, password } = req.body;

    // Simulate Safaricom + Government verification
    if (!lrNumber || !ocNumber) {
      return res.status(400).json({ message: "Invalid property credentials" });
    }

    const landlord = {
      name,
      phone,
      idNumber,
      lrNumber,
      ocNumber,
      password,
      verified: true,
      createdAt: new Date(),
    };

    await db.collection("landlords").add(landlord);

    res.json({ message: "Landlord registered successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/properties", requireAuth(["landlord"]), async (req, res) => {
  try {
    const landlordId = req.auth.userId;
    const snap = await db.collection("properties").where("landlordId", "==", landlordId).get();
    const properties = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    res.json({ properties });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/properties", requireAuth(["landlord"]), async (req, res) => {
  try {
    const landlordId = req.auth.userId;
    const payload = req.body ?? {};
    const name = (payload.name ?? "").toString().trim();
    const units = Number(payload.units ?? 0);
    if (!name) return res.status(400).json({ message: "Property name is required" });

    const property = {
      name,
      units: Number.isFinite(units) ? units : 0,
      unitCategory: (payload.unitCategory ?? "").toString().trim() || "Unknown",
      ocNumber: (payload.ocNumber ?? "").toString().trim() || null,
      ncaProjectId: (payload.ncaProjectId ?? "").toString().trim() || null,
      location: (payload.location ?? "").toString().trim() || "New Listings",
      fullAddress: (payload.fullAddress ?? "").toString().trim() || null,
      purpose: (payload.purpose ?? "").toString().trim() || "Rent (pay monthly)",
      priceText: (payload.priceText ?? "").toString().trim() || "Price on request",
      photos: Array.isArray(payload.photos) ? payload.photos.slice(0, 6) : [],
      photo: (payload.photo ?? "").toString().trim() || null,
      occupancyStatus: payload.occupancyStatus === "occupied" ? "occupied" : "vacant",
      isRented: payload.occupancyStatus === "occupied",
      fakeViews: Number(payload.fakeViews ?? 0) || 0,
      fakeMessages: Number(payload.fakeMessages ?? 0) || 0,
      ratings: Array.isArray(payload.ratings) ? payload.ratings : [],
      ratingBreakdown: Array.isArray(payload.ratingBreakdown) ? payload.ratingBreakdown : [],
      averageStars: Number(payload.averageStars ?? 0) || 0,
      pastTenantComment: payload.pastTenantComment ?? { text: "", author: "" },
      landlord: payload.landlord ?? null,
      landlordId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!property.photo) {
      property.photo =
        property.photos?.[0] || "https://via.placeholder.com/400x300?text=New+Property";
    }

    const ref = await db.collection("properties").add(property);
    const created = await ref.get();
    res.json({ property: { ...created.data(), id: created.id } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/properties/:id/toggle", requireAuth(["landlord"]), async (req, res) => {
  try {
    const landlordId = req.auth.userId;
    const id = req.params.id;
    const ref = db.collection("properties").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: "Property not found" });
    const existing = snap.data();
    if (existing.landlordId !== landlordId) return res.status(403).json({ message: "Forbidden" });

    const nextStatus = existing.occupancyStatus === "occupied" ? "vacant" : "occupied";
    await ref.update({
      occupancyStatus: nextStatus,
      isRented: nextStatus === "occupied",
      updatedAt: new Date(),
    });
    const updated = await ref.get();
    res.json({ property: { ...updated.data(), id: updated.id } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/properties/:id", requireAuth(["landlord"]), async (req, res) => {
  try {
    const landlordId = req.auth.userId;
    const id = req.params.id;
    const ref = db.collection("properties").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: "Property not found" });
    const existing = snap.data();
    if (existing.landlordId !== landlordId) return res.status(403).json({ message: "Forbidden" });

    await ref.delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tenant-codes", requireAuth(["landlord"]), async (req, res) => {
  try {
    const landlordId = req.auth.userId;
    const tenantPhone = (req.body?.tenantPhone ?? "").toString().trim();
    const propertyId = (req.body?.propertyId ?? "").toString().trim() || null;
    if (!tenantPhone) return res.status(400).json({ message: "tenantPhone is required" });

    let code = "";
    for (let i = 0; i < 10; i++) {
      code = crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
      const exists = await db.collection("tenantCodes").doc(code).get();
      if (!exists.exists) break;
    }
    if (!code) return res.status(500).json({ message: "Unable to generate unique code" });

    await db.collection("tenantCodes").doc(code).set({
      code,
      tenantPhone,
      landlordId,
      propertyId,
      active: true,
      createdAt: new Date(),
    });

    res.json({ code, tenantPhone, propertyId, mode: "phone_bound" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/notifications", requireAuth(["landlord"]), async (req, res) => {
  try {
    const landlordId = req.auth.userId;
    const label = (req.query?.label ?? "").toString().trim().toLowerCase();

    // Avoid requiring Firestore composite indexes by only querying by landlordId,
    // then applying label filtering + sorting in-memory.
    const snap = await db.collection("tickets").where("landlordId", "==", landlordId).limit(200).get();
    let notifications = snap.docs.map((d) => ({ ...d.data(), id: d.id }));

    if (label && ["complain", "feedback", "request"].includes(label)) {
      notifications = notifications.filter((n) => (n.type ?? "").toString().toLowerCase() === label);
    }

    notifications.sort((a, b) => {
      const ta = a.createdAt?._seconds ? a.createdAt._seconds * 1000 : new Date(a.createdAt || 0).getTime();
      const tb = b.createdAt?._seconds ? b.createdAt._seconds * 1000 : new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });

    notifications = notifications.slice(0, 100);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;