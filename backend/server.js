// src/server.js (or root server file that you run)
const dotenv = require("dotenv");
const validateEnv = require("./src/config/env");

dotenv.config();

validateEnv();

require("dotenv").config();
const connectDB = require("./src/config/db");
const app = require("./src/app");
const schedulerService = require("./src/services/schedulerService");
const telemetryService = require("./src/services/telemetry.service");
const { markStaleProcessingDocumentsAsFailed } = require("./src/services/documentService");

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  try {
    await markStaleProcessingDocumentsAsFailed();
    console.log("Stale document processing cleanup complete");
  } catch (err) {
    console.error("Stale document processing cleanup failed:", err);
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    try {
      await schedulerService.start();
      console.log("🕒 Scheduler service started");
    } catch (err) {
      console.error("Scheduler failed to start:", err);
    }

    try {
      await telemetryService.start();
      console.log("📡 Telemetry service started");
    } catch (err) {
      console.error("Telemetry failed to start:", err);
    }
  });
});
