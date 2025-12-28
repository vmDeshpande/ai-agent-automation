const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, default: "" },
  text: { type: String, default: "" }, // plaintext content
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  embedding: { type: [Number], default: [] } // embedding vector
}, { timestamps: true });

module.exports = mongoose.models.Document || mongoose.model("Document", DocumentSchema);
