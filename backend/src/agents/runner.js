const { writeLog } = require("./logger");
const mongoose = require("mongoose");
const Task = require("../models/task.model");
const Workflow = require("../models/workflow.model");
const SystemSettings = require("../models/systemSettings.model");
const { claimNextTask, completeTask } = require("./queueService");
const { executeStep } = require("./executor");
const WORKER_ID = process.env.WORKER_ID || "agent-1";
require("dotenv").config();

/* -------------------------
   Settings cache
------------------------- */
let cachedWorkerSettings = null;
let lastSettingsFetch = 0;
const SETTINGS_REFRESH_MS = 5000;

/* -------------------------
   Safety fallback (only if DB fails)
------------------------- */
const SAFE_FALLBACK_SETTINGS = {
  pollIntervalMs: 2000,
  maxAttempts: 3,
};

/* -------------------------
   Utils
------------------------- */
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function getGlobalWorkerSettings() {
  const now = Date.now();

  if (
    cachedWorkerSettings &&
    now - lastSettingsFetch < SETTINGS_REFRESH_MS
  ) {
    return cachedWorkerSettings;
  }

  try {
    const settings = await SystemSettings.findOne().lean();

    cachedWorkerSettings = settings?.worker || SAFE_FALLBACK_SETTINGS;
    lastSettingsFetch = now;

    // console.log("🔁 Worker settings loaded:", cachedWorkerSettings);
    return cachedWorkerSettings;
  } catch (err) {
    console.error("⚠️ Failed to load worker settings:", err.message);
    return SAFE_FALLBACK_SETTINGS;
  }
}

/* -------------------------
   Worker loop
------------------------- */
let isRunningLoop = false;

async function runWorkerLoop() {
  if (isRunningLoop) return;
  isRunningLoop = true;

  console.log("👷 Agent Runner Started… waiting for tasks");
  writeLog("Runner started", "info", { workerId: WORKER_ID });

  while (true) {
    try {
      const task = await claimNextTask();

      // -------------------------
      // IDLE → poll interval sleep
      // -------------------------
      if (!task) {
        const { pollIntervalMs } = await getGlobalWorkerSettings();
        await sleep(pollIntervalMs);
        continue;
      }

      // -------------------------
      // Mark task running
      // -------------------------
      await Task.findByIdAndUpdate(task._id, {
        status: "running",
        startedAt: new Date(),
      });

      console.log(`📝 Task claimed: ${task._id}`);
      writeLog("Task claimed", "info", {
        workerId: WORKER_ID,
        taskId: task._id,
        workflowId: task.workflowId,
      });

      const workflow = task.workflowId
        ? await Workflow.findById(task.workflowId).lean()
        : null;

      const now = new Date();
      const context = {
        ...(task.input || {}),
        timestampIso: now.toISOString(),
        timestamp: now.toLocaleString("en-US", {
          dateStyle: "long",
          timeStyle: "short",
        }),
        date: now.toLocaleDateString("en-US", { dateStyle: "long" }),
        time: now.toLocaleTimeString("en-US", { timeStyle: "short" }),
        workflow,
        taskId: task._id,
        results: [],
      };

      // -------------------------
      // Resolve steps
      // -------------------------
      const steps =
        Array.isArray(task.steps) && task.steps.length > 0
          ? task.steps
          : Array.isArray(task.metadata?.steps)
            ? task.metadata.steps
            : [];

      let success = true;

      if (steps.length > 0) {
        console.log(`⚙️ Executing ${steps.length} steps…`);
        writeLog(`Executing ${steps.length} steps`, "info", {
          workerId: WORKER_ID,
          taskId: task._id,
          workflowId: task.workflowId,
        });

        for (const step of steps) {
          const result = await executeStep(step, context);

          await Task.findByIdAndUpdate(task._id, {
            $push: { stepResults: result },
          });

          context.results.push(result);
          context.last = result.output;

          if (!result.success) {
            success = false;
            writeLog(`Step failed: ${step.stepId}`, "error", {
              workerId: WORKER_ID,
              taskId: task._id,
              workflowId: task.workflowId,
            });
            break;
          }
        }
      } else {
        const llmResult = await executeStep(
          {
            type: "llm",
            prompt: task.input?.text || "Give a short summary.",
          },
          context
        );

        await Task.findByIdAndUpdate(task._id, {
          $push: { stepResults: llmResult },
        });

        success = llmResult.success;
        writeLog("Fallback LLM executed (no steps found)", "warn", {
          workerId: WORKER_ID,
          taskId: task._id,
          workflowId: task.workflowId,
        });
      }

      // -------------------------
      // Complete task
      // -------------------------
      await completeTask(task._id, { success });

      console.log(`✅ Task ${task._id} completed. Success: ${success}`);
      writeLog(
        success
          ? "Task completed successfully"
          : "Task completed with failure",
        success ? "success" : "error",
        {
          workerId: WORKER_ID,
          taskId: task._id,
          workflowId: task.workflowId,
        }
      );


    } catch (error) {
      console.error("❌ Worker loop error:", error);
      writeLog(`Runner error: ${error.message}`, "error", {
        workerId: WORKER_ID,
      });
      await sleep(SAFE_FALLBACK_SETTINGS.pollIntervalMs);
    }
  }
}

/* -------------------------
   Startup
------------------------- */
async function start() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("📡 MongoDB connected for Agent Runner");
  }
  runWorkerLoop();
}

module.exports = { start, runWorkerLoop };

if (require.main === module) {
  console.log("🚀 Starting Worker Service...");
  start();
}
