// backend/src/tools/emailTool.js
// uses nodemailer (already present in your package.json). Config from env.
const nodemailer = require("nodemailer");

const MAIL_FROM = process.env.MAIL_FROM || "no-reply@example.com";

// createTransport is called lazily so worker can start even if creds missing
function getTransport() {
  // recommended: set MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS in .env
  const host = process.env.MAIL_HOST;
  const port = parseInt(process.env.MAIL_PORT || "587", 10);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  if (!host || !user || !pass) {
    // return a "no-op" transport that throws when used, so errors surface cleanly
    throw new Error("Mail config missing (MAIL_HOST/MAIL_USER/MAIL_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: { user, pass }
  });
}

/**
 * sendMail(options)
 * options: { to, subject, text, html, attachments }
 * attachments: [{ filename, content (string/base64), path }]
 */
async function sendMail(options = {}) {
  const { to, subject = "(no-subject)", text = "", html, attachments } = options;

  if (!to) throw new Error("email 'to' required");

  const transporter = getTransport();

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    text,
    html,
    attachments
  });

  return {
    messageId: info.messageId,
    envelope: info.envelope,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response
  };
}

module.exports = { sendMail };
