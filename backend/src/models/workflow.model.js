const mongoose = require('mongoose');

const WorkflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, default: null }, // optional AI agent
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }], // linked tasks
    status: {
      type: String,
      enum: ['pending', 'running', 'failed', 'completed'],
      default: 'pending',
    },
    errorLog: [
      {
        message: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    metadata: {
      steps: { type: [mongoose.Schema.Types.Mixed], default: [] },
      edges: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    apiSettings: {
      enabled: { type: Boolean, default: false },
      endpointName: { type: String, default: '', index: true },
      authentication: { type: Boolean, default: false },
      rateLimit: { type: Boolean, default: false },
      responseStepId: { type: String, default: '' },
    },
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.models.Workflow || mongoose.model('Workflow', WorkflowSchema);
