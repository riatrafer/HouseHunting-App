import express from "express";
import { db } from "../config/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/me", requireAuth(["tenant"]), async (req, res) => {
  res.json({ auth: req.auth });
});

router.post("/tickets", requireAuth(["tenant"]), async (req, res) => {
  try {
    const payload = req.body ?? {};
    const type = (payload.type ?? "").toString().trim().toLowerCase();
    if (!["complain", "feedback", "request"].includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    const landlordId = req.auth.landlordId;
    if (!landlordId) return res.status(400).json({ message: "Tenant session missing landlordId" });

    const ticket = {
      type,
      landlordId,
      propertyId: payload.propertyId ? String(payload.propertyId) : req.auth.propertyId ?? null,
      contactNumber: (payload.contactNumber ?? "").toString().trim(),
      houseName: (payload.houseName ?? "").toString().trim(),
      roomNumber: (payload.roomNumber ?? "").toString().trim(),
      details: (payload.details ?? "").toString().trim(),
      tenantPhone: (payload.tenantPhone ?? "").toString().trim() || null,
      tenantId: req.auth.userId,
      createdAt: new Date(),
      status: "new",
    };

    if (!ticket.contactNumber || !ticket.houseName || !ticket.roomNumber || !ticket.details) {
      return res.status(400).json({ message: "contactNumber, houseName, roomNumber, and details are required" });
    }

    const ref = await db.collection("tickets").add(ticket);
    const created = await ref.get();
    res.json({ ticket: { ...created.data(), id: created.id } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/rate/:propertyId", requireAuth(["tenant"]), async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const ref = db.collection("properties").doc(propertyId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: "Property not found" });

    const existing = snap.data();
    const rating = req.body?.rating;
    if (!rating) return res.status(400).json({ message: "rating is required" });

    const ratings = Array.isArray(existing.ratings) ? existing.ratings : [];
    ratings.push({ ...rating, createdAt: new Date(), tenantId: req.auth.userId });

    const sum = ratings.reduce((acc, r) => acc + (Number(r.overall) || 0), 0);
    const avg = ratings.length ? Number((sum / ratings.length).toFixed(1)) : 0;

    await ref.update({
      ratings,
      averageStars: avg,
      pastTenantComment: rating.comment
        ? { text: rating.comment, author: rating.author ? `${rating.author}, former tenant` : "Former tenant" }
        : existing.pastTenantComment ?? { text: "", author: "" },
      updatedAt: new Date(),
    });

    const updated = await ref.get();
    res.json({ property: { ...updated.data(), id: updated.id } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;