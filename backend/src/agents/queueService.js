const Task = require("../models/task.model");
require("dotenv").config();
const maxAttempts = Number(process.env.WORKER_MAX_ATTEMPTS || 3);

/**
 * claimNextTask - atomically find one pending task and mark running
 * @param {Object} options { workerId, batchSize }
 * @returns Task document or null
 */
async function claimNextTask({ workerId = "worker-1" } = {}) {
  // Adjust query & sort as needed (priority, createdAt, etc.)
  const res = await Task.findOneAndUpdate(
    { status: { $in: ["pending", "retrying"] }, attempts: { $lt: maxAttempts } },
    {
      $set: { status: "running", startedAt: new Date(), "metadata.runningBy": workerId },
      $inc: { attempts: 1 }
    },
    { sort: { createdAt: 1 }, returnDocument: "after" } // oldest first
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

  update.$set.status = success ? "completed" : "failed";

  if (!success) {
    if ((task.attempts || 0) < maxAttempts) {
      update.$set.status = "retrying";
      const archivedSteps = task.stepResults ? [...task.stepResults] : [];
      if (stepResult) archivedSteps.push(stepResult);
      
      const actualError = error || (stepResult && stepResult.error) || "Step execution failed";

      update.$push.retryHistory = {
        attempt: task.attempts,
        startedAt: task.startedAt,
        failedAt: new Date(),
        error: actualError,
        stepResults: archivedSteps
      };

      update.$set.stepResults = [];
      update.$set.startedAt = null;
    } else {
      update.$set.status = "failed";
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

module.exports = { claimNextTask, completeTask };
