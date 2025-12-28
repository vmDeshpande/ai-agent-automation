const mongoose = require("mongoose");

const StepResultSchema = new mongoose.Schema({
  stepId: { type: String },
  type: { type: String },
  tool: { type: String },
  output: { type: mongoose.Schema.Types.Mixed },
  success: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const TaskSchema = new mongoose.Schema({
  workflowId: { type: mongoose.Schema.Types.ObjectId, default: null },
  agentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  name: { type: String, default: "" },
  status: { type: String, enum: ["pending","running","failed","completed"], default: "pending", index: true },

  input: { type: mongoose.Schema.Types.Mixed, default: {} },
  stepResults: { type: [StepResultSchema], default: [] },

  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.models.Task || mongoose.model("Task", TaskSchema);
