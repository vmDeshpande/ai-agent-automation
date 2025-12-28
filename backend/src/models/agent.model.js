const mongoose = require("mongoose");

const AgentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

  // type: "system" (built-in) or "custom"
  type: { type: String, enum: ["system", "custom"], default: "custom" },

  // config: model name, temperature, tool list, any other secrets (store only keys, not plaintext secrets ideally)
  config: {
    model: { type: String, default: "llama-3.1-8b-instant" },
    temperature: { type: Number, default: 0.2 },
    // tool configs like { email: { enabled: true }, http: { rateLimit: 10 } }
    tools: { type: mongoose.Schema.Types.Mixed, default: {} },
    // optional metadata
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  // capabilities - quick lookup (e.g. ["llm","http","email"])
  capabilities: { type: [String], default: ["llm"] },

  isActive: { type: Boolean, default: true },

  // optional policy / rate limits
  quota: {
    callsPerDay: { type: Number, default: 1000 }
  }
}, { timestamps: true });

module.exports = mongoose.models.Agent || mongoose.model("Agent", AgentSchema);
