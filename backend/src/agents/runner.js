const { writeLog } = require("./logger");
const mongoose = require("mongoose");
const Task = require("../models/task.model");
const Workflow = require("../models/workflow.model");
const SystemSettings = require("../models/systemSettings.model");
const { claimNextTask, completeTask } = require("./queueService");
const { executeStep } = require("./executor");
const telemetryService = require("../services/telemetry.service");
const WORKER_ID = process.env.WORKER_ID || "agent-1";
const EventEmitter = require("events");
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
let activeThreadsCount = 0;
const workerEvents = new EventEmitter();

async function executeSingleTask(task) {
  try {
    console.log(`📝 Task claimed: ${task._id}`);
    writeLog("Task claimed", "info", {
      workerId: WORKER_ID,
      taskId: task._id,
      workflowId: task.workflowId,
    });

    const workflow = task.workflowId
      ? await Workflow.findById(task.workflowId).lean()
      : null;

    let agent = null;

    if (workflow?.agentId) {
      const Agent = require("../models/agent.model");
      agent = await Agent.findById(workflow.agentId).lean();
    }

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
      userId: task.userId,
      results: [],
    };

    // -------------------------
    // Resolve steps
    // -------------------------
    const steps =
      Array.isArray(task.steps) && task.steps.length > 0
        ? task.steps
        : Array.isArray(task.metadata?.steps) && task.metadata.steps.length > 0
          ? task.metadata.steps
          : Array.isArray(workflow?.metadata?.steps)
            ? workflow.metadata.steps
            : [];

    const edges =
      Array.isArray(task.metadata?.edges) && task.metadata.edges.length > 0
        ? task.metadata.edges
        : Array.isArray(workflow?.metadata?.edges)
          ? workflow.metadata.edges
          : [];
    let success = true;

    if (steps.length > 0) {
      console.log(`⚙️ Executing ${steps.length} steps…`);
      writeLog(`Executing ${steps.length} steps`, "info", {
        workerId: WORKER_ID,
        taskId: task._id,
        workflowId: task.workflowId,
      });

      function getStepId(step) {
        return step.stepId || step.id || step.name;
      }

      const stepsMap = {};
      steps.forEach((s) => {
        stepsMap[getStepId(s)] = s;
      });

      // find start node (no incoming edges)
      const targetSet = new Set(edges.map((e) => e.target));
      let currentStep = steps.find((s) => !targetSet.has(getStepId(s)));

      let visited = new Set();

      let stepCount = 0;
      const MAX_STEPS = 50;

      while (currentStep && stepCount < MAX_STEPS) {
        stepCount++;
        if (stepCount >= MAX_STEPS) {
          console.warn("⚠️ Max steps reached, stopping execution");
          success = false;
        }

        visited.add(getStepId(currentStep));

        // ⏱️ Measure individual step execution duration
        const stepStart = Date.now();
        const result = await executeStep(currentStep, context, agent);
        const stepDurationMs = Date.now() - stepStart;

        // 🔥 attach debug info and telemetry directly to result
        result.name = currentStep.name;
        result.type = currentStep.type;
        result.durationMs = stepDurationMs;

        await Task.findByIdAndUpdate(task._id, {
          $push: { stepResults: result },
        });

        context.results.push(result);
        context.last = {
          input: result.input,
          output: result.output,
        };

        if (!result.success) {
          success = false;
          break;
        }

        // 🔥 FIND NEXT STEP USING EDGES
        let nextEdge = null;

        // ✅ CONDITION
        if (currentStep.type === "condition") {
          const branch = result.branch;

          nextEdge = edges.find(
            (e) =>
              e.source === getStepId(currentStep) &&
              e.condition === branch
          );
        }

        // ✅ SWITCH
        else if (currentStep.type === "switch") {
          const normalize = (v) =>
            String(v || "").toLowerCase().trim();

          const value = normalize(result.caseValue);

          nextEdge = edges.find((e) => {
            if (e.source !== getStepId(currentStep)) return false;

            const edgeValue = normalize(e.caseValue);

            return value.includes(edgeValue); // 🔥 FIX
          });

          console.log("🔀 SWITCH DEBUG:", {
            resultValue: value,
            availableEdges: edges
              .filter(e => e.source === getStepId(currentStep))
              .map(e => e.caseValue)
          });

          // fallback (default edge)
          if (!nextEdge) {
            nextEdge = edges.find(
              (e) =>
                e.source === getStepId(currentStep) &&
                !e.caseValue
            );
          }
        }

        // ✅ DEFAULT (linear fallback)
        else {
          nextEdge = edges.find((e) => e.source === getStepId(currentStep));
        }

        if (!nextEdge) break;

        currentStep = stepsMap[nextEdge.target];
      }
    } else {
      const llmResult = await executeStep(
        {
          type: "llm",
          prompt: task.input?.text || "Give a short summary.",
        },
        context,
        agent
      );
      console.log("🧪 LLM RESULT:", llmResult);

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

    const durationMs = task.startedAt
      ? Date.now() - new Date(task.startedAt).getTime()
      : 0;

    const stepTypes = context.results.map((result) => result.type || "unknown");
    telemetryService
      .recordTaskMetrics({ stepTypes, durationMs })
      .catch((err) => {
        console.error("Telemetry recordTaskMetrics failed:", err.message || err);
      });

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
    console.error("❌ Worker task error:", error);
    writeLog(`Task run error: ${error.message}`, "error", {
      workerId: WORKER_ID,
      taskId: task._id,
    });
    try {
      await completeTask(task._id, { success: false });
    } catch (e) {
      // ignore
    }
  }
}

async function runWorkerLoop() {
  if (isRunningLoop) return;
  isRunningLoop = true;

  console.log("👷 Agent Runner Started… waiting for tasks");
  writeLog("Runner started", "info", { workerId: WORKER_ID });

  while (true) {
    try {
      const limit = Number(process.env.WORKER_CONCURRENCY_LIMIT || 5);

      if (activeThreadsCount >= limit) {
        // Wait until a slot is freed, or timeout after 5000ms as a fallback
        await new Promise((resolve) => {
          const onSlotFree = () => {
            workerEvents.off("slot_free", onSlotFree);
            clearTimeout(timeout);
            resolve();
          };
          const timeout = setTimeout(() => {
            workerEvents.off("slot_free", onSlotFree);
            resolve();
          }, 5000);
          workerEvents.once("slot_free", onSlotFree);
        });
        continue;
      }

      const task = await claimNextTask({ workerId: WORKER_ID });

      if (!task) {
        const { pollIntervalMs } = await getGlobalWorkerSettings();
        await sleep(pollIntervalMs);
        continue;
      }

      activeThreadsCount++;
      executeSingleTask(task).finally(() => {
        activeThreadsCount--;
        workerEvents.emit("slot_free");
      });

    } catch (error) {
      console.error("❌ Worker loop error:", error);
      writeLog(`Runner error: ${error.message}`, "error", {
        workerId: WORKER_ID,
      });
      const { pollIntervalMs } = await getGlobalWorkerSettings();
      await sleep(pollIntervalMs);
    }
  }
}

/* -------------------------
   Startup
------------------------- */
async function start() {
  if (mongoose.connection.readyState === 0) {
    const maxPoolSize = Number(process.env.MONGO_MAX_POOL_SIZE || 100);
    const minPoolSize = Number(process.env.MONGO_MIN_POOL_SIZE || 10);
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize,
      minPoolSize,
    });
    console.log("📡 MongoDB connected for Agent Runner");
  }
  runWorkerLoop();
}

module.exports = { start, runWorkerLoop };

if (require.main === module) {
  console.log("🚀 Starting Worker Service...");
  start();
}
