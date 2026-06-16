// backend/src/tools/discordTool.js
const { runDiscord } = require("../integrations/discord");

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  return await runDiscord(step, context, interpolate);
}

module.exports = { runDiscord, run };