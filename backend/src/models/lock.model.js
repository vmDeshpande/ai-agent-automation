const mongoose = require('mongoose');

const LockSchema = new mongoose.Schema(
  {
    lockKey: {
      type: String,
      required: true,
      unique: true,
    },
    ownerId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acquiredAt: {
      type: Date,
      default: Date.now,
    },
    /**
     * For semaphore-style locking: tracks the number of current holders.
     * For exclusive locks this stays at 0. For semaphores it increments/decrements.
     */
    semaphoreCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Compound index for efficient lock lookups by key and expiry status
LockSchema.index({ lockKey: 1, expiresAt: 1 });

// TTL index: MongoDB automatically removes expired lock documents.
// expireAfterSeconds: 0 means the document is deleted at the exact expiresAt time.
LockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Lock || mongoose.model('Lock', LockSchema);
