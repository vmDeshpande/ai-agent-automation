// backend/src/tools/discordTool.js
const { runDiscord } = require("../integrations/discord");

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  return await runDiscord(step, context, interpolate);
}

module.exports = {
  meta: {
    id: "discord",
    name: "Discord",
    version: "1.0.0",
    category: "Communication",
    description: "Send messages to a Discord webhook.",
    fields: [
      { name: "action", label: "Action", type: "select", options: ["send_message"], default: "send_message", required: true },
      { name: "content", label: "Message Content", type: "textarea", required: true }
    ]
  },
  runDiscord, run
};