// backend/src/tests/tokenUsage.handler.test.js
//
// Issue #281 — dashboard token-usage endpoint.
//
// Tests the aggregate (`getTokenUsage`) against an in-memory mock of
// the `Task` model's `.aggregate()` chain. The shape we're pinning is
// the *frontend contract*: total, providers list in stable order,
// provider status (active/inactive/no_usage), per-model breakdown, and
// the "limit: null → Unlimited" sentinel.

const {
  getDashboardStats,
  getExecutionTrend,
  getLiveWorkflowStatus,
  getTokenUsage,
} = require('../controllers/dashboard.controller');

// ── Mock the `Task` model used inside the controller ─────────────────
// The controller does `await Task.aggregate([...])`, so we replace
// the in-process model with a stub that returns canned rows based on
// the first pipeline stage's `$match`. We don't assert the pipeline
// shape (MongoDB query introspection is fragile across versions); we
// just verify the *outward* response contract.
jest.mock('../models/task.model', () => {
  const stub = {
    _aggregateReturn: { primary: [], models: [] },
    aggregate: jest.fn(async () => stub._aggregateReturn.primary),
    setAggregateReturn(primary, models) {
      stub._aggregateReturn.primary = primary;
      stub._aggregateReturn.models = models;
    },
    setModelAggregateReturn(rows) {
      stub._aggregateReturn.models = rows;
    },
    countDocuments: jest.fn(async () => 0),
    find: jest.fn(async () => []),
  };
  return stub;
});

// Override `aggregate()` so the *second* call (the per-model breakdown
// pipeline) returns the canned model rows. The test base for the call
// order is:
//   1st.aggregate()  — primary per-provider totals + lastCallAt
//   2nd.aggregate()  — per-provider per-model breakdown
const Task = require('../models/task.model');
Task.aggregate.mockImplementation(async (pipeline) => {
  // Sniff the pipeline: per-model breakdowns group on `{ provider,
  // model }` in the $group _id. The per-provider group uses bare
  // `$stepResults.metrics.tokenUsage.provider` as _id (string).
  const groupStage = pipeline.find((s) => s.$group);
  const idShape = groupStage?.$group?._id;
  if (idShape && typeof idShape === 'object' && (idShape.provider || idShape.model)) {
    return Task._aggregateReturn.models;
  }
  return Task._aggregateReturn.primary;
});

// ── Mock res + req helper ────────────────────────────────────────────
function mockReq() {
  return { user: { _id: 'user-123' }, query: {} };
}

function mockRes() {
  return {
    statusCode: 200,
    _payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this._payload = payload;
    },
  };
}

describe('getTokenUsage (Issue #281) — dashboard token-usage endpoint', () => {
  beforeEach(() => {
    Task.setAggregateReturn([], []);
    Task.aggregate.mockClear();
  });

  it('returns ok:true and a zeroed response when no LLM steps recorded usage', async () => {
    const req = mockReq();
    const res = mockRes();
    await getTokenUsage(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._payload.ok).toBe(true);
    expect(res._payload.totalTokens).toBe(0);
    expect(res._payload.totalCalls).toBe(0);
    // Uint limit: null = "Unlimited" sentinel
    expect(res._payload.limit).toBeNull();
    // Every known provider must appear, in stable order, with no_usage
    expect(res._payload.providers.map((p) => p.provider)).toEqual([
      'groq',
      'openai',
      'gemini',
      'ollama',
      'huggingface',
    ]);
    expect(res._payload.providers.every((p) => p.status === 'no_usage')).toBe(true);
    expect(res._payload.providers.every((p) => p.calls === 0 && p.totalTokens === 0)).toBe(true);
    // ISO timestamp — sanity check that it parses
    expect(() => new Date(res._payload.lastUpdatedAt).toISOString()).not.toThrow();
  });

  it('sums per-provider totals from the aggregate', async () => {
    Task.setAggregateReturn(
      [
        {
          _id: 'groq',
          totalTokens: 42310,
          promptTokens: 38200,
          completionTokens: 4110,
          calls: 12,
          lastCallAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago → active
        },
        {
          _id: 'openai',
          totalTokens: 18421,
          promptTokens: 16000,
          completionTokens: 2421,
          calls: 4,
          lastCallAt: new Date('2026-01-01T00:00:00Z'), // stale → inactive
        },
      ],
      [
        {
          _id: { provider: 'groq', model: 'llama-3.1-8b-instant' },
          tokens: 42310,
          calls: 12,
          lastCallAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          _id: { provider: 'openai', model: 'gpt-4o-mini' },
          tokens: 10000,
          calls: 2,
          lastCallAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          _id: { provider: 'openai', model: 'gpt-4o' },
          tokens: 8421,
          calls: 2,
          lastCallAt: new Date('2026-01-02T00:00:00Z'),
        },
      ]
    );

    const req = mockReq();
    const res = mockRes();
    await getTokenUsage(req, res);

    expect(res._payload.totalTokens).toBe(42310 + 18421);
    expect(res._payload.totalCalls).toBe(12 + 4);

    const groq = res._payload.providers.find((p) => p.provider === 'groq');
    expect(groq.totalTokens).toBe(42310);
    expect(groq.status).toBe('active');
    expect(groq.calls).toBe(12);
    expect(groq.models).toHaveLength(1);
    expect(groq.models[0]).toEqual({
      model: 'llama-3.1-8b-instant',
      tokens: 42310,
      calls: 12,
      lastCallAt: expect.any(Date),
    });

    const openai = res._payload.providers.find((p) => p.provider === 'openai');
    expect(openai.totalTokens).toBe(18421);
    expect(openai.status).toBe('inactive');
    // Per-model breakdown sorted by tokens desc — gpt-4o-mini (10k) > gpt-4o (8421)
    expect(openai.models.map((m) => m.model)).toEqual(['gpt-4o-mini', 'gpt-4o']);
  });

  it('provider "Active" is reserved for calls within the 24h window', async () => {
    Task.setAggregateReturn(
      [
        {
          _id: 'gemini',
          totalTokens: 9812,
          promptTokens: 9000,
          completionTokens: 812,
          calls: 5,
          lastCallAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago → inactive
        },
      ],
      []
    );

    const req = mockReq();
    const res = mockRes();
    await getTokenUsage(req, res);

    const gemini = res._payload.providers.find((p) => p.provider === 'gemini');
    expect(gemini.status).toBe('inactive');
  });

  it('drops providers with no recorded activity to the "no_usage" row', async () => {
    Task.setAggregateReturn(
      [
        {
          _id: 'ollama',
          totalTokens: 50,
          promptTokens: 20,
          completionTokens: 30,
          calls: 1,
          lastCallAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      ],
      []
    );

    const req = mockReq();
    const res = mockRes();
    await getTokenUsage(req, res);

    const names = res._payload.providers.map((p) => p.provider);
    expect(names).toEqual(['groq', 'openai', 'gemini', 'ollama', 'huggingface']);
    const ollama = res._payload.providers.find((p) => p.provider === 'ollama');
    expect(ollama.totalTokens).toBe(50);
    expect(ollama.status).toBe('active');
    // Providers with no aggregate row appear as zero/no_usage rather than being omitted.
    for (const name of ['groq', 'openai', 'gemini', 'huggingface']) {
      const p = res._payload.providers.find((p) => p.provider === name);
      expect(p.status).toBe('no_usage');
      expect(p.totalTokens).toBe(0);
      expect(p.calls).toBe(0);
    }
  });

  it('returns 500 server_error on aggregate failure', async () => {
    Task.aggregate.mockRejectedValueOnce(new Error('mongo disconnected'));

    const req = mockReq();
    const res = mockRes();
    await getTokenUsage(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._payload.ok).toBe(false);
    expect(res._payload.error).toBe('server_error');
  });
});

// Suppress noise from the unrelated `getDashboardStats`,
// `getExecutionTrend`, `getLiveWorkflowStatus` exports — we just confirm
// they still re-export without crashing, so the route-wire-up can
// resolve them at app boot.
describe('dashboard.controller exports remain intact for sibling routes', () => {
  it('all four handlers are exported', () => {
    expect(typeof getDashboardStats).toBe('function');
    expect(typeof getExecutionTrend).toBe('function');
    expect(typeof getLiveWorkflowStatus).toBe('function');
    expect(typeof getTokenUsage).toBe('function');
  });
});
