import express from "express";
import { sendSMS } from "../services/sms.js";

const router = express.Router();

router.post("/book", async (req, res) => {
  const { message, date, time } = req.body;

  // simulate sending SMS
  await sendSMS("+254700000000", `New booking: ${date} ${time} - ${message}`);

  res.json({ message: "SMS sent" });
});

export default router;