// middleware/helmetMiddleware.js
const helmet = require('helmet');

// Since this is an API-only backend, we only override the necessary option
// to ensure the API remains accessible to the frontend.
const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false, // Fix CORS for frontend
});

module.exports = helmetMiddleware;
