const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes.js');
const taskRoutes = require('./routes/task.routes.js');
const workflowRoutes = require('./routes/workflow.routes');
const agentRoutes = require('./routes/agent.routes');
const logRoutes = require('./routes/log.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const webhookRoutes = require('./routes/webhook.routes'); // admin
const webhookPublicRoutes = require('./routes/webhook.public.routes'); // public
const a2aPublicRoutes = require('./routes/a2a.public.routes');
const agentTeamRoutes = require('./routes/agentTeam.routes');
const documentRoutes = require('./routes/document.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const settingsRoutes = require('./routes/settings.routes');
const systemRoutes = require('./routes/system.routes');
const templateRoutes = require('./routes/template.routes');
const memoryRoutes = require('./routes/memory.routes');
const assistantRoutes = require('./routes/assistant.routes');
const telemetryRoutes = require('./routes/telemetry.routes');
const insightsRoutes = require('./routes/insights.routes');
const mcpRoutes = require('./routes/mcp.routes');
const apiKeyRoutes = require('./routes/apiKey.routes');
const workflowPublicRoutes = require('./routes/workflow.public.routes');
const { globalLimiter, webhookLimiter } = require('./middleware/rateLimit.middleware');
const helmetMiddleware = require('./middleware/helmet.middleware.js');
require('dotenv').config();

const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(helmetMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Internal route for the runner to broadcast socket events securely
app.post('/api/internal/broadcast', (req, res) => {
  try {
    if (!process.env.INTERNAL_AUTH_TOKEN) {
      return res.status(500).json({ ok: false, error: 'Server configuration error.' });
    }
    const internalToken = req.headers['x-internal-token'];
    if (!internalToken || internalToken !== process.env.INTERNAL_AUTH_TOKEN) {
      return res.status(403).json({ ok: false, error: 'Unauthorized internal broadcast request.' });
    }
    const { room, event, payload } = req.body;
    const socketUtil = require('./utils/socket');
    socketUtil.getIO().to(room).emit(event, payload);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

const mongoose = require('mongoose');

const EventEmitter = require('events');
global.socketSync = global.socketSync || new EventEmitter();

// apply rate limiting middleware to routes
app.use('/webhook', webhookLimiter);

// health
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tasks', globalLimiter, taskRoutes);
app.use('/api/documents', globalLimiter, documentRoutes);
app.use('/api/workflows', globalLimiter, workflowRoutes);
app.use('/api/agents', globalLimiter, agentRoutes);
app.use('/api/agent-teams', globalLimiter, agentTeamRoutes);
app.use('/api/schedules', globalLimiter, scheduleRoutes);
app.use('/api/webhooks', globalLimiter, webhookRoutes);
app.use('/webhook/a2a', a2aPublicRoutes);
app.use('/webhook', webhookPublicRoutes);
app.use('/api/templates', globalLimiter, templateRoutes);
app.use('/api/logs', globalLimiter, logRoutes);
app.use('/api/settings', globalLimiter, settingsRoutes);
app.use('/api/system', globalLimiter, systemRoutes);
app.use('/api/memory', globalLimiter, memoryRoutes);
app.use('/api/assistant', globalLimiter, assistantRoutes);
app.use('/api/telemetry', globalLimiter, telemetryRoutes);
app.use('/api/insights', globalLimiter, insightsRoutes);
app.use('/api/mcp', globalLimiter, mcpRoutes);
app.use('/api/keys', globalLimiter, apiKeyRoutes);
app.use('/api/workflows/public', globalLimiter, workflowPublicRoutes);

// generic 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = app;
