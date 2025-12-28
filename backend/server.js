// src/server.js (or root server file that you run)
require("dotenv").config();
const connectDB = require("./src/config/db");
const app = require("./src/app");
const schedulerService = require("./src/services/schedulerService"); // new

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    try {
      await schedulerService.start();
      console.log("🕒 Scheduler service started");
    } catch (err) {
      console.error("Scheduler failed to start:", err);
    }
  });
});
