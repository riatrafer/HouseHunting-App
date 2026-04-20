import { db } from "../config/firebase.js";

function parseBearerToken(headerValue) {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  return token || null;
}

export function requireAuth(allowedRoles = null) {
  return async (req, res, next) => {
    try {
      const token = parseBearerToken(req.headers.authorization);
      if (!token) return res.status(401).json({ message: "Missing auth token" });

      const sessionSnap = await db.collection("sessions").doc(token).get();
      if (!sessionSnap.exists) return res.status(401).json({ message: "Invalid auth token" });

      const session = sessionSnap.data();
      if (allowedRoles && !allowedRoles.includes(session.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      req.auth = {
        token,
        role: session.role,
        userId: session.userId,
        landlordId: session.landlordId ?? null,
        propertyId: session.propertyId ?? null,
      };

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

