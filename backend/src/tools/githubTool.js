// backend/src/tools/githubTool.js
const { runGitHub } = require("../integrations/github");

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  return await runGitHub(step, context, interpolate);
}

module.exports = { runGitHub, run };