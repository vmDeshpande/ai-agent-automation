const Task = require('../models/task.model');
const { writeLog } = require('./logger');
require('dotenv').config();
const maxAttempts = Number(process.env.WORKER_MAX_ATTEMPTS || 3);

/* Stale-task recovery threshold. Default 15 minutes, matching the
 * previous inline behavior. Configurable via
 * `WORKER_STALE_TASK_TIMEOUT_MS` for environments that need a
 * shorter or longer window. */
const STALE_TASK_TIMEOUT_MS = Number(process.env.WORKER_STALE_TASK_TIMEOUT_MS || 15 * 60 * 1000);

/**
 * Race-safe per-task recovery of a single stale `running` task.
 *
 * Returns the recovered document (or null if no stale task matched).
 *
 * Race-safety: the filter includes `startedAt: { $lt: threshold }` so
 * a worker that just refreshed `startedAt` (or a concurrent recovery
 * call) cannot be incorrectly reset. Mongo's single-document atomic
 * update guarantees only one caller wins for each stale document.
 */
async function recoverOneStaleTask(now = new Date()) {
  const threshold = new Date(now.getTime() - STALE_TASK_TIMEOUT_MS);

  /* Step 1: atomically claim the next stale running task. We use
   * `findOneAndUpdate` so only one worker/process can pick it up. The
   * pre-condition `status: 'running' AND startedAt < threshold`
   * guarantees we never touch a fresh or already-claimed task. */
  const stale = await Task.findOneAndUpdate(
    { status: 'running', startedAt: { $lt: threshold } },
    {
      $set: {
        'metadata.staleSweepAt': now,
        'metadata.staleSweepStatus': 'in_progress',
      },
    },
    { sort: { startedAt: 1 }, returnDocument: 'after' }
  ).lean();

  if (!stale) return null;

  const attempts = stale.attempts || 0;
  const canRetry = attempts < maxAttempts;

  /* Step 2: re-queue OR fail, atomically, gated on the SAME startedAt
   * (so a concurrently-finished worker that just wrote a new
   * startedAt — should not happen, but defense in depth — would not
   * be reset). We also gate on the sweep marker we just set, so a
   * second recovery call cannot finalize the same task. */
  const sweepGuard = { _id: stale._id, startedAt: stale.startedAt };

  if (canRetry) {
    const res = await Task.findOneAndUpdate(
      sweepGuard,
      {
        $set: {
          status: 'pending',
          startedAt: null,
          'metadata.runningBy': null,
          'metadata.lastStaleRecoveredAt': now,
          'metadata.staleSweepStatus': 'requeued',
        },
        $push: {
          retryHistory: {
            kind: 'stale_recovery',
            recoveredAt: now,
            previousStartedAt: stale.startedAt,
            attempt: attempts,
            action: 'requeued',
          },
        },
      },
      { new: true }
    );
    if (!res) return null; /* lost the race; another path finalized the task */
    writeLog(
      `Recovered stale task ${stale._id} after ${Math.round(
        (now.getTime() - new Date(stale.startedAt).getTime()) / 1000
      )}s — requeued (attempts ${attempts}/${maxAttempts})`,
      'warn',
      { taskId: String(stale._id), workerId: 'stale-recovery' }
    );
    return res;
  }

  /* Attempts exhausted → terminal fail. */
  const res = await Task.findOneAndUpdate(
    sweepGuard,
    {
      $set: {
        status: 'failed',
        completedAt: now,
        'metadata.runningBy': null,
        'metadata.lastStaleRecoveredAt': now,
        'metadata.staleSweepStatus': 'failed',
        'metadata.failureReason': 'stale_recovery_exhausted',
      },
      $push: {
        retryHistory: {
          kind: 'stale_recovery',
          recoveredAt: now,
          previousStartedAt: stale.startedAt,
          attempt: attempts,
          action: 'failed',
          reason: 'max_attempts_exhausted',
        },
      },
    },
    { new: true }
  );
  if (!res) return null;
  writeLog(
    `Recovered stale task ${stale._id} after ${Math.round(
      (now.getTime() - new Date(stale.startedAt).getTime()) / 1000
    )}s — marked failed (attempts ${attempts}/${maxAttempts})`,
    'warn',
    { taskId: String(stale._id), workerId: 'stale-recovery' }
  );
  return res;
}

/**
 * Sweep stale `running` tasks. Returns the count of tasks recovered
 * (requeued or failed). Each task is handled atomically; the function
 * is safe to call concurrently from multiple workers because every
 * step is a single-document atomic update.
 *
 * `maxSweep` caps the number of documents processed per call so a
 * backlog after a long outage cannot create a thundering herd of
 * concurrent recoveries. Default 25.
 */
async function recoverStaleTasks({ maxSweep = 25, now = new Date() } = {}) {
  let recovered = 0;
  for (let i = 0; i < maxSweep; i += 1) {
    let result;
    try {
      result = await recoverOneStaleTask(now);
    } catch (err) {
      /* A per-task recovery error must not abort the rest of the
       * sweep. Log and stop: subsequent iterations would likely
       * hit the same error. */
      writeLog(
        `Stale-task recovery iteration failed: ${err && err.message ? err.message : err}`,
        'error'
      );
      break;
    }
    if (!result) break;
    recovered += 1;
  }
  return recovered;
}

/**
 * claimNextTask - atomically find one pending task and mark running.
 *
 * Before claiming, performs a bounded stale-task sweep so abandoned
 * tasks (e.g. from a crashed worker) become eligible for re-execution
 * within the next poll cycle. The sweep is race-safe (see
 * recoverOneStaleTask).
 */
async function claimNextTask({ workerId = 'worker-1' } = {}) {
  /* Opportunistic recovery. Bounded so a single claimNextTask call
   * never does unbounded work; subsequent claimNextTask calls
   * continue the sweep. */
  try {
    await recoverStaleTasks({ maxSweep: 25 });
  } catch (err) {
    /* Recovery is best-effort; do not block normal claiming on a
     * recovery error. The next claim will retry the sweep. */
    writeLog(
      `Stale-task recovery sweep failed: ${err && err.message ? err.message : err}`,
      'error'
    );
  }

  const res = await Task.findOneAndUpdate(
    { status: { $in: ['pending', 'retrying'] }, attempts: { $lt: maxAttempts } },
    {
      $set: { status: 'running', startedAt: new Date(), 'metadata.runningBy': workerId },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, returnDocument: 'after' }
  ).lean();
  return res;
}

/**
 * completeTask - mark task completed, save results
 */
async function completeTask(taskId, { success = true, stepResult = null, error = null } = {}) {
  const task = await Task.findById(taskId);
  if (!task) return null;

  const update = { $set: {}, $push: {} };

  update.$set.status = success ? 'completed' : 'failed';

  if (!success) {
    if ((task.attempts || 0) < maxAttempts) {
      update.$set.status = 'retrying';
      const archivedSteps = task.stepResults ? [...task.stepResults] : [];
      if (stepResult) archivedSteps.push(stepResult);

      const actualError = error || (stepResult && stepResult.error) || 'Step execution failed';

      update.$push.retryHistory = {
        attempt: task.attempts,
        startedAt: task.startedAt,
        failedAt: new Date(),
        error: actualError,
        stepResults: archivedSteps,
      };
      update.$set.stepResults = archivedSteps.filter((res) => res && res.success === true);
      update.$set.startedAt = null;
    } else {
      update.$set.status = 'failed';
    }
  } else {
    update.$set.completedAt = new Date();
  }

  if (stepResult && !update.$set.stepResults) {
    update.$push.stepResults = stepResult;
  }

  if (Object.keys(update.$push).length === 0) delete update.$push;
  if (Object.keys(update.$set).length === 0) delete update.$set;

  return Task.findByIdAndUpdate(taskId, update, { new: true });
}

module.exports = {
  claimNextTask,
  completeTask,
  recoverStaleTasks,
  recoverOneStaleTask,
  STALE_TASK_TIMEOUT_MS,
};
