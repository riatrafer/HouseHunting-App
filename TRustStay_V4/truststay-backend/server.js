import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import landlordRoutes from "./routes/landlord.js";
import paymentRoutes from "./routes/payments.js";
import appointmentRoutes from "./routes/appointments.js";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/landlord", landlordRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/appointments", appointmentRoutes);


app.listen(3000, () => {
  console.log("Server running on port 3000");
});