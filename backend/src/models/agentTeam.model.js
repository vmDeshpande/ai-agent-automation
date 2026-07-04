const mongoose = require('mongoose');

const AgentTeamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  agents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
  externalAgents: [{
    name: { type: String, required: true, trim: true },
    webhookUrl: { 
      type: String, 
      required: true, 
      trim: true,
      validate: {
        validator: (v) => /^https?:\/\/.+/.test(v),
        message: 'Invalid webhook URL format'
      }
    },
    capabilities: { type: [String], default: [] }
  }],
  topology: { 
    type: String, 
    enum: ['mesh', 'hierarchical', 'linear'], 
    default: 'mesh' 
  },
  isActive: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, minimize: false });

module.exports = mongoose.models.AgentTeam || mongoose.model('AgentTeam', AgentTeamSchema);