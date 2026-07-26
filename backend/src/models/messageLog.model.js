const mongoose = require('mongoose');

const MessageLogSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentSession', required: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentTeam', required: true },
  from: { 
    id: { type: String, required: true },
    type: { type: String, enum: ['internal', 'external', 'system'], required: true }
  },
  to: { 
    id: { type: String, required: true },
    type: { type: String, enum: ['internal', 'external', 'broadcast', 'system'], required: true }
  },
  type: { type: String, required: true },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'processed', 'failed'],
    default: 'sent'
  },
  content: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true, minimize: false });

MessageLogSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.models.MessageLog || mongoose.model('MessageLog', MessageLogSchema);