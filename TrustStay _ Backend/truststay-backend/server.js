import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import landlordRoutes from "./routes/landlord.js";
import tenantRoutes from "./routes/tenant.js";
import paymentRoutes from "./routes/payments.js";
import appointmentRoutes from "./routes/appointments.js";
import providerRoutes from "./routes/providers.js";
import propertyRoutes from "./routes/properties.js";
import healthRoutes from "./routes/health.js";
import uploadRoutes from "./routes/uploads.js";
import path from "path";
import { fileURLToPath } from "url";


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/landlord", landlordRoutes);
app.use("/api/tenant", tenantRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/uploads", uploadRoutes);


app.listen(3000, () => {
  console.log("Server running on port 3000");
});