const mongoose = require("mongoose");

const LogSchema = new mongoose.Schema({
  message: { type: String, required: true },
  level: { type: String, enum: ["info", "warn", "error"], default: "info" },
  workerId: { type: String, default: "agent-1" },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Log || mongoose.model("Log", LogSchema);
