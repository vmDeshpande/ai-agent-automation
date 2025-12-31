const mongoose = require("mongoose");

const SystemSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    worker: {
      pollIntervalMs: { type: Number, default: 2000 },
      maxAttempts: { type: Number, default: 3 },
    },

    scheduler: {
      enabled: { type: Boolean, default: true },
    },

    ui: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "dark",
      },
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SystemSettings ||
  mongoose.model("SystemSettings", SystemSettingsSchema);
