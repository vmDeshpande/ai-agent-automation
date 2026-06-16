const Task = require("../models/task.model");

/**
 * POST /api/tasks/:taskId/resume
 * Fix #4: Explicit user-facing endpoint to resume a failed task execution path
 */
async function resumeFailedTask(req, res) {
  try {
    const { taskId } = req.params;
    const { resumeFromStepId } = req.body;

    // Find the task targeting the failure path
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        message: "Task not found" 
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