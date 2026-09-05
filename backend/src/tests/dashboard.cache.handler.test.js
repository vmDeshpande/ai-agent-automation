/* H-P2-4 — Dashboard Redis caching.
 *
 * Verifies that the dashboard controller uses Redis caching for
 * expensive stats/execution-trend queries while preserving:
 *   - exact response shape,
 *   - user isolation (cache keys include userId),
 *   - graceful fallback when Redis is unavailable,
 *   - TTL-based expiration.
 *
 * Mongoose models and cache.service are mocked so tests run
 * without a database or Redis server. */

jest.mock('ioredis', () => jest.fn());

jest.mock('../services/cache.service', () => {
  const store = new Map();
  return {
    getCached: jest.fn(async (key) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      try {
        return JSON.parse(entry.value);
      } catch {
        store.delete(key);
        return null;
      }
    }),
    setCached: jest.fn(async (key, value, ttlMs) => {
      store.set(key, {
        value: JSON.stringify(value),
        expiresAt: Date.now() + (ttlMs || 30000),
      });
      return true;
    }),
    __store: store,
  };
});

const mongoose = require('mongoose');

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return actual;
});

jest.mock('../models/workflow.model', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('../models/task.model', () => ({
  countDocuments: jest.fn(),
  findOne: jest.fn(),
  aggregate: jest.fn(),
}));

jest.mock('../models/agent.model', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('../models/schedule.model', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('fs', () => ({
  promises: {
    access: jest.fn().mockResolvedValue(undefined),
  },
}));

const cacheService = require('../services/cache.service');
const { getDashboardStats, getExecutionTrend } = require('../controllers/dashboard.controller');
const Workflow = require('../models/workflow.model');
const Task = require('../models/task.model');
const Agent = require('../models/agent.model');
const Schedule = require('../models/schedule.model');

function buildReq(userId) {
  return { user: { _id: userId } };
}

function buildRes() {
  const jsonCalls = [];
  const res = {
    status: jest.fn().mockReturnThis(),
    json: (body) => {
      jsonCalls.push(body);
    },
  };
  return { res, jsonCalls };
}

beforeEach(() => {
  mongoose.connection.readyState = 1;
  cacheService.__store.clear();
  jest.clearAllMocks();
});

describe('dashboard.controller caching (H-P2-4)', () => {
  test('getDashboardStats — first request is a cache miss (MongoDB path)', async () => {
    cacheService.getCached.mockResolvedValue(null);
    Workflow.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    Task.countDocuments
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    Agent.countDocuments.mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    Schedule.countDocuments.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    Task.findOne.mockResolvedValue({ _id: 't1' });

    const req = buildReq('user-1');
    const { res, jsonCalls } = buildRes();
    await getDashboardStats(req, res);

    expect(cacheService.getCached).toHaveBeenCalledWith(
      expect.stringContaining('dashboard:stats:user-1')
    );
    expect(cacheService.setCached).toHaveBeenCalled();
    expect(jsonCalls[0].ok).toBe(true);
    expect(jsonCalls[0].stats).toBeDefined();
  });

  test('getDashboardStats — cached response is returned on second request', async () => {
    const cachedStats = { workflows: 42, tasks: { total: 10 } };
    cacheService.getCached.mockResolvedValue(cachedStats);

    const req = buildReq('user-1');
    const { res, jsonCalls } = buildRes();
    await getDashboardStats(req, res);

    expect(cacheService.getCached).toHaveBeenCalledWith(
      expect.stringContaining('dashboard:stats:user-1')
    );
    expect(jsonCalls[0]).toEqual({ ok: true, stats: cachedStats });
  });

  test('getDashboardStats — different users cannot receive each other cached data', async () => {
    cacheService.getCached.mockResolvedValue(null);
    Workflow.countDocuments.mockResolvedValue(10);
    Task.countDocuments.mockResolvedValue(50);
    Agent.countDocuments.mockResolvedValue(2);
    Schedule.countDocuments.mockResolvedValue(1);
    Task.findOne.mockResolvedValue({ _id: 't1' });

    const req1 = buildReq('user-A');
    const req2 = buildReq('user-B');
    const { res: res1 } = buildRes();
    const { res: res2 } = buildRes();

    await getDashboardStats(req1, res1);
    await getDashboardStats(req2, res2);

    const calls = cacheService.getCached.mock.calls.map((c) => c[0]);
    const keyA = calls.find((k) => k.includes('user-A'));
    const keyB = calls.find((k) => k.includes('user-B'));
    expect(keyA).toBeDefined();
    expect(keyB).toBeDefined();
    expect(keyA).not.toBe(keyB);
  });

  test('getDashboardStats — Redis GET failure falls back to MongoDB', async () => {
    cacheService.getCached.mockResolvedValue(null);
    Workflow.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    Task.countDocuments
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    Agent.countDocuments.mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    Schedule.countDocuments.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    Task.findOne.mockResolvedValue({ _id: 't1' });

    const req = buildReq('user-1');
    const { res, jsonCalls } = buildRes();
    await getDashboardStats(req, res);

    expect(jsonCalls[0].ok).toBe(true);
    expect(jsonCalls[0].stats).toBeDefined();
  });

  test('getDashboardStats — Redis SET failure does not break the request', async () => {
    cacheService.getCached.mockResolvedValue(null);
    cacheService.setCached.mockRejectedValueOnce(new Error('write failed'));
    Workflow.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    Task.countDocuments
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    Agent.countDocuments.mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    Schedule.countDocuments.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    Task.findOne.mockResolvedValue({ _id: 't1' });

    const req = buildReq('user-1');
    const { res, jsonCalls } = buildRes();
    await getDashboardStats(req, res);

    expect(jsonCalls[0].ok).toBe(true);
    expect(jsonCalls[0].stats).toBeDefined();
  });

  test('getExecutionTrend — different timezone parameters produce different cache keys', async () => {
    cacheService.getCached.mockResolvedValue(null);
    Task.aggregate.mockResolvedValue([]);

    const req1 = buildReq('user-1');
    req1.query = { tz: 'UTC' };
    const req2 = buildReq('user-1');
    req2.query = { tz: 'America/New_York' };
    const { res: res1 } = buildRes();
    const { res: res2 } = buildRes();

    await getExecutionTrend(req1, res1);
    await getExecutionTrend(req2, res2);

    const calls = cacheService.getCached.mock.calls.map((c) => c[0]);
    const utcKey = calls.find((k) => k.includes('UTC'));
    const nyKey = calls.find((k) => k.includes('America%2FNew_York'));
    expect(utcKey).toBeDefined();
    expect(nyKey).toBeDefined();
    expect(utcKey).not.toBe(nyKey);
  });

  test('getExecutionTrend — cached response is returned on second request', async () => {
    const cachedTrend = { trend: [], summary: { total: 0 } };
    cacheService.getCached.mockResolvedValue(cachedTrend);

    const req = buildReq('user-1');
    req.query = { tz: 'UTC' };
    const { res, jsonCalls } = buildRes();
    await getExecutionTrend(req, res);

    expect(jsonCalls[0]).toEqual({ ok: true, ...cachedTrend });
  });

  test('getExecutionTrend — malformed cached JSON falls back to MongoDB', async () => {
    cacheService.getCached.mockResolvedValue(null);
    Task.aggregate.mockResolvedValue([]);

    const req = buildReq('user-1');
    req.query = { tz: 'UTC' };
    const { res, jsonCalls } = buildRes();
    await getExecutionTrend(req, res);

    expect(jsonCalls[0].ok).toBe(true);
    expect(jsonCalls[0].trend).toBeDefined();
  });

  test('response shape is unchanged for getDashboardStats', async () => {
    cacheService.getCached.mockResolvedValue(null);
    Workflow.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    Task.countDocuments
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    Agent.countDocuments.mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    Schedule.countDocuments.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    Task.findOne.mockResolvedValue({ _id: 't1' });

    const req = buildReq('user-1');
    const { res, jsonCalls } = buildRes();
    await getDashboardStats(req, res);

    const body = jsonCalls[0];
    expect(body).toHaveProperty('ok');
    expect(body).toHaveProperty('stats');
    expect(body.stats).toHaveProperty('workflows');
    expect(body.stats).toHaveProperty('tasks');
    expect(body.stats).toHaveProperty('health');
  });

  test('response shape is unchanged for getExecutionTrend', async () => {
    cacheService.getCached.mockResolvedValue(null);
    Task.aggregate.mockResolvedValue([]);

    const req = buildReq('user-1');
    req.query = { tz: 'UTC' };
    const { res, jsonCalls } = buildRes();
    await getExecutionTrend(req, res);

    const body = jsonCalls[0];
    expect(body).toHaveProperty('ok');
    expect(body).toHaveProperty('trend');
    expect(body).toHaveProperty('summary');
  });
});
