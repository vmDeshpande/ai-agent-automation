const Task = require("../models/task.model");
const Workflow = require("../models/workflow.model"); // import workflow model
const { getWorkflowGraph } = require("../utils/workflowMetadata");
// -----------------------------
// Utility: Response Helpers
// -----------------------------
function sendError(res, code, message) {
  return res.status(code).json({ ok: false, error: message });
}

function sendOK(res, data) {
  return res.json({ ok: true, ...data });
}

// -----------------------------
// Create Task
// POST /api/tasks
// -----------------------------
async function createTask(req, res) {
  try {
    const userId = req.user._id;
    const { name, workflowId, input, metadata } = req.body;

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
      });
    }

    return sendOK(res, { task });
  } catch (err) {
    console.error("createTask error:", err);
    return sendError(res, 500, "server_error");
  }
}

// -----------------------------
// List Tasks with pagination
// GET /api/tasks?status=&workflowId=&page=&limit=
// -----------------------------
async function listTasks(req, res) {
  try {
    const userId = req.user._id;
    const {
      status,
      workflowId,
      page = 1,
      limit = 20
    } = req.query;

    // base query (always scoped to user)
    const q = { userId };

    // optional filters
    if (status) q.status = status;
    if (workflowId) q.workflowId = workflowId;

    const pageNum = Math.max(Number(page), 1);
    const pageSize = Math.min(Number(limit), 100);
    const skip = (pageNum - 1) * pageSize;

    const [tasks, total] = await Promise.all([
      Task.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Task.countDocuments(q),
    ]);

    return sendOK(res, {
      tasks,
      meta: {
        total,
        page: pageNum,
        limit: pageSize,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("listTasks error:", err);
    return sendError(res, 500, "server_error");
  }
}


// -----------------------------
// Get Single Task
// GET /api/tasks/:id
// -----------------------------
async function getTask(req, res) {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;

    const t = await Task.findById(taskId);
    if (!t) return sendError(res, 404, "not_found");
    if (t.userId.toString() !== userId.toString())
      return sendError(res, 403, "forbidden");

    return sendOK(res, { task: t });
  } catch (err) {
    console.error("getTask error:", err);
    return sendError(res, 500, "server_error");
  }
}

// -----------------------------
// Update Task (status, metadata, etc.)
// PUT /api/tasks/:id
// -----------------------------
async function updateTask(req, res) {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;
    const allowed = ["name", "status", "input", "metadata", "attempts"];

    const t = await Task.findById(taskId);
    if (!t) return sendError(res, 404, "not_found");
    if (t.userId.toString() !== userId.toString())
      return sendError(res, 403, "forbidden");

    Object.entries(req.body).forEach(([key, val]) => {
      if (allowed.includes(key)) t[key] = val;
    });

    // lifecycle auto-updates
    if (req.body.status === "running" && !t.startedAt)
      t.startedAt = Date.now();
    if (req.body.status === "completed") t.completedAt = Date.now();

    await t.save();

    return sendOK(res, { task: t });
  } catch (err) {
    console.error("updateTask error:", err);
    return sendError(res, 500, "server_error");
  }
}

// -----------------------------
// Delete Task
// DELETE /api/tasks/:id
// -----------------------------
async function deleteTask(req, res) {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;

    const t = await Task.findById(taskId);
    if (!t) return sendError(res, 404, "not_found");
    if (t.userId.toString() !== userId.toString())
      return sendError(res, 403, "forbidden");

    // Remove task from workflow.tasks if linked
    if (t.workflowId) {
      await Workflow.findByIdAndUpdate(t.workflowId, {
        $pull: { tasks: t._id },
      });
    }

    await t.deleteOne();
    return sendOK(res, { message: "deleted" });
  } catch (err) {
    console.error("deleteTask error:", err);
    return sendError(res, 500, "server_error");
  }
}

// -----------------------------
// Approve Task (HITL)
// POST /api/tasks/:id/approve
// -----------------------------
async function approveTask(req, res) {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;
    const { feedback } = req.body || {};

    const t = await Task.findById(taskId);
    if (!t) return sendError(res, 404, "not_found");
    if (t.userId.toString() !== userId.toString())
      return sendError(res, 403, "forbidden");
    if (t.status !== "pending_approval")
      return sendError(res, 400, "task_not_awaiting_approval");

    const stepId = t.approval?.stepId || t.pausedAtStepId;
    if (stepId) {
      await Task.updateOne(
        { _id: taskId, "stepResults.stepId": stepId },
        {
          $set: {
            status: "pending",
            "approval.decision": "approved",
            "approval.decidedAt": new Date(),
            "approval.decidedBy": userId,
            "approval.feedback": feedback || "",
            "stepResults.$.output": feedback ? `Approved with feedback: ${feedback}` : 'Approved',
            "stepResults.$.feedback": feedback || "",
            "stepResults.$.success": true,
            "stepResults.$.requiresApproval": false
          },
        }
      );
    } else {
      await Task.findByIdAndUpdate(taskId, {
        $set: {
          status: "pending",
          "approval.decision": "approved",
          "approval.decidedAt": new Date(),
          "approval.decidedBy": userId,
          "approval.feedback": feedback || "",
        },
      });
    }

    return sendOK(res, { message: "approved" });
  } catch (err) {
    console.error("approveTask error:", err);
    return sendError(res, 500, "server_error");
  }
}

// -----------------------------
// Reject Task (HITL)
// POST /api/tasks/:id/reject
// -----------------------------
async function rejectTask(req, res) {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;
    const { feedback } = req.body || {};

    const t = await Task.findById(taskId);
    if (!t) return sendError(res, 404, "not_found");
    if (t.userId.toString() !== userId.toString())
      return sendError(res, 403, "forbidden");
    if (t.status !== "pending_approval")
      return sendError(res, 400, "task_not_awaiting_approval");

    const stepId = t.approval?.stepId || t.pausedAtStepId;
    if (stepId) {
      await Task.updateOne(
        { _id: taskId, "stepResults.stepId": stepId },
        {
          $set: {
            status: "rejected",
            completedAt: new Date(),
            "approval.decision": "rejected",
            "approval.decidedAt": new Date(),
            "approval.decidedBy": userId,
            "approval.feedback": feedback || "",
            "stepResults.$.output": feedback ? `Rejected with feedback: ${feedback}` : 'Rejected',
            "stepResults.$.feedback": feedback || "",
            "stepResults.$.success": false,
            "stepResults.$.requiresApproval": false
          },
        }
      );
    } else {
      await Task.findByIdAndUpdate(taskId, {
        $set: {
          status: "rejected",
          completedAt: new Date(),
          "approval.decision": "rejected",
          "approval.decidedAt": new Date(),
          "approval.decidedBy": userId,
          "approval.feedback": feedback || "",
        },
      });
    }

    return sendOK(res, { message: "rejected" });
  } catch (err) {
    console.error("rejectTask error:", err);
    return sendError(res, 500, "server_error");
  }
}

// -----------------------------
// Resume Task (Deterministic Replay)
// POST /api/tasks/:id/resume
// -----------------------------
async function resumeTask(req, res) {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;
    const { resumeStepId } = req.body || {};

    const t = await Task.findById(taskId);
    if (!t) return sendError(res, 404, "not_found");
    if (t.userId.toString() !== userId.toString())
      return sendError(res, 403, "forbidden");
    if (t.status === "completed")
      return sendError(res, 400, "task_already_completed");
    if (t.status === "running")
      return sendError(res, 400, "task_currently_running");

    // Perform backend integrity check comparing current node configurations
    // against saved task snapshots for all successful steps.
    if (t.workflowId) {
      const workflow = await Workflow.findById(t.workflowId);
      if (workflow) {
        const wSteps = workflow.metadata?.steps || [];
        const tSteps = t.steps || [];
        const resultsList = t.stepResults || [];
        for (const stepResult of resultsList) {
          if (stepResult.success) {
            const wStep = wSteps.find((s) => (s.stepId || s.id || s.name) === stepResult.stepId);
            const tStep = tSteps.find((s) => (s.stepId || s.id || s.name) === stepResult.stepId);
            if (!wStep) {
              return sendError(res, 400, "workflow_mutated");
            }
            if (JSON.stringify(wStep.config || {}) !== JSON.stringify(tStep.config || {})) {
              return sendError(res, 400, "workflow_mutated");
            }
          }
        }
      }
    }

    const resultsList = t.stepResults || [];
    let keepResults = [];
    if (resumeStepId) {
      const idx = resultsList.findIndex((r) => r.stepId === resumeStepId);
      if (idx !== -1) {
        keepResults = resultsList.slice(0, idx);
      } else {
        keepResults = resultsList.filter((r) => r.success === true);
      }
    } else {
      const idx = resultsList.findIndex((r) => r.success === false);
      if (idx !== -1) {
        keepResults = resultsList.slice(0, idx);
      } else {
        keepResults = resultsList.filter((r) => r.success === true);
      }
    }

    await Task.findByIdAndUpdate(taskId, {
      $set: {
        status: "pending",
        startedAt: null,
        completedAt: null,
        attempts: 0,
        stepResults: keepResults,
        pausedAtStepId: null,
        "approval.decision": undefined,
        "approval.decidedAt": undefined,
        "approval.decidedBy": undefined,
        "approval.feedback": undefined,
      },
    });

    return sendOK(res, { message: "resumed" });
  } catch (err) {
    console.error("resumeTask error:", err);
    return sendError(res, 500, "server_error");
  }
}
// -----------------------------
// Rerun From Failed Step
// POST /api/tasks/:id/rerun-from-failed
// -----------------------------
async function rerunFromFailedStep(req, res) {
  try {
    const userId = req.user._id;
    const taskId = req.params.id;

    const t = await Task.findById(taskId);

    if (!t) return sendError(res, 404, "not_found");

    if (t.userId.toString() !== userId.toString()) {
      return sendError(res, 403, "forbidden");
    }

    if (t.status !== "failed") {
      return sendError(res, 400, "task_not_failed");
    }

    // Find the first failed step
    const failedIndex = t.stepResults.findIndex(
      (step) => step.success === false
    );

    if (failedIndex === -1) {
      return sendError(res, 400, "failed_step_not_found");
    }

    // Copy only successful step results
    const previousResults = t.stepResults
      .slice(0, failedIndex)
      .map((step) => ({
        ...step.toObject(),
        replayedFromTaskId: t._id,
      }));

    const newTask = await Task.create({
      name: `${t.name} (Rerun)`,

      workflowId: t.workflowId,
      agentId: t.agentId,
      userId: t.userId,

      input: t.input,
      metadata: t.metadata,
      steps: t.steps,

      currentStep: failedIndex,
      status: "pending",

      stepResults: previousResults,

      executionMode: "partial",
      parentTaskId: t._id,
      graphHash: t.graphHash,
    });

    return sendOK(res, {
      task: newTask,
    });
  } catch (err) {
    console.error("rerunFromFailedStep error:", err);
    return sendError(res, 500, "server_error");
  }
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  approveTask,
  rejectTask,
  resumeTask,
  rerunFromFailedStep,
};
