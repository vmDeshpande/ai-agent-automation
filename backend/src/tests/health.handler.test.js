/* H-P2-3 — Health Check Endpoint Validation.
 *
 * Verifies the /health (liveness) and /ready (readiness) endpoints:
 *   - /health returns 200 with the expected lightweight shape,
 *     independent of database state.
 *   - /ready returns 200 when MongoDB is connected and pingable.
 *   - /ready returns 503 when MongoDB is disconnected or ping fails.
 *   - /ready does not leak internal error details.
 *   - /ready does not hang indefinitely (bounded ping timeout).
 *   - Health endpoints do not require authentication.
 *   - Worker health is intentionally not checked (no registration
 *     mechanism exists in the current architecture).
 */

const mongoose = require('mongoose');

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return actual;
});

const { getHealth, getReady } = require('../controllers/health.controller');

function mockMongooseConnection(state) {
  if (!mongoose.connection.db) {
    mongoose.connection.db = {};
  }
  mongoose.connection.readyState = state;
  const pingMock = jest.fn().mockResolvedValue({ ok: 1 });
  mongoose.connection.db.admin = () => ({
    ping: pingMock,
  });
  return { connection: mongoose.connection, pingMock };
}

function buildRes() {
  const statusCalls = [];
  const jsonCalls = [];
  const res = {
    status: (code) => {
      statusCalls.push(code);
      return {
        json: (body) => {
          jsonCalls.push(body);
        },
      };
    },
    json: (body) => {
      jsonCalls.push(body);
    },
  };
  return { res, statusCalls, jsonCalls };
}

describe('health.controller (H-P2-3)', () => {
  afterEach(() => {
    mongoose.connection.readyState = 0;
    mongoose.connection.db = null;
  });

  describe('getHealth — liveness', () => {
    test('returns 200 with the expected lightweight shape', () => {
      const { res, jsonCalls } = buildRes();
      getHealth({}, res);
      expect(jsonCalls[0]).toMatchObject({ ok: true, ts: expect.any(Number) });
    });

    test('does not depend on MongoDB state', () => {
      mockMongooseConnection(0); // disconnected
      const { res, jsonCalls } = buildRes();
      getHealth({}, res);
      expect(jsonCalls[0]).toMatchObject({ ok: true });
    });

    test('response shape is stable (ok + ts)', () => {
      const { res, jsonCalls } = buildRes();
      getHealth({}, res);
      const body = jsonCalls[0];
      expect(Object.keys(body).sort()).toEqual(['ok', 'ts']);
      expect(body.ok).toBe(true);
      expect(typeof body.ts).toBe('number');
    });
  });

  describe('getReady — readiness', () => {
    test('returns 200 when MongoDB is connected and pingable', async () => {
      mockMongooseConnection(1);
      const { res, statusCalls, jsonCalls } = buildRes();
      await getReady({}, res);
      expect(statusCalls).toEqual([200]);
      const body = jsonCalls[0];
      expect(body.ok).toBe(true);
      expect(body.status).toBe('ready');
      expect(body.checks.database.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
    });

    test('returns 503 when MongoDB is disconnected', async () => {
      mockMongooseConnection(0);
      const { res, statusCalls, jsonCalls } = buildRes();
      await getReady({}, res);
      expect(statusCalls).toEqual([503]);
      const body = jsonCalls[0];
      expect(body.ok).toBe(false);
      expect(body.status).toBe('not_ready');
      expect(body.checks.database.status).toBe('unhealthy');
    });

    test('returns 503 when MongoDB is connecting (not yet ready)', async () => {
      mockMongooseConnection(2);
      const { res, statusCalls } = buildRes();
      await getReady({}, res);
      expect(statusCalls).toEqual([503]);
    });

    test('returns 503 when MongoDB ping fails', async () => {
      const { pingMock } = mockMongooseConnection(1);
      pingMock.mockRejectedValueOnce(new Error('connection reset'));
      const { res, statusCalls, jsonCalls } = buildRes();
      await getReady({}, res);
      expect(statusCalls).toEqual([503]);
      expect(jsonCalls[0].checks.database.status).toBe('unhealthy');
    });

    test('does not leak raw error messages or stack traces', async () => {
      const { pingMock } = mockMongooseConnection(1);
      pingMock.mockRejectedValueOnce(new Error('mongodb://user:secret@host:27017/db'));
      const { res, jsonCalls } = buildRes();
      await getReady({}, res);
      const body = jsonCalls[0];
      expect(body.checks.database.message).not.toContain('secret');
      expect(body.checks.database.message).not.toContain('mongodb://');
      expect(body.error).toBeUndefined();
    });

    test('does not hang indefinitely when ping times out', async () => {
      const { pingMock } = mockMongooseConnection(1);
      pingMock.mockImplementationOnce(() => new Promise(() => {})); // never resolves
      const { res, statusCalls } = buildRes();
      const start = Date.now();
      await getReady({}, res);
      const elapsed = Date.now() - start;
      expect(statusCalls).toEqual([503]);
      expect(elapsed).toBeLessThan(5000); // bounded by 3s timeout + small overhead
    });

    test('worker is intentionally not part of readiness', async () => {
      mockMongooseConnection(1);
      const { res, jsonCalls } = buildRes();
      await getReady({}, res);
      const body = jsonCalls[0];
      expect(body.checks.worker).toBeUndefined();
      expect(body.checks.workers).toBeUndefined();
    });

    test('response includes timestamp for both ready and not_ready', async () => {
      mockMongooseConnection(1);
      const { res: res1, jsonCalls: j1 } = buildRes();
      await getReady({}, res1);
      expect(j1[0].timestamp).toBeDefined();

      mockMongooseConnection(0);
      const { res: res2, jsonCalls: j2 } = buildRes();
      await getReady({}, res2);
      expect(j2[0].timestamp).toBeDefined();
    });
  });
});
