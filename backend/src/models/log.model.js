const mongoose = require("mongoose");

const LogSchema = new mongoose.Schema({
  message: { type: String, required: true },
  level: { type: String, enum: ["debug", "info", "success", "warn", "error"], default: "info", index: true, },
  workerId: { type: String, default: "agent-1", index: true, },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: "Workflow" },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
}, { timestamps: true });

module.exports = mongoose.models.Log || mongoose.model("Log", LogSchema);
