// backend/src/tools/index.js
const emailTool = require("./emailTool");
const fileTool = require("./fileTool");
const browserTool = require("./browserTool");
const hackerNewsTool = require("./hackerNewsTool");
const githubTool = require("./githubTool");
const slackTool = require("./slackTool");
const discordTool = require("./discordTool");
const test_tool = require("./test_tool");

module.exports = {
  emailTool,
  fileTool,
  browserTool,
  hackerNewsTool,
  githubTool,
  slackTool,
  discordTool,
  test_tool,
};