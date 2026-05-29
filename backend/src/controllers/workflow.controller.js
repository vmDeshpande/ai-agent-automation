const Workflow = require("../models/workflow.model");
const Task = require("../models/task.model");

/** Create a new workflow */
async function createWorkflow(req, res) {
  try {
    const { name, description, agentId, metadata } = req.body;
    const workflow = await Workflow.create({
      name,
      description,
      userId: req.user._id,
      agentId: agentId || null,
      metadata: metadata || {},
    });
    res.status(201).json({ ok: true, workflow });
  } catch (err) {
    console.error("createWorkflow error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

/** List workflows for user */
async function listWorkflows(req, res) {
  try {
    const workflows = await Workflow.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ ok: true, workflows });
  } catch (err) {
    console.error("listWorkflows error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

/** Get single workflow by ID */
async function getWorkflow(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.id).populate("tasks");
    if (!workflow) return res.status(404).json({ error: "not_found" });
    if (workflow.userId.toString() !== req.user._id.toString()) return res.status(403).json({ error: "forbidden" });
    res.json({ ok: true, workflow });
  } catch (err) {
    console.error("getWorkflow error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

/** Update workflow */
async function updateWorkflow(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ error: "not_found" });
    if (workflow.userId.toString() !== req.user._id.toString()) return res.status(403).json({ error: "forbidden" });

    // Object.assign(workflow, req.body); // update fields from request
    const allowed = ["name", "description", "status", "tasks", "agentId"];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        workflow[key] = req.body[key];
      }
    }

    await workflow.save();

    res.json({ ok: true, workflow });
  } catch (err) {
    console.error("updateWorkflow error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

/** Delete workflow */
async function deleteWorkflow(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ error: "not_found" });
    if (workflow.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "forbidden" });

    // Use deleteOne on the document
    await workflow.deleteOne();

    // Or alternatively, directly:
    // await Workflow.findByIdAndDelete(req.params.id);

    res.json({ ok: true, message: "workflow_deleted" });
  } catch (err) {
    console.error("deleteWorkflow error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

// Add Task to Workflow
async function addTaskToWorkflow(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.workflowId);
    if (!workflow) return res.status(404).json({ error: "not_found" });

    if (workflow.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "forbidden" });

    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: "taskId_required" });

    // 👇 Prevent duplicates
    if (workflow.tasks.includes(taskId)) {
      return res.json({
        ok: true,
        message: "Task already exists in workflow",
        workflow,
      });
    }

    workflow.tasks.push(taskId);
    await workflow.save();

    res.json({ ok: true, workflow });
  } catch (err) {
    console.error("addTaskToWorkflow error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

/** Assign agent to workflow */
async function assignAgent(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.workflowId);
    if (!workflow) return res.status(404).json({ ok: false, error: "not_found" });

    if (workflow.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ ok: false, error: "forbidden" });

    const { agentId } = req.body;
    workflow.agentId = agentId || null;
    await workflow.save();

    return res.json({ ok: true, workflow });
  } catch (err) {
    console.error("assignAgent error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/** Run workflow NOW by creating a new task linked to workflow */
async function runWorkflowNow(req, res) {
  try {
    const workflowId = req.params.workflowId;

    const workflow = await Workflow.findById(workflowId);
    if (!workflow) return res.status(404).json({ ok: false, error: "not_found" });

    if (workflow.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ ok: false, error: "forbidden" });

    // Create task
    const task = await Task.create({
      name: `Workflow Run - ${workflow.name}`,
      workflowId,
      agentId: workflow.agentId || null,
      userId: req.user._id,
      input: {},
      metadata: {
        steps: workflow.metadata?.steps || [],
        runningBy: null
      },
      status: "pending"
    });

    // 🔥 Add task to workflow list
    workflow.tasks.push(task._id);
    await workflow.save();

    return res.json({ ok: true, task });
  } catch (err) {
    console.error("runWorkflowNow error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/** Update workflow steps (PUT /api/workflows/:workflowId/steps)
 * body: { steps: [ { stepId, type, prompt, method, url, body, options } ] }
 */
async function updateWorkflowSteps(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.workflowId);

    if (!workflow) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    if (workflow.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    let { steps, edges } = req.body;

    if (!Array.isArray(steps)) {
      return res.status(400).json({ error: "Invalid steps" });
    }

    // 🔥 CLEAN STEPS (REMOVE LEGACY FIELDS)
    steps = steps.map((s) => {
      const clean = { ...s };

      delete clean.cases;
      delete clean.defaultTarget;
      delete clean.trueTarget;
      delete clean.falseTarget;

      return clean;
    });

    // 🔥 VALIDATE EDGES
    edges = Array.isArray(edges)
      ? edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,

        // 🔥 keep everything important
        label: e.label || "",
        condition: e.condition || null,
        caseValue: e.caseValue || null,

        // optional but good
        animated: e.animated ?? true,
        style: e.style || { strokeWidth: 2 },
      }))
      : [];

    workflow.metadata = workflow.metadata || {};
    workflow.metadata.steps = steps;
    workflow.metadata.edges = edges;

    workflow.markModified("metadata");

    await workflow.save();

    return res.json({ ok: true, workflow });
  } catch (err) {
    console.error("updateWorkflowSteps error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/** Clone/duplicate a workflow */
async function cloneWorkflow(req, res) {
  try {
    const original = await Workflow.findById(req.params.id);
    if (!original) return res.status(404).json({ ok: false, error: "not_found" });
    if (original.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ ok: false, error: "forbidden" });

    const cloned = await Workflow.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      userId: req.user._id,
      agentId: original.agentId || null,
      status: "pending",
      tasks: [],
      metadata: {
        steps: original.metadata?.steps ? JSON.parse(JSON.stringify(original.metadata.steps)) : [],
        edges: original.metadata?.edges ? JSON.parse(JSON.stringify(original.metadata.edges)) : [],
      },
    });

    res.status(201).json({ ok: true, workflow: cloned });
  } catch (err) {
    console.error("cloneWorkflow error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

module.exports = { createWorkflow, listWorkflows, getWorkflow, updateWorkflow, deleteWorkflow, addTaskToWorkflow, assignAgent, runWorkflowNow, updateWorkflowSteps, cloneWorkflow };