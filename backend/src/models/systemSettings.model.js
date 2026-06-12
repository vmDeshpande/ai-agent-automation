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
    assistant: {
      enabled: { type: Boolean, default: false },
      provider: {
        type: String,
        enum: ["ollama", "openai", "groq", "gemini", "huggingface"],
        default: null,
      },
      model: { type: String, default: null },
    },
    
    documentChat: {
      enabled: { type: Boolean, default: true },

      provider: {
        type: String,
        enum: ["ollama", "openai", "groq", "gemini", "huggingface"],
        default: "ollama",
      },

      model: { type: String, default: null },

      topK: { type: Number, default: 3 },

      temperature: { type: Number, default: 0.2 },
    },

    mcp: {
      enabled: { type: Boolean, default: false },
      servers: {
        type: [
          new mongoose.Schema(
            {
              id: { type: String, required: true },
              name: { type: String, required: true },
              transport: {
                type: String,
                enum: ["stdio", "streamable-http"],
                default: "stdio",
              },
              command: { type: String, default: "" },
              args: { type: [String], default: [] },
              url: { type: String, default: "" },
              headers: { type: mongoose.Schema.Types.Mixed, default: {} },
              env: { type: mongoose.Schema.Types.Mixed, default: {} },
              enabled: { type: Boolean, default: true },
              autoDiscover: { type: Boolean, default: true },
              timeoutMs: { type: Number, default: 30000 },
            },
            { _id: false, minimize: false }
          ),
        ],
        default: [],
      },
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SystemSettings ||
  mongoose.model("SystemSettings", SystemSettingsSchema);
