// backend/src/tools/slackTool.js
const { runSlack } = require("../integrations/slack");

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  return await runSlack(step, context, interpolate);
}

module.exports = {
  meta: {
    id: "slack",
    name: "Slack",
    version: "1.0.0",
    category: "Communication",
    description: "Send messages to Slack.",
    fields: [
      { name: "action", label: "Action", type: "select", options: ["send_message"], default: "send_message", required: true },
      { name: "text", label: "Message Text", type: "textarea", required: true }
    ]
  },
  runSlack, run
};