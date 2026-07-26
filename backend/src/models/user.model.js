const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "",
    trim: true,                    
    minlength: [2, "Name must be at least 2 characters long"],
    maxlength: [50, "Name cannot exceed 50 characters"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    index: true,
    trim: true,                     
    lowercase: true,               
    match: [                         
      /^\S+@\S+\.\S+$/,
      "Please enter a valid email address",
    ],
  },
  passwordHash: {
    type: String,
    required: [true, "Password hash is required"],
  },
  role: {
    type: String,
    enum: {
      values: ["user", "admin"],
      message: "{VALUE} is not a valid role. Use 'user' or 'admin'.",
    },
    default: "user",
  },
  apiUsage: {
    groqCalls: { type: Number, default: 0, min: [0, "API usage cannot be negative"] },
    geminiCalls: { type: Number, default: 0, min: [0, "API usage cannot be negative"] },
    totalTokens: { type: Number, default: 0, min: [0, "API usage cannot be negative"] },
  },
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);