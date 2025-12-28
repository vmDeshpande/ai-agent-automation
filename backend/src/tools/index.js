// backend/src/tools/index.js
const emailTool = require("./emailTool");
const fileTool = require("./fileTool");
const browserTool = require("./browserTool"); // EXPERIMENTAL

module.exports = {
  emailTool,
  fileTool,
  browserTool
};
