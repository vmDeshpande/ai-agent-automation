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

  const socketUtil = require('./src/utils/socket');
  const { setupSocketHandlers } = require('./src/utils/socketHandlers');

  const server = app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    const io = socketUtil.init(server);
    setupSocketHandlers(io);

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

    try {
      require('./src/agents/eventBroker');
      console.log("🧠 Event Broker Engine listening for swarm messages");
    } catch (err) {
      console.error("Event broker failed to start:", err);
    }
  });
});
