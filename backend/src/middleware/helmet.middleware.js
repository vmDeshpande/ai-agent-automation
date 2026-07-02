// server/middleware/helmetMiddleware.js
const helmet = require("helmet");

// crossOriginEmbedderPolicy is set to false to prevent blocking frontend images and fonts.
// The CSP is explicitly configured to allow existing frontend assets and local API/WebSocket connections.
const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:5000", "ws:"],
    },
  },
});

module.exports = helmetMiddleware;