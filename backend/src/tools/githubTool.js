// backend/src/tools/githubTool.js
const { runGitHub } = require("../integrations/github");

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  return await runGitHub(step, context, interpolate);
}

module.exports = {
  meta: {
    id: "github",
    name: "GitHub",
    version: "1.0.0",
    category: "Integration",
    description: "Interact with GitHub repositories and issues.",
    fields: [
      { name: "action", label: "Action", type: "select", options: ["create_issue", "add_comment", "get_issue"], required: true },
      { name: "owner", label: "Owner", type: "text", required: true },
      { name: "repo", label: "Repository", type: "text", required: true },
      { name: "title", label: "Issue Title (for create_issue)", type: "text" },
      { name: "body", label: "Issue Body (for create_issue)", type: "textarea" },
      { name: "issue_number", label: "Issue Number", type: "number" },
      { name: "comment", label: "Comment Body (for add_comment)", type: "textarea" }
    ]
  },
  runGitHub, run
};