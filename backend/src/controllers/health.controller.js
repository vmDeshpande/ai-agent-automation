const mongoose = require('mongoose');

const HEALTH_CHECK_TIMEOUT_MS = 3000;

/**
 * Liveness probe — lightweight, no dependency checks.
 * Preserved exactly as deployed: { ok: true, ts: Date.now() }.
 */
async function getHealth(req, res) {
  return res.json({ ok: true, ts: Date.now() });
}

/**
 * Readiness probe — validates that dependencies required to serve
 * traffic are available. Currently checks:
 *   - database: Mongoose connection state + lightweight ping
 *
 * Worker availability is intentionally NOT checked here because the
 * current architecture has no worker registration or heartbeat
 * mechanism. The worker is an optional background processor; the
 * backend can serve API traffic without it. Local development often
 * runs the backend without a worker, so failing readiness in that
 * state would be misleading.
 */
async function getReady(req, res) {
  const checks = {};
  let overallOk = true;

  const dbCheck = await checkDatabase();
  checks.database = dbCheck;
  if (dbCheck.status !== 'healthy') overallOk = false;

  const status = overallOk ? 'ready' : 'not_ready';
  const httpStatus = overallOk ? 200 : 503;

  return res.status(httpStatus).json({
    ok: overallOk,
    status,
    checks,
    timestamp: new Date().toISOString(),
  });
}

async function checkDatabase() {
  const readyState = mongoose.connection.readyState;

  if (readyState !== 1) {
    return {
      status: 'unhealthy',
      readyState,
      message:
        readyState === 0 ? 'disconnected' : readyState === 2 ? 'connecting' : 'disconnecting',
    };
  }

  try {
    const pingPromise = mongoose.connection.db.admin().ping();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('ping_timeout')), HEALTH_CHECK_TIMEOUT_MS)
    );
    await Promise.race([pingPromise, timeoutPromise]);
    return { status: 'healthy', readyState };
  } catch (err) {
    return {
      status: 'unhealthy',
      readyState,
      message: 'ping_failed',
    };
  }
}

module.exports = { getHealth, getReady };
