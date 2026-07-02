// backend/src/controllers/insights.controller.js
const Workflow = require("../models/workflow.model");
const { getWorkflowInsights, getGlobalInsights } = require("../services/insightsService");
const { getWorkflowGraph } = require("../utils/workflowMetadata");

/**
 * GET /api/insights/workflows/:workflowId
 * Returns computed insights for a single workflow.
 */
async function getWorkflowInsightsHandler(req, res) {
  try {
    const { workflowId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 200;

    const workflow = await Workflow.findById(workflowId).lean();
    if (!workflow) {
      return res.status(404).json({ error: "not_found" });
    }
    if (workflow.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "forbidden" });
    }

    const { steps, edges } = getWorkflowGraph(workflow);

    const insights = await getWorkflowInsights(workflowId, req.user._id, limit, {
      steps,
      edges,
    });
    return res.json(insights);
  } catch (err) {
    console.error("[InsightsController] getWorkflowInsights error:", err);
    return res.status(500).json({ error: "Failed to compute workflow insights." });
  }
}

/**
 * GET /api/insights/summary
 * Returns aggregated insights across all workflows for the authenticated user.
 */
async function getGlobalInsightsHandler(req, res) {
  try {
    const userId = req.user._id || req.user.id;
    const limit = parseInt(req.query.limit, 10) || 200;

    const insights = await getGlobalInsights(userId.toString(), limit);
    return res.json(insights);
  } catch (err) {
    console.error("[InsightsController] getGlobalInsights error:", err);
    return res.status(500).json({ error: "Failed to compute global insights." });
  }
}

module.exports = {
  getWorkflowInsightsHandler,
  getGlobalInsightsHandler,
};
