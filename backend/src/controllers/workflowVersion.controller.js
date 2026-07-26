const Workflow = require("../models/workflow.model");
const workflowVersionService = require("../services/workflowVersion.service");

/**
 * List all versions for a specific workflow.
 * GET /api/workflows/:id/versions
 */
async function listWorkflowVersions(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ ok: false, error: "not_found" });

    // Validate ownership
    if (workflow.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const versions = await workflowVersionService.listVersions(workflow._id);
    res.json({ ok: true, versions });
  } catch (err) {
    console.error("listWorkflowVersions error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

/**
 * Get details of a specific workflow version.
 * GET /api/workflows/:id/versions/:versionId
 */
async function getWorkflowVersion(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ ok: false, error: "not_found" });

    // Validate ownership
    if (workflow.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const version = await workflowVersionService.getVersion(workflow._id, req.params.versionId);
    if (!version) return res.status(404).json({ ok: false, error: "version_not_found" });

    res.json({ ok: true, version });
  } catch (err) {
    console.error("getWorkflowVersion error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

/**
 * Roll back a workflow to a specific version.
 * POST /api/workflows/:id/rollback/:versionId
 */
async function rollbackWorkflow(req, res) {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ ok: false, error: "not_found" });

    // Validate ownership
    if (workflow.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const updatedWorkflow = await workflowVersionService.rollback(workflow, req.params.versionId, req.user._id);
    res.json({ ok: true, workflow: updatedWorkflow });
  } catch (err) {
    console.error("rollbackWorkflow error", err);
    if (err.message === "version_not_found") {
      return res.status(404).json({ ok: false, error: "version_not_found" });
    }
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

module.exports = {
  listWorkflowVersions,
  getWorkflowVersion,
  rollbackWorkflow
};
