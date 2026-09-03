const Agent = require('../models/agent.model');
const AgentMemory = require('../models/agentMemory.model');
const { runEmbedding } = require('../agents/embeddingAdapter');

/* -------- Cosine Similarity -------- */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;

  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* -------- Ownership verification --------
 * Defense-in-depth: the executor already enforces that the workflow's
 * agent belongs to context.userId, but retrieveMemory() must not rely on
 * callers. This helper re-verifies ownership against the Agent collection
 * and throws on any mismatch / missing context.
 */
async function assertAgentOwnership(agent, userId) {
  if (!agent || !agent._id) {
    const err = new Error('agent_required');
    err.code = 'AGENT_REQUIRED';
    throw err;
  }
  if (userId === undefined || userId === null || userId === '') {
    const err = new Error('user_context_required');
    err.code = 'USER_CONTEXT_REQUIRED';
    throw err;
  }

  const ownerId = agent.userId;
  const agentOwnerStr = ownerId ? ownerId.toString() : null;
  const requestUserStr = userId.toString();

  if (!agentOwnerStr || agentOwnerStr !== requestUserStr) {
    const err = new Error('forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }

  /* Re-check against the database so an in-memory `agent` with a forged
   * userId cannot bypass the check. */
  const owner = await Agent.findOne({ _id: agent._id, userId: requestUserStr })
    .select({ _id: 1 })
    .lean();
  if (!owner) {
    const err = new Error('forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
}

/* -------- Store Memory -------- */
async function storeMemory(agent, content, metadata = {}) {
  const embedding = await runEmbedding(content, agent);

  if (!content || content.length < 20) {
    return;
  }

  await AgentMemory.create({
    agentId: agent._id,
    content,
    embedding,
    metadata,

    embeddingProvider: agent?.config?.provider || null,
    embeddingModel: agent?.config?.embeddingModel || agent?.config?.model || null,
  });

  /* -------- Retention Policy -------- */
  const MAX_MEMORIES_PER_AGENT = 500;

  const count = await AgentMemory.countDocuments({
    agentId: agent._id,
  });

  if (count > MAX_MEMORIES_PER_AGENT) {
    const excess = count - MAX_MEMORIES_PER_AGENT;

    const oldest = await AgentMemory.find({
      agentId: agent._id,
      'metadata.type': 'conversation',
    })
      .sort({ createdAt: 1 }) // oldest first
      .limit(excess)
      .select('_id');

    const ids = oldest.map((m) => m._id);

    await AgentMemory.deleteMany({
      _id: { $in: ids },
    });
  }
}

/* -------- Retrieve Top-K -------- */
/* userId is the authenticated user performing the retrieval. It MUST be
 * passed explicitly by the caller (req.user._id in controllers, or
 * context.userId in workflow handlers). retrieveMemory() will refuse to
 * run if the agent does not belong to that user. */
async function retrieveMemory(agent, queryText, userId, topK = 5, minScore = 0.45) {
  /* Backward-compat: if a caller still passes (agent, query, topK) the
   * `userId` slot will be a number. Detect that and fail closed. */
  if (typeof userId === 'number') {
    const err = new Error('user_context_required');
    err.code = 'USER_CONTEXT_REQUIRED';
    throw err;
  }

  await assertAgentOwnership(agent, userId);

  const queryEmbedding = await runEmbedding(queryText, agent);

  const memories = await AgentMemory.find({
    agentId: agent._id,
    'metadata.type': 'conversation',
  }).lean();

  const scored = memories
    .map((m) => ({
      ...m,
      score: cosineSimilarity(queryEmbedding, m.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  console.log(
    scored.map((m) => ({
      score: m.score.toFixed(3),
      preview: m.content.slice(0, 60),
    }))
  );

  return scored;
}

module.exports = {
  storeMemory,
  retrieveMemory,
  assertAgentOwnership,
};
