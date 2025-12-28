const Log = require("../models/log.model");

async function writeLog(message, level = "info", workerId = "agent-1") {
  try {
    await Log.create({ message, level, workerId });
  } catch (err) {
    console.error("Failed to write log:", err);
  }
}

module.exports = { writeLog };
