const mongoose = require('mongoose');

/**
 * Step execution result (immutable history)
 */
const StepResultSchema = new mongoose.Schema(
  {
    stepId: { type: String },
    type: { type: String },
    tool: { type: String },
    serverId: { type: String },
    toolName: { type: String },
    position: {
      x: Number,
      y: Number,
    },
    input: { type: mongoose.Schema.Types.Mixed },
    output: { type: mongoose.Schema.Types.Mixed },
    branch: { type: String },
    caseValue: { type: String },
    error: { type: String },
    errorMetadata: { type: mongoose.Schema.Types.Mixed },
    success: { type: Boolean, default: true },
    timestamp: { type: Date, default: Date.now },
    /**
     * Wall-clock execution time of this step in milliseconds.
     * Set by the runner after each executeStep() call.
     */
    durationMs: { type: Number },
    /**
     * Step-level telemetry payload.
     * For "llm" steps with memory enabled:
     *   { useMemory, retrievedMemoriesCount, similarityScores[], averageSimilarity }
     * For "document_query" steps:
     *   { topK, retrievedChunksCount, averageSimilarity, relevantChunksCount }
     */
    metrics: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: mongoose.Schema.Types.Mixed },
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
      ref: 'Workflow',
      default: null,
    },

    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      default: null,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    name: {
      type: String,
      default: 'Default Task Name',
    },

    position: {
      x: Number,
      y: Number,
    },

    status: {
      type: String,
      enum: ['pending', 'running', 'failed', 'completed', 'pending_approval', 'rejected'],
      default: 'pending',
      index: true,
    },

    /**
     * 🔥 CRITICAL: steps copied from workflow.metadata.steps
     * Runner executes THIS field
     */
    steps: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    /**
     * Pointer to current executing step index
     */
    currentStep: {
      type: Number,
      default: 0,
    },

    /**
     * Input payload for the task
     */
    input: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /**
     * Runtime metadata (schedule info, trigger source, etc.)
     */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /**
     * Execution history
     */
    stepResults: {
      type: [StepResultSchema],
      default: [],
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    retryHistory: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    /**
     * HITL: Tracks which step paused execution for approval.
     * Set when the runner encounters an approval step.
     */
    pausedAtStepId: {
      type: String,
      default: null,
    },

    /**
     * HITL: Approval metadata for human-in-the-loop workflows.
     * Populated when a task reaches an approval node.
     */
    approval: {
      stepId: { type: String },
      requestedAt: { type: Date },
      decidedAt: { type: Date },
      decision: { type: String, enum: ['approved', 'rejected'] },
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      feedback: { type: String, default: '' },
    },

    graphHash: {
      type: String,
      default: null,
    },
    executionMode: {
      type: String,
      enum: ['standard', 'partial'],
      default: 'standard',
    },
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
  },
  { timestamps: true }
);

TaskSchema.pre('save', function (next) {
  if (this.isModified('steps') || this.isModified('metadata') || !this.graphHash) {
    const steps = this.steps || this.metadata?.steps || [];
    const edges = this.metadata?.edges || [];
    if (steps.length > 0) {
      const crypto = require('crypto');

      const sortedSteps = [...steps]
        .map((s) => {
          const sId = s.stepId || s.id || s.name;
          return {
            id: sId,
            type: s.type,
            config: s.config || {},
          };
        })
        .sort((a, b) => {
          if (!a.id || !b.id) return 0;
          return a.id.localeCompare(b.id);
        });

      const sortedEdges = [...edges]
        .map((e) => ({
          source: e.source,
          target: e.target,
          condition: e.condition || null,
          caseValue: e.caseValue || null,
        }))
        .sort((a, b) => {
          if (!a.source || !b.source) return 0;
          const cmp = a.source.localeCompare(b.source);
          if (cmp !== 0) return cmp;
          if (!a.target || !b.target) return 0;
          return a.target.localeCompare(b.target);
        });

      const payload = JSON.stringify({ steps: sortedSteps, edges: sortedEdges });
      this.graphHash = crypto.createHash('sha1').update(payload).digest('hex');
    }
  }
  next();
});

module.exports = mongoose.models.Task || mongoose.model('Task', TaskSchema);
