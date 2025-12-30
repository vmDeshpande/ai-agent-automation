const mongoose = require("mongoose");

/**
 * Step execution result (immutable history)
 */
const StepResultSchema = new mongoose.Schema(
  {
    stepId: { type: String },
    type: { type: String },
    tool: { type: String },
    output: { type: mongoose.Schema.Types.Mixed },
    success: { type: Boolean, default: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

/**
 * Task = executable runtime instance of a workflow
 */
const TaskSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
      default: null
    },

    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    name: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: ["pending", "running", "failed", "completed"],
      default: "pending",
      index: true
    },

    /**
     * 🔥 CRITICAL: steps copied from workflow.metadata.steps
     * Runner executes THIS field
     */
    steps: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },

    /**
     * Pointer to current executing step index
     */
    currentStep: {
      type: Number,
      default: 0
    },

    /**
     * Input payload for the task
     */
    input: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    /**
     * Runtime metadata (schedule info, trigger source, etc.)
     */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    /**
     * Execution history
     */
    stepResults: {
      type: [StepResultSchema],
      default: []
    },

    startedAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    },

    attempts: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Task || mongoose.model("Task", TaskSchema);
