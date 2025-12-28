// src/models/schedule.model.js
const mongoose = require("mongoose");

const ScheduleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

  // The workflow to run
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: "Workflow", required: true },

  // Cron expression (e.g. "0 8 * * *" daily at 8:00)
  cron: { type: String, required: true },

  // Optional timezone, e.g. "Asia/Kolkata"
  timezone: { type: String, default: "UTC" },

  // If you want to pass extra metadata into created Task
  taskInput: { type: mongoose.Schema.Types.Mixed, default: {} },
  taskMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // enabled/disabled
  enabled: { type: Boolean, default: true },

  // bookkeeping
  lastRunAt: { type: Date, default: null },
  nextRunAt: { type: Date, default: null }, // optional: left for future calculation
}, { timestamps: true });

module.exports = mongoose.models.Schedule || mongoose.model("Schedule", ScheduleSchema);
