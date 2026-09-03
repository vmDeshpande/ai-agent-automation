/* H-P2-2 — Stale Task Recovery.
 *
 * Verifies the race-safe recovery of abandoned `running` tasks:
 *   - Stale running tasks are detected via `startedAt` threshold.
 *   - Stale tasks with attempts < maxAttempts are requeued to
 *     `status: 'pending'` so the next claim picks them up.
 *   - Stale tasks with attempts >= maxAttempts are marked `failed`
 *     (terminal — no infinite retry loop).
 *   - Fresh running tasks are NEVER touched.
 *   - Tasks with no startedAt are NEVER treated as stale.
 *   - Concurrent recovery from multiple workers cannot double-recover
 *     a single task (single-document atomic findOneAndUpdate).
 *   - claimNextTask still claims normal pending/retrying tasks and
 *     runs the recovery sweep before claiming.
 *   - Recovery failures do not block normal claiming.
 *
 * The Task model and logger are mocked so the test runs in pure
 * Node without Mongo. The mocks model the relevant subset of Mongoose
 * behavior: `findOneAndUpdate`, `find`, and the result shapes used by
 * queueService. */

const originalEnv = { ...process.env };

/* Test-local in-memory store. Models enough of Mongoose to let
 * queueService.js use the real atomic primitives. */
function makeStore() {
  return {
    docs: new Map(),
    nextId: 1,
  };
}

function seed(store, doc) {
  const id = doc._id || `t${store.nextId++}`;
  const fullDoc = {
    _id: id,
    status: 'pending',
    attempts: 0,
    stepResults: [],
    retryHistory: [],
    metadata: {},
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    ...doc,
  };
  store.docs.set(id, fullDoc);
  return fullDoc;
}

function buildTaskMock(store) {
  /* The mock models the queueService usage:
   *   Task.findOneAndUpdate(filter, update, opts)
   *     - First call (recovery): filter = { status, startedAt: { $lt } }
   *       update = { $set: { metadata.staleSweepAt, metadata.staleSweepStatus } }
   *     - Second call (finalize): filter = { _id, startedAt }
   *       update = { $set: { status, ... }, $push: { retryHistory } }
   *   Task.findOneAndUpdate for claimNextTask
   *     - filter = { status: { $in }, attempts: { $lt } }
   *       update = { $set: { status, startedAt, ... }, $inc: { attempts } }
   *
   * The mock simulates Mongo's atomic semantics: a `findOneAndUpdate`
   * picks the first matching document, applies the update, and
   * returns the document (or null). Concurrent calls cannot both
   * match the same document after the first succeeds. */
  function applyUpdate(doc, update) {
    if (update.$set) {
      Object.entries(update.$set).forEach(([k, v]) => {
        if (k.includes('.')) {
          const [parent, child] = k.split('.');
          doc[parent] = { ...(doc[parent] || {}), [child]: v };
        } else {
          doc[k] = v;
        }
      });
    }
    if (update.$inc) {
      Object.entries(update.$inc).forEach(([k, v]) => {
        doc[k] = (doc[k] || 0) + v;
      });
    }
    if (update.$push) {
      Object.entries(update.$push).forEach(([k, v]) => {
        if (!Array.isArray(doc[k])) doc[k] = [];
        doc[k].push(v);
      });
    }
  }

  /* The first claim in recoverOneStaleTask uses `.lean()` on the
   * result of findOneAndUpdate. The second finalize call does not.
   * The implementation expects:
   *   const stale = await Task.findOneAndUpdate(...).lean();
   *   const res = await Task.findOneAndUpdate(...);
   * We detect the call shape by inspecting the caller — but a simpler
   * approach is to return a thenable that supports `.lean()` which
   * returns the post-update doc, and the raw promise otherwise.
   *
   * The implementation uses two distinct call patterns:
   *   1) `findOneAndUpdate(filter, update, { sort, returnDocument: 'after' }).lean()`
   *      — recovers one stale task
   *   2) `findOneAndUpdate(filter, update, { new: true })` (no .lean)
   *      — finalizes requeue OR fail
   *   3) `findOneAndUpdate(filter, update, { sort, returnDocument: 'after' }).lean()`
   *      — claimNextTask claim
   *
   * We model this by always returning an object with both `.lean()`
   * (returns the post-update doc as a thenable) and a thenable shape
   * (the post-update doc directly). The simplest approach: have
   * `findOneAndUpdate` return a thenable that IS the post-update doc
   * AND has a `.lean()` method that returns the same doc. */

  function findOneAndUpdate(filter, update, opts = {}) {
    const docs = Array.from(store.docs.values());
    const matches = (doc) => {
      if (filter._id && String(doc._id) !== String(filter._id)) return false;
      if (filter.status) {
        if (typeof filter.status === 'string') {
          if (doc.status !== filter.status) return false;
        } else if (filter.status.$in) {
          if (!filter.status.$in.includes(doc.status)) return false;
        }
      }
      if (filter.startedAt && filter.startedAt.$lt) {
        if (!doc.startedAt) return false;
        if (!(new Date(doc.startedAt).getTime() < new Date(filter.startedAt.$lt).getTime())) {
          return false;
        }
      }
      if (filter.startedAt && filter.startedAt.$lt === undefined) {
        /* Direct equality check used by the finalize step. */
        if (!doc.startedAt) return false;
        if (new Date(doc.startedAt).getTime() !== new Date(filter.startedAt).getTime()) {
          return false;
        }
      }
      if (filter.attempts && filter.attempts.$lt !== undefined) {
        if (!(doc.attempts < filter.attempts.$lt)) return false;
      }
      return true;
    };

    const candidate = docs.find(matches);
    if (!candidate) {
      const nullResult = Promise.resolve(null);
      nullResult.lean = () => nullResult;
      return nullResult;
    }
    applyUpdate(candidate, update);
    /* `.lean()` returns the same thenable (preserving the chain), as
     * Mongoose does in real usage. The `.lean()` call does NOT
     * resolve to a new value — it just marks the query as lean and
     * returns the same promise. The result of `await query.lean()`
     * is a SNAPSHOT (POJO) of the post-update document, so later
     * reads of `stale.startedAt` see the value at the time of the
     * update, not subsequent mutations. This is what makes the
     * race-safety guarantee observable in tests. */
    const snapshot = JSON.parse(JSON.stringify(candidate));
    const thenable = Promise.resolve(snapshot);
    thenable.lean = () => thenable;
    return thenable;
  }

  function findOne(filter) {
    const doc = Array.from(store.docs.values()).find((d) => {
      if (filter._id && String(d._id) !== String(filter._id)) return false;
      return true;
    });
    return Promise.resolve(doc || null);
  }

  return { findOneAndUpdate, findOne };
}

function makeTaskModel(store) {
  const t = jest.fn();
  t.findOneAndUpdate = (filter, update, opts) =>
    buildTaskMock(store).findOneAndUpdate(filter, update, opts);
  t.findOne = (filter) => buildTaskMock(store).findOne(filter);
  /* Expose internals for the test harness. */
  t.__store = store;
  return t;
}

function loadQueue({ staleTimeoutMs, maxAttempts } = {}) {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    /* Tiny thresholds so the test can seed old startedAt easily. */
    WORKER_STALE_TASK_TIMEOUT_MS: String(staleTimeoutMs ?? 1000),
    WORKER_MAX_ATTEMPTS: String(maxAttempts ?? 3),
  };
  const store = makeStore();
  const Task = makeTaskModel(store);
  jest.doMock('../models/task.model', () => Task);
  jest.doMock('../agents/logger', () => ({ writeLog: jest.fn() }));
  const queue = require('../agents/queueService');
  return { queue, store, Task };
}

afterEach(() => {
  process.env = { ...originalEnv };
  jest.resetModules();
});

describe('H-P2-2 — recoverOneStaleTask', () => {
  test('returns null when no stale running task exists', async () => {
    const { queue, store } = loadQueue();
    seed(store, { status: 'pending' });
    seed(store, { status: 'running', startedAt: new Date() }); /* fresh */
    const result = await queue.recoverOneStaleTask();
    expect(result).toBeNull();
  });

  test('a fresh running task (startedAt within threshold) is NOT recovered', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 60_000 });
    const fresh = seed(store, {
      status: 'running',
      startedAt: new Date(Date.now() - 5_000) /* 5s old, threshold 60s */,
      attempts: 1,
    });
    const result = await queue.recoverOneStaleTask();
    expect(result).toBeNull();
    expect(fresh.status).toBe('running');
    expect(fresh.startedAt).not.toBeNull();
  });

  test('a task with no startedAt is NEVER treated as stale', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 0 });
    const noStartedAt = seed(store, { status: 'running', startedAt: null });
    const result = await queue.recoverOneStaleTask();
    expect(result).toBeNull();
    expect(noStartedAt.status).toBe('running');
  });

  test('a stale running task with attempts < maxAttempts is requeued to pending', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 1000, maxAttempts: 3 });
    const stale = seed(store, {
      status: 'running',
      startedAt: new Date(Date.now() - 10_000),
      attempts: 1 /* 1 < 3, so requeue */,
    });
    const result = await queue.recoverOneStaleTask();
    expect(result).not.toBeNull();
    expect(result._id).toBe(stale._id);
    expect(stale.status).toBe('pending');
    expect(stale.startedAt).toBeNull();
    expect(stale.metadata.runningBy).toBeNull();
    expect(stale.metadata.staleSweepStatus).toBe('requeued');
    expect(stale.retryHistory.length).toBe(1);
    expect(stale.retryHistory[0].kind).toBe('stale_recovery');
    expect(stale.retryHistory[0].action).toBe('requeued');
  });

  test('a stale running task with attempts == maxAttempts is marked failed (exhausted)', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 1000, maxAttempts: 3 });
    const exhausted = seed(store, {
      status: 'running',
      startedAt: new Date(Date.now() - 10_000),
      attempts: 3 /* 3 >= 3, so fail */,
    });
    const result = await queue.recoverOneStaleTask();
    expect(result).not.toBeNull();
    expect(exhausted.status).toBe('failed');
    expect(exhausted.completedAt).not.toBeNull();
    expect(exhausted.metadata.staleSweepStatus).toBe('failed');
    expect(exhausted.metadata.failureReason).toBe('stale_recovery_exhausted');
    expect(exhausted.retryHistory[0].action).toBe('failed');
    expect(exhausted.retryHistory[0].reason).toBe('max_attempts_exhausted');
  });

  test('a stale running task with attempts > maxAttempts is also marked failed', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 1000, maxAttempts: 3 });
    const wayPast = seed(store, {
      status: 'running',
      startedAt: new Date(Date.now() - 10_000),
      attempts: 5,
    });
    await queue.recoverOneStaleTask();
    expect(wayPast.status).toBe('failed');
  });

  test('only the OLDEST stale task is recovered per call (FIFO via startedAt sort)', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 1000 });
    const older = seed(store, {
      status: 'running',
      startedAt: new Date(Date.now() - 30_000),
      attempts: 0,
    });
    const newer = seed(store, {
      status: 'running',
      startedAt: new Date(Date.now() - 5_000),
      attempts: 0,
    });
    const result = await queue.recoverOneStaleTask();
    expect(result._id).toBe(older._id);
    expect(older.status).toBe('pending');
    expect(newer.status).toBe('running'); /* not yet touched */
  });
});

describe('H-P2-2 — recoverStaleTasks (sweep)', () => {
  test('recovers up to maxSweep stale tasks per call', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 1000 });
    for (let i = 0; i < 5; i += 1) {
      seed(store, {
        status: 'running',
        startedAt: new Date(Date.now() - (10_000 + i * 1000)),
        attempts: 0,
      });
    }
    const recovered = await queue.recoverStaleTasks({ maxSweep: 3 });
    expect(recovered).toBe(3);
    const stillRunning = Array.from(store.docs.values()).filter((d) => d.status === 'running');
    expect(stillRunning.length).toBe(2);
  });

  test('returns 0 when no stale tasks exist', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 1000 });
    seed(store, { status: 'pending' });
    const recovered = await queue.recoverStaleTasks({ maxSweep: 25 });
    expect(recovered).toBe(0);
  });

  test('stops after exhausting the backlog', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 1000 });
    for (let i = 0; i < 2; i += 1) {
      seed(store, {
        status: 'running',
        startedAt: new Date(Date.now() - (10_000 + i * 1000)),
        attempts: 0,
      });
    }
    const recovered = await queue.recoverStaleTasks({ maxSweep: 25 });
    expect(recovered).toBe(2);
  });
});

describe('H-P2-2 — race-safety', () => {
  test('two concurrent recoverOneStaleTask calls cannot recover the same task twice', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 1000 });
    seed(store, {
      status: 'running',
      startedAt: new Date(Date.now() - 10_000),
      attempts: 0,
    });
    /* Two concurrent recovery calls. Because the mock simulates
     * Mongo's single-doc atomic findOneAndUpdate, only the first
     * call's filter (`status: 'running' AND startedAt < threshold`)
     * matches. The second call finds nothing because the task is
     * already `pending` (or `failed`). */
    const [a, b] = await Promise.all([queue.recoverOneStaleTask(), queue.recoverOneStaleTask()]);
    const recovered = [a, b].filter(Boolean);
    expect(recovered.length).toBe(1);
  });

  test('a worker whose task is currently running (startedAt is fresh) is never re-claimed by another recovery', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 60_000 });
    const active = seed(store, {
      status: 'running',
      startedAt: new Date(Date.now() - 1_000) /* 1s old, threshold 60s */,
      attempts: 0,
    });
    /* Simulate another worker attempting recovery while this worker
     * is still legitimately running. */
    const result = await queue.recoverOneStaleTask();
    expect(result).toBeNull();
    expect(active.status).toBe('running');
    expect(active.startedAt).not.toBeNull();
  });
});

describe('H-P2-2 — claimNextTask integration', () => {
  test('runs a recovery sweep before claiming a normal pending task', async () => {
    const { queue, store } = loadQueue({ staleTimeoutMs: 1000, maxAttempts: 3 });
    /* Seed the pending task FIRST so it is older than the stale task.
     * The recovery sweep recovers the stale (running) task, and the
     * subsequent claim picks the oldest by createdAt — which is now
     * the pending task. */
    const pending = seed(store, {
      status: 'pending',
      attempts: 0,
    });
    /* small delay so the stale task has a strictly later createdAt */
    await new Promise((r) => setTimeout(r, 5));
    const stale = seed(store, {
      status: 'running',
      startedAt: new Date(Date.now() - 10_000),
      attempts: 0,
    });
    const claimed = await queue.claimNextTask({ workerId: 'w-1' });
    expect(claimed).not.toBeNull();
    /* The stale task must have been requeued (so the next claim will
     * pick it up). The pending task was the one claimed in this call
     * (oldest first). */
    expect(stale.status).toBe('pending');
    expect(claimed._id).toBe(pending._id);
  });

  test('a recovery sweep error does NOT block normal claimNextTask', async () => {
    const { queue, store, Task } = loadQueue();
    /* The first findOneAndUpdate call (the stale-task claim) rejects
     * to simulate a transient DB error. The implementation wraps the
     * sweep in try/catch, so the rejection is swallowed and the
     * normal claim proceeds. */
    const realFindOneAndUpdate = Task.findOneAndUpdate;
    let callCount = 0;
    Task.findOneAndUpdate = jest.fn().mockImplementation((filter, update, opts) => {
      callCount += 1;
      if (callCount === 1) {
        /* Return a rejected promise. We attach a no-op .catch so
         * Node's unhandled-rejection detector does not fire before
         * the await chain in the implementation runs. The
         * implementation's try/catch will then receive the throw
         * via the await. */
        const p = Promise.reject(new Error('simulated sweep failure'));
        p.catch(() => {});
        return p;
      }
      return realFindOneAndUpdate(filter, update, opts);
    });
    const pending = seed(store, { status: 'pending', attempts: 0 });
    const claimed = await queue.claimNextTask({ workerId: 'w-1' });
    expect(claimed).not.toBeNull();
    expect(claimed._id).toBe(pending._id);
  });

  test('normal pending claim still works when no stale tasks exist', async () => {
    const { queue, store } = loadQueue();
    const p = seed(store, { status: 'pending', attempts: 0 });
    const claimed = await queue.claimNextTask({ workerId: 'w-1' });
    expect(claimed).not.toBeNull();
    expect(claimed._id).toBe(p._id);
    expect(claimed.status).toBe('running');
    expect(claimed.attempts).toBe(1);
  });

  test('normal retrying claim still works', async () => {
    const { queue, store } = loadQueue({ maxAttempts: 3 });
    const r = seed(store, { status: 'retrying', attempts: 1 });
    const claimed = await queue.claimNextTask({ workerId: 'w-1' });
    expect(claimed).not.toBeNull();
    expect(claimed._id).toBe(r._id);
    expect(claimed.status).toBe('running');
    expect(claimed.attempts).toBe(2);
  });

  test('exhausted task (attempts >= maxAttempts) is not claimed', async () => {
    const { queue, store } = loadQueue({ maxAttempts: 3 });
    const exhausted = seed(store, { status: 'pending', attempts: 3 });
    const claimed = await queue.claimNextTask({ workerId: 'w-1' });
    expect(claimed).toBeNull();
    expect(exhausted.status).toBe('pending');
  });
});

describe('H-P2-2 — H-P2-1 graceful shutdown still works', () => {
  test('importing queueService does not regress the runner shutdown state machine', () => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      MONGO_URI: 'mongodb://localhost:27017/test',
      JWT_SECRET: 'x'.repeat(40),
      INTERNAL_AUTH_TOKEN: 'a'.repeat(20),
    };
    jest.doMock('../models/task.model', () => makeTaskModel(makeStore()));
    jest.doMock('../agents/logger', () => ({ writeLog: jest.fn() }));
    jest.doMock('mongoose', () => ({
      Schema: function () {
        return { index: () => {} };
      },
      model: () => ({}),
      models: {},
      Types: { ObjectId: class {} },
      connection: { readyState: 1 },
    }));
    const queue = require('../agents/queueService');
    expect(typeof queue.claimNextTask).toBe('function');
    expect(typeof queue.recoverStaleTasks).toBe('function');
    expect(typeof queue.recoverOneStaleTask).toBe('function');
    expect(typeof queue.completeTask).toBe('function');
  });
});
