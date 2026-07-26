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
  
  const server = app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    const io = socketUtil.init(server);
    io.on('connection', (socket) => {
      socket.on('join_war_room', async (data) => {
        try {
          const { teamId, token } = data;
          if (!token) throw new Error();

          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const userId = decoded.id || decoded.userId || decoded.sub;
          
          if (!userId) throw new Error();

          const mongoose = require('mongoose');
          const db = mongoose.connection.db;

          let authQuery = [{ userId: userId }, { ownerId: userId }];
          
          if (mongoose.Types.ObjectId.isValid(userId)) {
            authQuery.push({ userId: new mongoose.Types.ObjectId(userId) });
            authQuery.push({ ownerId: new mongoose.Types.ObjectId(userId) });
          }

          if (teamId && typeof teamId === 'string' && mongoose.Types.ObjectId.isValid(teamId)) {
            const hasWorkflowAccess = await db.collection('workflows').findOne({
              _id: new mongoose.Types.ObjectId(teamId),
              $or: authQuery
            });

            const hasTeamAccess = await db.collection('agentteams').findOne({
              _id: new mongoose.Types.ObjectId(teamId),
              $or: authQuery
            });

            if (!hasWorkflowAccess && !hasTeamAccess) throw new Error();

            socket.join(`war_room_${teamId}`);

            const EventEmitter = require('events');
            global.socketSync = global.socketSync || new EventEmitter();
            global.socketSync.emit(`joined_${teamId}`);
          }
        } catch (error) {
          socket.disconnect();
        }
      });
    });

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
      console.error("Event Broker failed to start:", err);
    }
  });
});
