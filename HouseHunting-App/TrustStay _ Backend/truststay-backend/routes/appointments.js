import express from "express";
import { sendEmail } from "../services/email.js";

const router = express.Router();

router.post("/book", async (req, res) => {
  const { message, date, time, guestEmail } = req.body ?? {};
  const email = (guestEmail ?? "").toString().trim();
  if (!email) return res.status(400).json({ message: "guestEmail is required" });

  await sendEmail({
    to: email,
    subject: "TrustStay appointment request received",
    text: `Appointment request: ${date} ${time}\nMessage: ${message ?? ""}`,
    html: `<p>Appointment request received.</p><p><strong>Date:</strong> ${date}</p><p><strong>Time:</strong> ${time}</p><p><strong>Message:</strong> ${(message ?? "").toString()}</p>`,
  });

  res.json({ message: "Appointment email sent" });
});

export default router;