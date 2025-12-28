const Task = require("../models/task.model");
const Workflow = require("../models/workflow.model"); // import workflow model
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

    let agentId = null;

    if (workflowId) {
      const workflow = await Workflow.findById(workflowId);
      if (!workflow) {
        return sendError(res, 404, "workflow_not_found");
      }

      agentId = workflow.agentId || null;
    }

    const task = await Task.create({
      name: name || "manual-task",
      workflowId: workflowId || null,
      agentId, // ✅ comes from workflow
      userId,
      input: input || {},
      metadata: metadata || {},
    });

    if (workflowId) {
      const workflow = await Workflow.findById(workflowId);
      workflow.tasks.unshift(task._id); // newest on top
      await workflow.save();
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

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
};
