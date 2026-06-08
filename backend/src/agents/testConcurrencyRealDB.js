// backend/src/agents/testConcurrencyRealDB.js
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

// Override env settings for testing concurrency limits
process.env.WORKER_CONCURRENCY_LIMIT = "2";
process.env.WORKER_POLL_INTERVAL_MS = "200";

const Task = require("../models/task.model");
const runner = require("./runner");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ai-agent-automation";

const testTaskIds = [
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId()
];

async function runTest() {
  console.log("🚀 Connecting to database:", MONGO_URI);
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 3000
    });
    console.log("📡 Connected to MongoDB.");
  } catch (err) {
    console.error("\n❌ Could not connect to MongoDB. Please ensure MongoDB is running locally or MONGO_URI is set correctly in your environment.");
    console.error("Details:", err.message);
    process.exit(1);
  }

  // Clean up any stale test tasks
  await Task.deleteMany({ _id: { $in: testTaskIds } });

  console.log("🌱 Seeding test tasks into real queue...");
  await Task.create(
    testTaskIds.map((id, index) => ({
      _id: id,
      name: `Real DB Concurrency Test Task ${index + 1}`,
      status: "pending",
      steps: [{ id: `s${index + 1}`, type: "delay", seconds: 1 }],
      currentStep: 0,
      input: {},
      metadata: {},
      userId: new mongoose.Types.ObjectId()
    }))
  );

  console.log("👷 Starting Agent Runner loop...");
  runner.runWorkerLoop();

  // Monitor DB states to count concurrent "running" tasks
  const monitoringDurationMs = 5000;
  const intervalMs = 200;
  const startTime = Date.now();
  let maxConcurrentObserved = 0;
  let completedCount = 0;

  const monitorPromise = new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const elapsed = Date.now() - startTime;
        const tasks = await Task.find({ _id: { $in: testTaskIds } }).lean();
        
        const running = tasks.filter(t => t.status === "running").length;
        const completed = tasks.filter(t => t.status === "completed" || t.status === "success" || t.status === "failed").length;

        if (running > maxConcurrentObserved) {
          maxConcurrentObserved = running;
        }

        completedCount = completed;

        console.log(
          `⏱️ [${elapsed}ms] Active DB Tasks: ${running} | Max Observed: ${maxConcurrentObserved} | Completed: ${completedCount}/4`
        );

        if (elapsed > monitoringDurationMs || completed === 4) {
          clearInterval(interval);
          resolve();
        }
      } catch (err) {
        console.error("Error in monitoring loop:", err);
      }
    }, intervalMs);
  });

  await monitorPromise;

  console.log("\n🧹 Cleaning up test database records...");
  await Task.deleteMany({ _id: { $in: testTaskIds } });
  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB.");

  console.log("\n📊 Real DB Test Concurrency Summary:");
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
    console.log("✅ PASS: Real DB integration test passed successfully!");
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
