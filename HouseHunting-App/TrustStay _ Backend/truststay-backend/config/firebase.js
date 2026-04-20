import admin from "firebase-admin";
import fs from "fs";

const tryReadJson = (relativeName) => {
  const url = new URL(relativeName, import.meta.url);
  return JSON.parse(fs.readFileSync(url, "utf-8"));
};

let serviceAccount;
try {
  serviceAccount = tryReadJson("./serviceAccountKey.json");
} catch {
  serviceAccount = tryReadJson("./ServiceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const db = admin.firestore();