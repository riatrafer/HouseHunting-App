import nodemailer from "nodemailer";

let transporter = null;
let transporterKey = "";

const getMode = () => (process.env.EMAIL_MODE ?? "auto").toString().trim().toLowerCase();

const readSmtpConfig = () => {
  const host = (process.env.SMTP_HOST ?? "").toString().trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = (process.env.SMTP_USER ?? "").toString().trim();
  const pass = (process.env.SMTP_PASS ?? "").toString();
  const from = (process.env.EMAIL_FROM ?? user).toString().trim();
  return { host, port, user, pass, from };
};

const shouldUseSmtp = (cfg) => {
  const mode = getMode();
  if (mode === "mock") return false;
  if (mode === "smtp") return true;
  return Boolean(cfg.host && cfg.port && cfg.user && cfg.pass);
};

const getTransporter = (cfg) => {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    transporterKey = key;
  }
  return transporter;
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const recipient = (to ?? "").toString().trim();
  if (!recipient) throw new Error("Email recipient is required");

  const cfg = readSmtpConfig();
  const mode = getMode();

  if (!shouldUseSmtp(cfg)) {
    // Development fallback when SMTP credentials are not configured.
    console.log("EMAIL DELIVERY (mock)", {
      mode,
      to: recipient,
      subject: subject ?? "",
      text: text ?? "",
      html: html ?? "",
    });
    return { ok: true, mode: "mock" };
  }

  if (!cfg.from) throw new Error("EMAIL_FROM or SMTP_USER must be configured for SMTP mode");

  try {
    const mailer = getTransporter(cfg);
    const info = await mailer.sendMail({
      from: cfg.from,
      to: recipient,
      subject: subject ?? "",
      text: text ?? "",
      html: html ?? "",
    });
    return { ok: true, mode: "smtp", messageId: info.messageId };
  } catch (error) {
    const reason = error?.message ?? "Unknown email delivery error";
    throw new Error(`Email delivery failed: ${reason}`);
  }
};
