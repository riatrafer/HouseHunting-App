import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "truststay-backend",
    version: "v4-otp-notifications-uploads",
    time: new Date().toISOString(),
  });
});

export default router;

