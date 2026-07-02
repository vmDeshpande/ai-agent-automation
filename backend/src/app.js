const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes.js");
const taskRoutes = require("./routes/task.routes.js");
const workflowRoutes = require("./routes/workflow.routes");
const agentRoutes = require("./routes/agent.routes");
const logRoutes = require("./routes/log.routes");
const scheduleRoutes = require("./routes/schedule.routes");
const webhookRoutes = require("./routes/webhook.routes"); // admin
const webhookPublicRoutes = require("./routes/webhook.public.routes"); // public
const documentRoutes = require("./routes/document.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const settingsRoutes = require("./routes/settings.routes");
const systemRoutes = require("./routes/system.routes");
const templateRoutes = require("./routes/template.routes");
const memoryRoutes = require("./routes/memory.routes");
const assistantRoutes = require("./routes/assistant.routes");
const telemetryRoutes = require("./routes/telemetry.routes");
const helmetMiddleware = require("./middleware/helmet.middleware.js");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(helmetMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/webhook", webhookPublicRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/telemetry", telemetryRoutes);

// generic 404
app.use((req, res) => res.status(404).json({ error: "Not found" }));

module.exports = app;
