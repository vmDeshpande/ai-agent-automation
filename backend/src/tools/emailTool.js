// backend/src/tools/emailTool.js
const nodemailer = require("nodemailer");

const MAIL_FROM = process.env.MAIL_FROM || "no-reply@example.com";

function getTransport() {
  const host = process.env.MAIL_HOST;
  const port = parseInt(process.env.MAIL_PORT || "587", 10);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  if (!host || !user || !pass) {
    throw new Error("Mail config missing (MAIL_HOST/MAIL_USER/MAIL_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

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

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  const payloadOptions = {
    to: step.to || "",
    subject: step.subject || "",
    text: step.text || "",
    html: step.html || ""
  };
  return await sendMail(payloadOptions);
}

module.exports = { sendMail, run };