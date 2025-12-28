const router = require("express").Router();
const authMiddleware = require("../middleware/auth.middleware");
const { createWorkflow, listWorkflows, getWorkflow, updateWorkflow, deleteWorkflow, addTaskToWorkflow, assignAgent, runWorkflowNow, updateWorkflowSteps } = require("../controllers/workflow.controller");

// Require auth for all workflow routes
router.use(authMiddleware);

router.post("/", createWorkflow);
router.get("/", listWorkflows);

// IMPORTANT: specific routes FIRST
router.put("/:workflowId/steps", updateWorkflowSteps);
router.post("/:workflowId/add-task", addTaskToWorkflow);
router.put("/:workflowId/assign-agent", assignAgent);
router.post("/:workflowId/run", runWorkflowNow);

// THEN the generic ID routes
router.get("/:id", getWorkflow);
router.put("/:id", updateWorkflow);
router.delete("/:id", deleteWorkflow);



module.exports = router;
