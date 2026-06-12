const WorkflowVersion = require("../models/workflowVersion.model");
const Workflow = require("../models/workflow.model");

/**
 * Check if the current workflow configuration has changed compared to the latest version snapshot.
 */
function hasConfigChanged(workflow, latestVersion) {
  if (!latestVersion) return true;
  
  const snapshot = latestVersion.workflowSnapshot;
  if (!snapshot) return true;

  if (workflow.name !== snapshot.name) return true;
  if (workflow.description !== snapshot.description) return true;
  if (String(workflow.agentId || "") !== String(snapshot.agentId || "")) return true;

  // Retrieve steps and edges
  const steps1 = workflow.metadata?.steps || [];
  const steps2 = snapshot.metadata?.steps || [];
  if (JSON.stringify(steps1) !== JSON.stringify(steps2)) return true;

  const edges1 = workflow.metadata?.edges || [];
  const edges2 = snapshot.metadata?.edges || [];
  if (JSON.stringify(edges1) !== JSON.stringify(edges2)) return true;

  return false;
}

/**
 * Create a new workflow version if there are configuration changes since the latest version.
 */
async function createVersionIfNeeded(workflow, userId, note = "") {
  // Find latest version for workflow
  const latestVersion = await WorkflowVersion.findOne({ workflowId: workflow._id }).sort({ versionNumber: -1 });

  if (latestVersion && !hasConfigChanged(workflow, latestVersion)) {
    return latestVersion; // No change, return latest version
  }

  let nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  const workflowSnapshot = {
    name: workflow.name,
    description: workflow.description || "",
    agentId: workflow.agentId || null,
    metadata: {
      steps: JSON.parse(JSON.stringify(workflow.metadata?.steps || [])),
      edges: JSON.parse(JSON.stringify(workflow.metadata?.edges || []))
    }
  };

  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    try {
      const newVersion = await WorkflowVersion.create({
        workflowId: workflow._id,
        versionNumber: nextVersionNumber,
        workflowSnapshot,
        createdBy: userId || null,
        note
      });
      return newVersion;
    } catch (err) {
      // Handle parallel/concurrent creation of identical versionNumbers (e.g. compound unique index violation)
      if (err.code === 11000 && attempts < maxAttempts - 1) {
        attempts++;
        const currentLatest = await WorkflowVersion.findOne({ workflowId: workflow._id }).sort({ versionNumber: -1 });
        nextVersionNumber = currentLatest ? currentLatest.versionNumber + 1 : 1;
        // loop and retry with the new version number
        continue;
      }
      throw err;
    }
  }
}

/**
 * Create a retry-safe workflow version snapshot during rollback to prevent duplicate key errors.
 */
async function createRollbackSnapshot(workflow, userId = null, note = "") {
  const workflowSnapshot = {
    name: workflow.name,
    description: workflow.description || "",
    agentId: workflow.agentId || null,
    metadata: {
      steps: JSON.parse(JSON.stringify(workflow.metadata?.steps || [])),
      edges: JSON.parse(JSON.stringify(workflow.metadata?.edges || []))
    }
  };

  const latestVersion = await WorkflowVersion.findOne({ workflowId: workflow._id }).sort({ versionNumber: -1 });
  let nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  let attempts = 0;
  const maxAttempts = 4; // 1 initial attempt + 3 retries
  while (attempts < maxAttempts) {
    try {
      const newVersion = await WorkflowVersion.create({
        workflowId: workflow._id,
        versionNumber: nextVersionNumber,
        workflowSnapshot,
        createdBy: userId || null,
        note
      });
      return newVersion;
    } catch (err) {
      if (err.code === 11000 && attempts < maxAttempts - 1) {
        attempts++;
        const currentLatest = await WorkflowVersion.findOne({ workflowId: workflow._id }).sort({ versionNumber: -1 });
        nextVersionNumber = currentLatest ? currentLatest.versionNumber + 1 : 1;
        continue;
      }
      throw err;
    }
  }

  throw new Error("Failed to create rollback snapshot: retries exhausted due to concurrent version conflicts");
}

/**
 * Get all versions for a workflow, sorted by versionNumber descending.
 */
async function listVersions(workflowId) {
  return await WorkflowVersion.find({ workflowId })
    .populate("createdBy", "name email")
    .sort({ versionNumber: -1 });
}

/**
 * Get details of a single workflow version.
 */
async function getVersion(workflowId, versionId) {
  return await WorkflowVersion.findOne({ _id: versionId, workflowId })
    .populate("createdBy", "name email");
}

/**
 * Roll back workflow to a specific version.
 * Saves current state as a new version, then restores target snapshot configuration.
 */
async function rollback(workflow, versionId, userId) {
  const selectedVersion = await WorkflowVersion.findOne({ _id: versionId, workflowId: workflow._id });
  if (!selectedVersion) {
    throw new Error("version_not_found");
  }

  // 1. Snapshot current configuration state to save as a pre-rollback version
  await createRollbackSnapshot(workflow, userId, `Pre-rollback to v${selectedVersion.versionNumber}`);

  // 2. Restore selected snapshot configuration
  const targetSnapshot = selectedVersion.workflowSnapshot;
  workflow.name = targetSnapshot.name;
  workflow.description = targetSnapshot.description || "";
  workflow.agentId = targetSnapshot.agentId || null;
  workflow.metadata = {
    steps: targetSnapshot.metadata?.steps || [],
    edges: targetSnapshot.metadata?.edges || []
  };

  workflow.markModified("metadata");
  await workflow.save();

  return workflow;
}

module.exports = {
  createVersionIfNeeded,
  listVersions,
  getVersion,
  rollback
};
