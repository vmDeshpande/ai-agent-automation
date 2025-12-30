const { writeLog } = require("./logger");
const mongoose = require("mongoose");
const Task = require("../models/task.model");
const Workflow = require("../models/workflow.model");
const { claimNextTask, completeTask } = require("./queueService");
const { executeStep } = require("./executor");
const config = require("../config/runner.config");
require("dotenv").config();

console.log("👷 Agent Runner Started… waiting for tasks");
writeLog("Runner started");

let isRunningLoop = false;

// Sleep utility
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runWorkerLoop() {
  if (isRunningLoop) return;
  isRunningLoop = true;

  console.log("🔄 Worker loop initialized…");

  while (true) {
    try {
      console.log("⏳ Polling for pending tasks…");
      writeLog("Polling for tasks…");

      const task = await claimNextTask({ workerId: config.workerId });

      if (!task) {
        console.log(`😴 No tasks found. Sleeping for ${config.pollIntervalMs}ms`);
        await sleep(config.pollIntervalMs);
        continue;
      }

      // after task is claimed
      await Task.findByIdAndUpdate(task._id, {
        $set: {
          status: "running",
          startedAt: new Date()
        }
      });


      console.log(`📝 Task claimed: ${task._id}`);
      writeLog(`Task claimed: ${task._id}`);

      const workflow = task.workflowId
        ? await Workflow.findById(task.workflowId).lean()
        : null;

      const now = new Date();
      const context = {
        ...(task.input || {}),
        // ISO timestamp
        timestampIso: now.toISOString(),

        // Readable formats
        timestamp: now.toLocaleString("en-US", {
          dateStyle: "long",
          timeStyle: "short",
        }),

        date: now.toLocaleDateString("en-US", {
          dateStyle: "long",
        }),

        time: now.toLocaleTimeString("en-US", {
          timeStyle: "short",
        }),
        workflow,
        taskId: task._id
      };

      const steps = Array.isArray(task.steps) ? task.steps : [];
      let success = true;

      if (steps.length > 0) {
        console.log(`⚙️ Executing ${steps.length} steps…`);
        writeLog(`Executing ${steps.length} steps for task ${task._id}`);

        context.results = context.results || [];
        for (const step of steps) {
          const result = await executeStep(step, context);

          await Task.findByIdAndUpdate(task._id, {
            $push: { stepResults: result }
          });
          context.results.push(result);
          context.last = result.output;

          if (!result.success) {
            success = false;
            console.error(`Step failed: ${step.stepId}`);
            writeLog(`Step failed: ${step.stepId}`, "error");
            break;
          }
        }

      } else {
        console.log("💬 No steps found. Running default LLM step.");
        writeLog(`Running fallback LLM for ${task._id}`);

        const llmStep = {
          type: "llm",
          prompt: task.input?.text || "Give a short summary."
        };

        const llmResult = await executeStep(llmStep, context);

        await Task.findByIdAndUpdate(task._id, {
          $push: { stepResults: llmResult }
        });

        success = llmResult.success;
      }

      // Mark task completed
      await completeTask(task._id, { success });

      console.log(`✅ Task ${task._id} completed. Success: ${success}`);
      writeLog(`Task ${task._id} completed. success=${success}`);

      // Update workflow status
      if (task.workflowId && success) {
        await Workflow.findByIdAndUpdate(task.workflowId, {
          $set: { status: "running" }
        });
      }

    } catch (error) {
      console.error("❌ Worker loop error:", error);
      writeLog(`Runner error: ${error.message}`, "error");
    }
  }
}

async function start() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("📡 MongoDB connected for Agent Runner");
    }

    runWorkerLoop();
  } catch (error) {
    console.error("Mongo init error:", error);
  }
}

async function stop() {
  console.log("🛑 Stopping worker...");
  process.exit(0);
}

module.exports = { start, stop, runWorkerLoop };

if (require.main === module) {
  console.log("🚀 Starting Worker Service...");
  start();
}
