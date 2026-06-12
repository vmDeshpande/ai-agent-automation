const mongoose = require("mongoose");

async function connectDB() {
  try {
    const maxPoolSize = Number(process.env.MONGO_MAX_POOL_SIZE || 100);
    const minPoolSize = Number(process.env.MONGO_MIN_POOL_SIZE || 10);
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize,
      minPoolSize,
    });
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  }
}

module.exports = connectDB;
