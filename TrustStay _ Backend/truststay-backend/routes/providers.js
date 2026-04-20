import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const payload = req.body ?? {};
    const name = (payload.name ?? "").toString().trim();
    const phone = (payload.phone ?? "").toString().trim();
    const serviceType = (payload.serviceType ?? "").toString().trim();
    if (!name || !phone || !serviceType) {
      return res.status(400).json({ message: "name, phone, and serviceType are required" });
    }

    const provider = {
      name,
      phone,
      serviceType,
      paymentMethod: (payload.paymentMethod ?? "").toString().trim() || null,
      url: (payload.url ?? "").toString().trim() || null,
      houseId: (payload.houseId ?? "").toString().trim() || null,
      landlordId: (payload.landlordId ?? "").toString().trim() || null,
      status: "pending_payment",
      createdAt: new Date(),
    };

    const ref = await db.collection("providers").add(provider);
    const created = await ref.get();
    res.json({ provider: { id: created.id, ...created.data() } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


export default router;

