const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
{
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  title: {
    type: String,
    required: true
  },

  fileType: {
    type: String,
    default: "text"
  },

  size: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ["processing", "ready", "failed"],
    default: "processing"
  },

  processingStartedAt: {
    type: Date
  },

  processedAt: {
    type: Date
  },

  processingStep: {
    type: String
  },

  processedChunks: {
    type: Number,
    default: 0
  },

  totalChunks: {
    type: Number,
    default: 0
  },

  processingError: {
    type: String
  },

  chunkCount: {
    type: Number,
    default: 0
  },

  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
},
{ timestamps: true }
);

module.exports =
mongoose.models.Document ||
mongoose.model("Document", DocumentSchema);
