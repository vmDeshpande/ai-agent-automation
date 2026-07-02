// backend/src/routes/insights.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const {
  getWorkflowInsightsHandler,
  getGlobalInsightsHandler,
} = require("../controllers/insights.controller");

// GET /api/insights/workflows/:workflowId
router.get("/workflows/:workflowId", auth, getWorkflowInsightsHandler);

// GET /api/insights/summary
router.get("/summary", auth, getGlobalInsightsHandler);

module.exports = router;
