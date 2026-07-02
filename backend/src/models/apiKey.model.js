const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema(
  {
    keyHash: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);
