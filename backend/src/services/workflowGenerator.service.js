const { runLLM } = require('../agents/llmAdapter');
const { generatedWorkflowSchema } = require('../workflow/workflowGenerator.schema');

const STEP_TYPE_GUIDE = `
- delay: config { seconds (number, required) }
- llm: config { prompt (required), useMemory?, memoryTopK? }
- http: config { method (GET|POST|PUT|DELETE, required), url (required), body?, maxRetries?, backoffMultiplier? }
- file: config { action (read|write|append|remove|list, required), path (required), content? }
- email: config { to (required), subject (required), text?, html? }
- browser: config { action (screenshot|evaluate, required), url (required), code? }
- document_query: config { documentId (required), query (required), topK? }
- condition: config { conditionType (contains|boolean, required), value? }. Must have exactly two outgoing edges: one with condition "true", one with condition "false".
- switch: config {}. Routes based on the previous step's output text. Each outgoing edge needs a caseValue string to match against; at most one fallback edge may omit caseValue.
`.trim();

const SYSTEM_PROMPT = `You are a workflow graph generator for an AI automation platform.
Given a plain-English description, output ONLY a JSON object (no markdown fences, no commentary) with this shape:
{ "steps": [ { "stepId": "...", "name": "...", "type": "...", "config": { ... } } ], "edges": [ { "source": "...", "target": "...", "condition"?: "true"|"false", "caseValue"?: "..." } ] }

Rules:
- stepId values must be short, unique, lowercase, snake_case.
- type must be one of: delay, llm, http, file, email, browser, document_query, condition, switch.
${STEP_TYPE_GUIDE}
- To reference a previous step's output inside a prompt or field, use the placeholder {{steps.<stepId>.output}}. Use {{input.<field>}} to reference the original task input.
- Every step except the last in a chain must have at least one outgoing edge. The graph must be connected and acyclic.
- Do not invent step types outside the allowed list.
- Output strictly valid JSON. No trailing commas, no comments.`;

function buildUserPrompt(description, existingGraph) {
  if (existingGraph && Array.isArray(existingGraph.steps) && existingGraph.steps.length > 0) {
    return `Here is the current workflow graph:\n${JSON.stringify(existingGraph, null, 2)}\n\nApply this change and return the FULL updated graph (all steps and edges, not just the diff):\n${description}`;
  }
  return `Build a workflow for this request:\n${description}`;
}

function extractJsonPayload(text) {
  if (typeof text !== 'string') {
    throw new Error('LLM returned non-string output');
  }
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in LLM output');
  }
  const jsonSlice = cleaned.slice(start, end + 1);
  return JSON.parse(jsonSlice);
}

function assignPositions(steps, edges) {
  const incoming = new Map();
  steps.forEach((s) => incoming.set(s.stepId, 0));
  edges.forEach((e) => {
    if (incoming.has(e.target)) incoming.set(e.target, incoming.get(e.target) + 1);
  });

  const depth = new Map();
  const queue = steps.filter((s) => incoming.get(s.stepId) === 0).map((s) => s.stepId);
  queue.forEach((id) => depth.set(id, 0));

  let cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor++];
    const currentDepth = depth.get(id);
    edges
      .filter((e) => e.source === id)
      .forEach((e) => {
        const nextDepth = currentDepth + 1;
        if (!depth.has(e.target) || depth.get(e.target) < nextDepth) {
          depth.set(e.target, nextDepth);
        }
        if (!queue.includes(e.target)) queue.push(e.target);
      });
  }

  const countPerDepth = new Map();
  return steps.map((s) => {
    const d = depth.get(s.stepId) ?? 0;
    const col = countPerDepth.get(d) || 0;
    countPerDepth.set(d, col + 1);
    return {
      ...s,
      position: { x: col * 280, y: d * 180 },
    };
  });
}

function buildStepRecords(steps) {
  return steps.map((s) => ({
    stepId: s.stepId,
    name: s.name,
    type: s.type,
    position: s.position,
    config: s.config || {},
  }));
}

function buildEdgeRecords(edges) {
  return edges.map((e, i) => ({
    id: `${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: '',
    condition: e.condition || null,
    caseValue: e.caseValue || null,
    animated: true,
    style: { strokeWidth: 2 },
  }));
}

async function generateWorkflowGraph({ description, existingGraph, agent } = {}) {
  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new Error('description is required');
  }

  const prompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(description, existingGraph)}`;

  const llmResult = await runLLM(prompt, {
    provider: agent?.config?.provider,
    model: agent?.config?.model,
    temperature: 0.2,
    maxTokens: 2000,
  });

  const rawPayload = extractJsonPayload(llmResult.text);
  const parsed = generatedWorkflowSchema.safeParse(rawPayload);

  if (!parsed.success) {
    const err = new Error('Generated workflow failed schema validation');
    err.details = parsed.error.format();
    throw err;
  }

  const stepIds = new Set(parsed.data.steps.map((s) => s.stepId));
  const duplicateIds = parsed.data.steps
    .map((s) => s.stepId)
    .filter((id, i, arr) => arr.indexOf(id) !== i);
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate stepIds in generated workflow: ${duplicateIds.join(', ')}`);
  }
  const danglingEdges = parsed.data.edges.filter(
    (e) => !stepIds.has(e.source) || !stepIds.has(e.target)
  );
  if (danglingEdges.length > 0) {
    throw new Error('Generated workflow has edges referencing unknown steps');
  }

  const positioned = assignPositions(parsed.data.steps, parsed.data.edges);

  return {
    steps: buildStepRecords(positioned),
    edges: buildEdgeRecords(parsed.data.edges),
  };
}

module.exports = {
  generateWorkflowGraph,
  extractJsonPayload,
  assignPositions,
  buildUserPrompt,
};