/* H-P1-7 — Agent Memory Cross-User Isolation security regression tests.
 *
 * Verifies that retrieveMemory() in memoryService.js enforces
 * per-user ownership at the service boundary (defense-in-depth) so
 * that a future or internal caller cannot retrieve another user's
 * agent memories, even if a higher-level check is bypassed. */

const mongoose = require('mongoose');

jest.mock('../models/agent.model', () => {
  const Agent = jest.fn();
  Agent.findOne = jest.fn();
  return Agent;
});

jest.mock('../models/agentMemory.model', () => {
  const AgentMemory = jest.fn();
  AgentMemory.find = jest.fn();
  AgentMemory.create = jest.fn();
  AgentMemory.countDocuments = jest.fn();
  AgentMemory.deleteMany = jest.fn();
  return AgentMemory;
});

jest.mock('../agents/embeddingAdapter', () => ({
  runEmbedding: jest.fn(async (text) => {
    /* Deterministic pseudo-embedding so scoring is predictable. */
    return [1, 0, 0];
  }),
}));

const Agent = require('../models/agent.model');
const AgentMemory = require('../models/agentMemory.model');
const { runEmbedding } = require('../agents/embeddingAdapter');
const { retrieveMemory, storeMemory } = require('../services/memoryService');

const USER_A = new mongoose.Types.ObjectId();
const USER_B = new mongoose.Types.ObjectId();
const AGENT_A = new mongoose.Types.ObjectId();
const AGENT_B = new mongoose.Types.ObjectId();

const agentA = { _id: AGENT_A, userId: USER_A, config: { provider: 'groq' } };
const agentB = { _id: AGENT_B, userId: USER_B, config: { provider: 'groq' } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('memoryService.retrieveMemory — cross-user isolation (H-P1-7)', () => {
  test('User A can retrieve memory belonging to User A agent', async () => {
    Agent.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: AGENT_A }) }) });
    AgentMemory.find.mockReturnValue({ lean: async () => [] });

    const result = await retrieveMemory(agentA, 'hello world', USER_A, 5, 0.45);

    expect(Array.isArray(result)).toBe(true);
    expect(Agent.findOne).toHaveBeenCalledWith({ _id: AGENT_A, userId: USER_A.toString() });
  });

  test('User A CANNOT retrieve memory belonging to User B agent', async () => {
    /* The DB-side ownership lookup returns null when the agent does
     * not belong to the requesting user. */
    Agent.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });

    await expect(retrieveMemory(agentB, 'hello world', USER_A, 5, 0.45)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    /* No memory query must be issued once ownership fails. */
    expect(AgentMemory.find).not.toHaveBeenCalled();
  });

  test('Agent with forged userId is rejected (defense-in-depth)', async () => {
    /* The in-memory agent claims to belong to USER_A but the DB has
     * no such (agentId, userId) tuple. This simulates a forged
     * payload from a future/internal caller. */
    const forged = { _id: AGENT_B, userId: USER_A, config: {} };
    Agent.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });

    await expect(retrieveMemory(forged, 'hello', USER_A, 5, 0.45)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  test('Nonexistent agent is rejected safely', async () => {
    Agent.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
    const ghost = { _id: new mongoose.Types.ObjectId(), userId: USER_A, config: {} };

    await expect(retrieveMemory(ghost, 'hello', USER_A, 5, 0.45)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  test('Missing userId is rejected (fail closed)', async () => {
    await expect(retrieveMemory(agentA, 'hello', undefined, 5, 0.45)).rejects.toMatchObject({
      code: 'USER_CONTEXT_REQUIRED',
    });

    await expect(retrieveMemory(agentA, 'hello', null, 5, 0.45)).rejects.toMatchObject({
      code: 'USER_CONTEXT_REQUIRED',
    });

    await expect(retrieveMemory(agentA, 'hello', '', 5, 0.45)).rejects.toMatchObject({
      code: 'USER_CONTEXT_REQUIRED',
    });
  });

  test('Legacy (agent, query, topK) call shape is rejected to fail closed', async () => {
    /* If an old call site is ever reintroduced without passing userId,
     * the function must refuse to run rather than silently return
     * cross-user data. */
    await expect(retrieveMemory(agentA, 'hello', 5)).rejects.toMatchObject({
      code: 'USER_CONTEXT_REQUIRED',
    });
  });

  test('Missing agent is rejected safely', async () => {
    await expect(retrieveMemory(null, 'hello', USER_A, 5, 0.45)).rejects.toMatchObject({
      code: 'AGENT_REQUIRED',
    });
  });

  test('Mismatched userId (string vs ObjectId) is rejected', async () => {
    /* USER_B is the real owner of agentB; passing USER_A in any
     * representation must fail. */
    Agent.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
    await expect(retrieveMemory(agentB, 'hello', USER_A.toString(), 5, 0.45)).rejects.toMatchObject(
      { code: 'FORBIDDEN' }
    );
  });

  test('Successful retrieval still returns scored memories (behavior preserved)', async () => {
    Agent.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: AGENT_A }) }) });
    AgentMemory.find.mockReturnValue({
      lean: async () => [
        {
          _id: new mongoose.Types.ObjectId(),
          agentId: AGENT_A,
          content: 'a long enough conversation content string',
          embedding: [1, 0, 0],
          metadata: { type: 'conversation' },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          agentId: AGENT_A,
          content: 'another sufficiently long memory payload',
          embedding: [0, 1, 0],
          metadata: { type: 'conversation' },
        },
      ],
    });

    const result = await retrieveMemory(agentA, 'hello', USER_A, 5, 0.45);

    expect(result.length).toBe(2);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    /* Embedding adapter must have been invoked for the query. */
    expect(runEmbedding).toHaveBeenCalledWith('hello', agentA);
  });

  test('storeMemory is not subject to ownership checks (write path, not retrieval)', async () => {
    /* storeMemory is called by the same internal flow that already
     * authenticated the request via the executor. It must remain
     * usable from internal callers without re-checking userId. */
    AgentMemory.create.mockResolvedValue({});
    AgentMemory.countDocuments.mockResolvedValue(0);

    await expect(
      storeMemory(agentA, 'a conversation with enough characters to pass length check', {})
    ).resolves.toBeUndefined();
  });
});
