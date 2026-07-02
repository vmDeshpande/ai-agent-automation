const mongoose = require("mongoose");

const WorkflowVersionSchema = new mongoose.Schema({
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workflow",
    required: true,
    index: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  workflowSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  note: {
    type: String,
    default: ""
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Compound unique index to prevent duplicate version numbers for the same workflow under concurrent edits
WorkflowVersionSchema.index({ workflowId: 1, versionNumber: 1 }, { unique: true });

module.exports = mongoose.models.WorkflowVersion || mongoose.model("WorkflowVersion", WorkflowVersionSchema);
