// backend/src/agents/testConcurrency.js
const path = require("path");

// Override env settings for testing concurrency limits
process.env.WORKER_CONCURRENCY_LIMIT = "2";
process.env.WORKER_POLL_INTERVAL_MS = "200";

// 1. Mock mongoose with stub schema properties
const mockSchema = function() {
  this.add = () => {};
};
mockSchema.Types = {
  ObjectId: String,
  Mixed: Object
};

const mockMongoose = {
  Schema: mockSchema,
  model: () => ({}),
  models: {},
  connection: {
    readyState: 1 // Bypasses connect readyState check
  },
  connect: async () => {
    console.log("📡 [MOCK] Connected to MongoDB.");
  }
};

const mongoosePath = require.resolve("mongoose");
require.cache[mongoosePath] = {
  id: mongoosePath,
  filename: mongoosePath,
  loaded: true,
  exports: mockMongoose
};

// 2. Mock logger at module level
const loggerPath = path.resolve(__dirname, "logger.js");
require.cache[loggerPath] = {
  id: loggerPath,
  filename: loggerPath,
  loaded: true,
  exports: {
    writeLog: (msg, type, meta) => {
      console.log(`📝 [MOCK LOGGER] ${type.toUpperCase()}: ${msg}`, meta || "");
      return Promise.resolve();
    }
  }
};

// 3. Mock telemetry.service at module level
const telemetryPath = path.resolve(__dirname, "../services/telemetry.service.js");
require.cache[telemetryPath] = {
  id: telemetryPath,
  filename: telemetryPath,
  loaded: true,
  exports: {
    recordTaskMetrics: async () => {}
  }
};

// 4. Mock Models at module level to run entirely in-memory
const taskModelPath = path.resolve(__dirname, "../models/task.model.js");
require.cache[taskModelPath] = {
  id: taskModelPath,
  filename: taskModelPath,
  loaded: true,
  exports: {
    findByIdAndUpdate: async (id, update) => {
      return {};
    }
  }
};

const workflowModelPath = path.resolve(__dirname, "../models/workflow.model.js");
require.cache[workflowModelPath] = {
  id: workflowModelPath,
  filename: workflowModelPath,
  loaded: true,
  exports: {
    findById: () => ({
      lean: () => Promise.resolve(null)
    })
  }
};

const settingsModelPath = path.resolve(__dirname, "../models/systemSettings.model.js");
require.cache[settingsModelPath] = {
  id: settingsModelPath,
  filename: settingsModelPath,
  loaded: true,
  exports: {
    findOne: () => ({
      lean: () => Promise.resolve({ worker: { pollIntervalMs: 200, maxAttempts: 3 } })
    })
  }
};

// 5. Set up our in-memory queue representing database task states
const mockQueue = [
  { _id: "task-1", status: "pending", steps: [{ id: "s1", type: "delay", seconds: 1 }] },
  { _id: "task-2", status: "pending", steps: [{ id: "s2", type: "delay", seconds: 1 }] },
  { _id: "task-3", status: "pending", steps: [{ id: "s3", type: "delay", seconds: 1 }] },
  { _id: "task-4", status: "pending", steps: [{ id: "s4", type: "delay", seconds: 1 }] },
];

let activeRunningCount = 0;
let maxConcurrentObserved = 0;
let completedCount = 0;

// 6. Intercept queueService exports in node require.cache before requiring runner.js
const queueServicePath = path.resolve(__dirname, "queueService.js");
require.cache[queueServicePath] = {
  id: queueServicePath,
  filename: queueServicePath,
  loaded: true,
  exports: {
    claimNextTask: async ({ workerId } = {}) => {
      const task = mockQueue.find(t => t.status === "pending");
      if (task) {
        task.status = "running";
        task.startedAt = new Date();
        activeRunningCount++;
        if (activeRunningCount > maxConcurrentObserved) {
          maxConcurrentObserved = activeRunningCount;
        }
        console.log(`📡 [MOCK CLAIM] Worker ${workerId} claimed ${task._id}. Active: ${activeRunningCount}`);
        return task;
      }
      return null;
    },
    completeTask: async (taskId, { success }) => {
      const task = mockQueue.find(t => t._id === taskId);
      if (task && task.status === "running") {
        task.status = "completed";
        activeRunningCount--;
        completedCount++;
        console.log(`📡 [MOCK COMPLETE] Completed ${taskId}. Active: ${activeRunningCount}`);
      }
    }
  }
};

async function runTest() {
  console.log("🚀 Starting Worker Concurrency & Throttling Integration Test (In-Memory)...\n");

  // Require and start runner loop in the same process
  const runner = require("./runner");
  
  // Start the runner loop
  runner.start();
  console.log("👷 Agent Runner started asynchronously inside test execution.");

  // Monitor the active thread count periodically
  const monitoringDurationMs = 5000;
  const intervalMs = 150;
  const startTime = Date.now();

  const monitorPromise = new Promise((resolve) => {
    const interval = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > monitoringDurationMs || completedCount === 4) {
        clearInterval(interval);
        resolve();
        return;
      }

      console.log(
        `⏱️ [${elapsed}ms] Active Threads: ${activeRunningCount} | Max Observed: ${maxConcurrentObserved} | Completed: ${completedCount}`
      );
    }, intervalMs);
  });

  await monitorPromise;

  console.log("\n📊 Test Concurrency Summary:");
  console.log(`- Max concurrent running tasks observed: ${maxConcurrentObserved}`);
  console.log(`- Configured concurrency limit: ${process.env.WORKER_CONCURRENCY_LIMIT}`);
  console.log(`- Total tasks successfully completed: ${completedCount}/4`);

  let failed = false;
  if (maxConcurrentObserved > 2) {
    console.error("❌ FAIL: Max concurrent running tasks exceeded the configured limit of 2!");
    failed = true;
  } else if (maxConcurrentObserved === 0) {
    console.error("❌ FAIL: No tasks were processed.");
    failed = true;
  } else if (completedCount !== 4) {
    console.error("❌ FAIL: Not all tasks successfully completed.");
    failed = true;
  } else {
    console.log("✅ PASS: Concurrency limit successfully enforced, and all tasks completed under throttled execution!");
  }

  if (failed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error("Unhandled test execution error:", err);
  process.exit(1);
});
