const rateLimit = require("express-rate-limit");
const { writeLog } = require("../agents/logger");

// Standard rate limit exceeded JSON handler with database logging
const limitHandler = (req, res, next, options) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const logMessage = `Rate limit violation: IP ${ip} blocked requesting ${req.method} ${req.originalUrl}`;
  
  // Log locally to stdout/stderr
  console.warn(`⚠️ [RateLimiter] ${logMessage}`);
  
  // Persist rate limit violation to system logs
  writeLog(logMessage, "warn", { workerId: "rate-limiter" })
    .catch((err) => console.error("Failed to write rate limit log to DB:", err.message));

  res.status(options.statusCode).json({
    error: "rate_limit_exceeded",
    message: options.message,
  });
};

// 1. Global Limiter (applied globally to all /api routes)
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 mins default
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 100,
  message: "Too many requests. Please try again later.",
  handler: limitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Auth Limiter (applied to registration & login endpoints)
const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 mins default
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 5,
  message: "Too many authentication attempts. Please try again after 15 minutes.",
  handler: limitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. Expensive Resource Limiter (applied to AI generation, workflow runs, uploads)
const expensiveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: Number(process.env.RATE_LIMIT_EXPENSIVE_MAX) || 10,
  message: "Rate limit exceeded for expensive operations. Please slow down.",
  handler: limitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. Webhook Limiter (applied to public /webhook routes)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: Number(process.env.RATE_LIMIT_WEBHOOK_MAX) || 20,
  message: "Too many webhook requests. Please slow down.",
  handler: limitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalLimiter,
  authLimiter,
  expensiveLimiter,
  webhookLimiter,
};
