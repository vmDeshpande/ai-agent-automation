/**
 * Canonical workflow graph storage lives on workflow.metadata.{steps,edges}.
 * Use these helpers at every create/update boundary so insights, runner, and
 * scheduler all read a consistent shape.
 */

function normalizeWorkflowMetadata(metadata) {
  const source = metadata && typeof metadata === "object" ? metadata : {};

  return {
    steps: Array.isArray(source.steps) ? source.steps : [],
    edges: Array.isArray(source.edges) ? source.edges : [],
  };
}

function getWorkflowGraph(workflow) {
  return normalizeWorkflowMetadata(workflow?.metadata);
}

module.exports = {
  normalizeWorkflowMetadata,
  getWorkflowGraph,
};
