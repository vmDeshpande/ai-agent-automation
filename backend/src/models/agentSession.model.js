const mongoose = require('mongoose');

const AgentSessionSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentTeam', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  objective: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'paused', 'completed', 'failed'], 
    default: 'pending' 
  },
  sharedState: { type: mongoose.Schema.Types.Mixed, default: {} }, 
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  errorLog: [{ 
    message: { type: String, required: true }, 
    timestamp: { type: Date, default: Date.now } 
  }]
}, { timestamps: true, minimize: false });

module.exports = mongoose.models.AgentSession || mongoose.model('AgentSession', AgentSessionSchema);