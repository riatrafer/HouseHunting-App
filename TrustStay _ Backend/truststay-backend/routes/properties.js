import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../config/firebase.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedFromLocalJsonIfEmpty() {
  const existingSnap = await db.collection("properties").limit(1).get();
  if (!existingSnap.empty) return;

  const dataPath = path.resolve(__dirname, "../../data/houses.json");
  if (!fs.existsSync(dataPath)) return;

  const parsed = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const houses = Array.isArray(parsed?.houses) ? parsed.houses : [];
  if (!houses.length) return;

  const batch = db.batch();
  houses.forEach((house) => {
    const ref = db.collection("properties").doc(String(house.id));
    const occupancyStatus = house.occupancyStatus || (house.isRented ? "occupied" : "vacant");
    batch.set(
      ref,
      {
        ...house,
        occupancyStatus,
        isRented: occupancyStatus === "occupied",
        landlordId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );
  });
  await batch.commit();
}

router.get("/public", async (req, res) => {
  try {
    await seedFromLocalJsonIfEmpty();
    const snap = await db.collection("properties").get();
    const properties = snap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((p) => !p.isRented && p.occupancyStatus !== "occupied");
    res.json({ properties });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const snap = await db.collection("properties").doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ message: "Property not found" });
    res.json({ property: { ...snap.data(), id: snap.id } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/ratings", async (req, res) => {
  try {
    const propertyId = req.params.id;
    const tenantCode = (req.body?.tenantCode ?? "").toString().trim().toUpperCase();
    const rating = req.body?.rating;
    if (!tenantCode) return res.status(400).json({ message: "tenantCode is required" });
    if (!rating) return res.status(400).json({ message: "rating is required" });

    const codeSnap = await db.collection("tenantCodes").doc(tenantCode).get();
    if (!codeSnap.exists) return res.status(401).json({ message: "Invalid tenant code" });
    const codeData = codeSnap.data();
    if (!codeData?.active) return res.status(401).json({ message: "Tenant code is inactive" });
    if (codeData.propertyId && String(codeData.propertyId) !== String(propertyId)) {
      return res.status(403).json({ message: "Tenant code not valid for this property" });
    }

    const ref = db.collection("properties").doc(propertyId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: "Property not found" });

    const existing = snap.data();
    const ratings = Array.isArray(existing.ratings) ? existing.ratings : [];
    ratings.push({ ...rating, createdAt: new Date(), tenantCode });

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

