const express = require('express');
const corsMiddleware = require('./middleware/cors.middleware');
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

app.use(corsMiddleware);
app.use(helmetMiddleware);

// Body parser with a 2 MB global cap. The public webhook route (/webhook/*)
// is excluded here and applies its own stricter 1 MB limit in
// routes/webhook.public.routes.js, since webhook bodies are externally
// controlled and must be tightly bounded to prevent DoS.
const globalJsonParser = express.json({ limit: '2mb' });
const globalUrlencodedParser = express.urlencoded({ limit: '2mb', extended: true });

app.use((req, res, next) => {
  if (req.path === '/webhook' || req.path.startsWith('/webhook/')) {
    return next();
  }
  return globalJsonParser(req, res, (err) => {
    if (err) return next(err);
    return globalUrlencodedParser(req, res, next);
  });
});

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

// health (liveness) — lightweight, no dependency checks
const { getHealth, getReady } = require('./controllers/health.controller');
app.get('/health', getHealth);

// readiness — validates MongoDB connectivity
app.get('/ready', getReady);

// routes
// Single API-wide baseline rate limiter. All /api/* routes inherit this.
// Specialized limiters (authLimiter, expensiveLimiter, dashboardLimiter)
// are applied per-route where intentionally stricter behavior is needed.
app.use('/api', globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/agent-teams', agentTeamRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/webhook/a2a', a2aPublicRoutes);
app.use('/webhook', webhookPublicRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/workflows/public', workflowPublicRoutes);

// generic 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = app;
