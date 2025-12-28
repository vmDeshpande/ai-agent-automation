const mongoose = require("mongoose");

const WebhookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  source: { type: String, required: true, index: true }, // e.g. "stripe", "github", "custom"
  secret: { type: String, required: true }, // random secret token
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: "Workflow", default: null },
  active: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.models.Webhook || mongoose.model("Webhook", WebhookSchema);
