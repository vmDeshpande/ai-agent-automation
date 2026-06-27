// backend/src/tools/emailTool.js
const nodemailer = require("nodemailer");

// Support both EMAIL_ prefix (documented in .env.example) and MAIL_ prefix (legacy)
const MAIL_FROM = process.env.EMAIL_FROM || process.env.MAIL_FROM || "no-reply@example.com";

function getTransport() {
      const host = process.env.EMAIL_HOST || process.env.MAIL_HOST;
      const port = parseInt(process.env.EMAIL_PORT || process.env.MAIL_PORT || "587", 10);
      const user = process.env.EMAIL_USER || process.env.MAIL_USER;
      const pass = process.env.EMAIL_PASS || process.env.MAIL_PASS;

    if (!host || !user || !pass) {
              throw new Error("Mail config missing (EMAIL_HOST/EMAIL_USER/EMAIL_PASS or MAIL_HOST/MAIL_USER/MAIL_PASS)");
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
                to: interpolate(step.to || "", context),
                subject: interpolate(step.subject || "", context),
                text: interpolate(step.text || "", context),
                html: step.html ? interpolate(step.html, context) : undefined
      };
      return await sendMail(payloadOptions);
}

module.exports = {
      meta: {
                id: "email",
                name: "Email",
                version: "1.0.0",
                category: "Communication",
                description: "Send emails via SMTP.",
                fields: [
                  { name: "to", label: "To", type: "text", required: true },
                  { name: "subject", label: "Subject", type: "text", required: true },
                  { name: "text", label: "Plain Text Body", type: "textarea" },
                  { name: "html", label: "HTML Body", type: "textarea" }
                          ]
      },
      sendMail, run
};
