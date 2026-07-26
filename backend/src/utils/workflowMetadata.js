/**
 * Canonical workflow graph storage lives on workflow.metadata.{steps,edges}.
 * Use these helpers at every create/update boundary so insights, runner, and
 * scheduler all read a consistent shape.
 */

const crypto = require('crypto');

function normalizeWorkflowMetadata(metadata) {
  const source = metadata && typeof metadata === 'object' ? metadata : {};

  return {
    steps: Array.isArray(source.steps) ? source.steps : [],
    edges: Array.isArray(source.edges) ? source.edges : [],
  };
}

function getWorkflowGraph(workflow) {
  return normalizeWorkflowMetadata(workflow?.metadata);
}

function computeGraphHash(steps, edges) {
  const sortedSteps = [...(steps || [])]
    .map((s) => {
      const sId = s.stepId || s.id || s.name;
      return {
        id: sId,
        type: s.type,
        config: s.config || {},
      };
    })
    .sort((a, b) => {
      if (!a.id || !b.id) return 0;
      return a.id.localeCompare(b.id);
    });

  const sortedEdges = [...(edges || [])]
    .map((e) => ({
      source: e.source,
      target: e.target,
      condition: e.condition || null,
      caseValue: e.caseValue || null,
    }))
    .sort((a, b) => {
      if (!a.source || !b.source) return 0;
      const cmp = a.source.localeCompare(b.source);
      if (cmp !== 0) return cmp;
      if (!a.target || !b.target) return 0;
      return a.target.localeCompare(b.target);
    });

  const payload = JSON.stringify({ steps: sortedSteps, edges: sortedEdges });
  return crypto.createHash('sha1').update(payload).digest('hex');
}

module.exports = {
  normalizeWorkflowMetadata,
  getWorkflowGraph,
  computeGraphHash,
};
