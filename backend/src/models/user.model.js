const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  apiUsage: {
    groqCalls: { type: Number, default: 0 },
    geminiCalls: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }
  }
}, { timestamps: true });

// export model (safe for hot reload)
module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
