const router = require("express").Router();
const authMiddleware = require("../middleware/auth.middleware");
const { expensiveLimiter } = require("../middleware/rateLimit.middleware");

const {
  createWorkflow,
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  addTaskToWorkflow,
  assignAgent,
  runWorkflowNow,
  updateWorkflowSteps,
  exportWorkflow,
  cloneWorkflow
} = require("../controllers/workflow.controller");

const {
  listWorkflowVersions,
  getWorkflowVersion,
  rollbackWorkflow,
} = require("../controllers/workflowVersion.controller");

// Require auth for all workflow routes
router.use(authMiddleware);

router.post("/", createWorkflow);
router.get("/", listWorkflows);

// IMPORTANT: specific routes FIRST
router.get("/:workflowId/export", exportWorkflow);
router.put("/:workflowId/steps", updateWorkflowSteps);
router.post("/:workflowId/add-task", addTaskToWorkflow);
router.put("/:workflowId/assign-agent", assignAgent);
router.post("/:workflowId/run", expensiveLimiter, runWorkflowNow);

// Workflow Version History endpoints
router.get("/:id/versions", listWorkflowVersions);
router.get("/:id/versions/:versionId", getWorkflowVersion);
router.post("/:id/rollback/:versionId", rollbackWorkflow);

// Action endpoints
router.post("/:id/clone", cloneWorkflow);

// THEN the generic ID routes
router.get("/:id", getWorkflow);
router.put("/:id", updateWorkflow);
router.delete("/:id", deleteWorkflow);

module.exports = router;