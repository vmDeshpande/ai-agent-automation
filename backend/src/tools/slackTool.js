// backend/src/tools/slackTool.js
const { runSlack } = require("../integrations/slack");

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  return await runSlack(step, context, interpolate);
}

module.exports = { runSlack, run };