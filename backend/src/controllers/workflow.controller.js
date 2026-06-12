const Workflow = require("../models/workflow.model");
const Task = require("../models/task.model");
const workflowVersionService = require("../services/workflowVersion.service");

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

    // Create initial version configuration snapshot
    await workflowVersionService.createVersionIfNeeded(workflow, req.user._id, "Initial version");

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

    // Create a new version if name, description, or agentId configuration details changed
    await workflowVersionService.createVersionIfNeeded(workflow, req.user._id, "Updated details");

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

    // Create a new version for this execution settings change
    await workflowVersionService.createVersionIfNeeded(workflow, req.user._id, "Assigned agent");

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

    const steps = Array.isArray(workflow.metadata?.steps)
      ? workflow.metadata.steps
      : [];
    const edges = Array.isArray(workflow.metadata?.edges)
      ? workflow.metadata.edges
      : [];

    if (steps.length === 0) {
      return res.status(400).json({ ok: false, error: "workflow_has_no_steps" });
    }

    // Create task
    const task = await Task.create({
      name: `Workflow Run - ${workflow.name}`,
      workflowId,
      agentId: workflow.agentId || null,
      userId: req.user._id,
      input: {},
      steps,
      currentStep: 0,
      metadata: {
        steps,
        edges,
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

    // Create a new version if steps or edges changed
    await workflowVersionService.createVersionIfNeeded(workflow, req.user._id, "Updated graph configuration");

    return res.json({ ok: true, workflow });
  } catch (err) {
    console.error("updateWorkflowSteps error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}


async function exportWorkflow(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.workflowId);
    if (!workflow) return res.status(404).json({ ok: false, error: "not_found" });
    if (workflow.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ ok: false, error: "forbidden" });

    const exportData = {
      id: workflow._id.toString(),
      name: workflow.name,
      description: workflow.description || "",
      category: "",
      icon: "",
      tags: [],
      agentId: workflow.agentId ? workflow.agentId.toString() : null,
      steps: (workflow.metadata?.steps ?? []),
      edges: (workflow.metadata?.edges ?? []),
    };

    res.setHeader("Content-Disposition", `attachment; filename="${workflow.name.replace(/\s+/g, "_")}.json"`);
    res.setHeader("Content-Type", "application/json");
    return res.json(exportData);
  } catch (err) {
    console.error("exportWorkflow error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}


module.exports = { createWorkflow, listWorkflows, getWorkflow, updateWorkflow, deleteWorkflow, addTaskToWorkflow, assignAgent, runWorkflowNow, updateWorkflowSteps, exportWorkflow };