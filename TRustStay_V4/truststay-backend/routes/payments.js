import express from "express";
import { stkPush } from "../services/daraja.js";

const router = express.Router();

router.post("/pay", async (req, res) => {
  try {
    const { phone, amount } = req.body;

    const response = await stkPush(phone, amount);

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;