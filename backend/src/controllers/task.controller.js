const Task = require("../models/task.model");
<<<<<<< HEAD
=======
const Workflow = require("../models/workflow.model"); // import workflow model
const { getWorkflowGraph } = require("../utils/workflowMetadata");
// -----------------------------
// Utility: Response Helpers
// -----------------------------
function sendError(res, code, message) {
  return res.status(code).json({ ok: false, error: message });
}
>>>>>>> upstream/main

/**
 * POST /api/tasks/:taskId/resume
 * Fix #4: Explicit user-facing endpoint to resume a failed task execution path
 */
async function resumeFailedTask(req, res) {
  try {
    const { taskId } = req.params;
    const { resumeFromStepId } = req.body;

<<<<<<< HEAD
    // Find the task targeting the failure path
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        message: "Task not found" 
=======
    let workflow = null;
    let steps = [];
    let edges = [];
    let agentId = null;

    if (workflowId) {
      workflow = await Workflow.findOne({
        _id: workflowId,
        userId: req.user._id
      });
      if (!workflow) {
        return sendError(res, 404, "workflow_not_found");
      }

      agentId = workflow.agentId || null;

      // Single source of truth: workflow.metadata.{steps,edges}
      ({ steps, edges } = getWorkflowGraph(workflow));

      if (steps.length === 0) {
        return sendError(res, 400, "workflow_has_no_steps");
      }
    }

    const task = await Task.create({
      name: name || `Workflow Run - ${workflow?.name || "task"}`,
      workflowId: workflowId || null,
      agentId,
      userId,
      input: input || {},

      // 🔥 THIS IS WHAT THE RUNNER EXECUTES
      steps,
      currentStep: 0,

      metadata: {
        ...(metadata || {}),
        edges,
        runningBy: "manual_run",
      },
    });

    if (workflowId) {
      await Workflow.findByIdAndUpdate(workflowId, {
        $push: { tasks: task._id },
>>>>>>> upstream/main
      });
    }

    // Validate that the task state allows a continuation path
    if (task.status !== "failed" && task.status !== "error") {
      return res.status(400).json({ 
        success: false, 
        message: "Only failed or halted tasks can be resumed" 
      });
    }

    if (!resumeFromStepId) {
      return res.status(400).json({
        success: false,
        message: "A target resumeFromStepId must be specified in the request body"
      });
    }

    // Re-hydrate state boundaries and re-queue it into the processing engine pipeline
    task.status = "pending";
    task.resumeFromStepId = resumeFromStepId; 
    task.error = null;
    
    await task.save();

    return res.status(200).json({
      success: true,
      message: `Task execution path successfully re-queued to resume from step: ${resumeFromStepId}`,
      data: task
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}

module.exports = {
  resumeFailedTask
};