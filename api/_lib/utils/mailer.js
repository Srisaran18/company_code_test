function mailConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
    from: process.env.MAIL_FROM || process.env.SMTP_USER || "noreply@localhost",
  };
}

function appLoginUrl() {
  return String(process.env.APP_URL || `http://localhost:${process.env.PORT || 7001}`).replace(/\/$/, "");
}

async function sendMail({ to, subject, text, html }) {
  const config = mailConfig();
  if (!config) return { sent: false, reason: "not_configured" };
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  await transporter.sendMail({ from: config.from, to, subject, text, html });
  return { sent: true };
}

async function sendAdminWelcome({ company, admin, password }) {
  const loginUrl = appLoginUrl();
  const subject = `Your ${company.name} admin account`;
  const text = [
    `Hello ${admin.name || "Admin"},`,
    "",
    `A company account has been created for ${company.name} (${company.code}).`,
    "",
    `Sign in: ${loginUrl}/login`,
    `Email: ${admin.email}`,
    `Password: ${password}`,
    "",
    "Change this password after you sign in.",
  ].join("\n");
  const html = `<p>Hello ${admin.name || "Admin"},</p>
<p>A company account has been created for <strong>${company.name}</strong> (${company.code}).</p>
<p>Sign in at <a href="${loginUrl}/login">${loginUrl}/login</a></p>
<p>Email: ${admin.email}<br/>Password: ${password}</p>
<p>Change this password after you sign in.</p>`;
  try {
    return await sendMail({ to: admin.email, subject, text, html });
  } catch (error) {
    console.error("Admin welcome email failed:", error.message);
    return { sent: false, reason: "send_failed" };
  }
}

module.exports = { mailConfig, sendMail, sendAdminWelcome, appLoginUrl };
