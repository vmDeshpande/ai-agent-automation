const Log = require("../models/log.model");

// log levels priority
const LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  success: 2,
  warn: 3,
  error: 4,
};

// ⬇️ store success+ by default
const DB_LOG_LEVEL = process.env.DB_LOG_LEVEL || "success";

// throttle cache (in-memory)
const throttleMap = new Map();
const THROTTLE_MS = 60_000; // 1 minute per message

function shouldPersist(level) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[DB_LOG_LEVEL];
}

function isThrottled(message) {
  const now = Date.now();
  const last = throttleMap.get(message);

  if (last && now - last < THROTTLE_MS) {
    return true;
  }

  throttleMap.set(message, now);
  return false;
}

async function writeLog(
  message,
  level = "info",
  meta = {}
) {
  try {
    await Log.create({
      message,
      level,
      workerId: meta.workerId || "agent-1",
      taskId: meta.taskId,
      workflowId: meta.workflowId,
    });
  } catch (err) {
    console.error("Failed to write log:", err.message);
  }
}

module.exports = { writeLog };
