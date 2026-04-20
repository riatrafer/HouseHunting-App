import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

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

router.post("/add-property", async (req, res) => {
  const { name, units } = req.body;

  await db.collection("properties").add({
    name,
    units,
    createdAt: new Date(),
  });

  res.json({ message: "Property added" });
});

export default router;