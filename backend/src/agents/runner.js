const crypto = require('crypto');
const { writeLog } = require('./logger');
const mongoose = require('mongoose');
const Task = require('../models/task.model');
const Workflow = require('../models/workflow.model');
const SystemSettings = require('../models/systemSettings.model');
const { claimNextTask, completeTask } = require('./queueService');
const { executeStep } = require('./executor');
const telemetryService = require('../services/telemetry.service');
const WORKER_ID = process.env.WORKER_ID || 'agent-1';
require('dotenv').config();

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

  if (cachedWorkerSettings && now - lastSettingsFetch < SETTINGS_REFRESH_MS) {
    return cachedWorkerSettings;
  }

  try {
    const settings = await SystemSettings.findOne().lean();

    cachedWorkerSettings = settings?.worker || SAFE_FALLBACK_SETTINGS;
    lastSettingsFetch = now;

    return cachedWorkerSettings;
  } catch (err) {
    console.error('⚠️ Failed to load worker settings:', err.message);
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

  console.log('👷 Agent Runner Started… waiting for tasks');
  writeLog('Runner started', 'info', { workerId: WORKER_ID });

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
        status: 'running',
        startedAt: new Date(),
      });

      const traceId = crypto.randomUUID();

      writeLog(`Task claimed: ${task._id}`, 'info', {
        workerId: WORKER_ID,
        taskId: task._id,
        workflowId: task.workflowId,
        traceId
      });

      const workflow = task.workflowId ? await Workflow.findById(task.workflowId).lean() : null;

      let agent = null;

      if (workflow?.agentId) {
        const Agent = require('../models/agent.model');
        agent = await Agent.findById(workflow.agentId).lean();
      }

      const now = new Date();
      const context = {
        ...(task.input || {}),
        input: task.input || {},
        timestampIso: now.toISOString(),
        timestamp: now.toLocaleString('en-US', {
          dateStyle: 'long',
          timeStyle: 'short',
        }),
        date: now.toLocaleDateString('en-US', { dateStyle: 'long' }),
        time: now.toLocaleTimeString('en-US', { timeStyle: 'short' }),
        workflow,
        taskId: task._id,
        userId: task.userId,
        traceId,
        results: [],
        steps: {},
      };

      if (Array.isArray(task.stepResults)) {
        task.stepResults.forEach((res) => {
          if (res && res.stepId) {
            context.steps[res.stepId] = res;
            context.results.push(res);
          }
        });
        if (task.stepResults.length > 0) {
          const lastRes = task.stepResults[task.stepResults.length - 1];
          context.last = { input: lastRes.input, output: lastRes.output };
        }
      }

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
        writeLog(`Executing ${steps.length} steps…`, 'info', {
          workerId: WORKER_ID,
          taskId: task._id,
          workflowId: task.workflowId,
          traceId
        });

        function getStepId(step) {
          return step?.stepId || step?.id || step?.name;
        }

        const stepsMap = {};
        steps.forEach((s) => {
          if (s) {
            if (s.type) s.type = String(s.type).toLowerCase();
            stepsMap[getStepId(s)] = s;
          }
        });

        // -------------------------------------------------------------
        // 🔥 DETERMINISTIC REPLAY RESUMABLE EXECUTION
        // -------------------------------------------------------------
        const targetSet = new Set(edges.map((e) => e.target));
        const entryStep = steps.find(
              (s) => !targetSet.has(getStepId(s))
            );

            let currentStep = entryStep;

            if (
              task.executionMode === 'partial' &&
              typeof task.currentStep === 'number'
            ) {
              currentStep = steps[task.currentStep] || entryStep;

              writeLog(
                `[Replay] Resuming task from step index ${task.currentStep}`,
                'info',
                {
                  workerId: WORKER_ID,
                  taskId: task._id,
                  workflowId: task.workflowId,
                  traceId,
                }
              );
            }

        function getNextEdge(stepLocal, resultLocal) {
          if (stepLocal.type === 'condition') {
            return edges.find(
              (e) => e.source === getStepId(stepLocal) && e.condition === resultLocal.branch
            );
          }
          if (stepLocal.type === 'switch') {
            const normalize = (v) =>
              String(v || '')
                .toLowerCase()
                .trim();
            const value = normalize(resultLocal.caseValue);
            const nextEdge = edges.find((e) => {
              if (e.source !== getStepId(stepLocal)) return false;
              return value.includes(normalize(e.caseValue));
            });
            return nextEdge || edges.find((e) => e.source === getStepId(stepLocal) && !e.caseValue);
          }
          return edges.find((e) => e.source === getStepId(stepLocal));
        }

        async function processBranch(startStep, branchContext, isSubBranch = false) {
          let stepNode = startStep;
          let stepCount = 0;
          const branchSuccess = true;

          while (stepNode && stepCount < 50) {
            stepCount++;
            const sId = getStepId(stepNode);
            if ((stepNode.type === 'join' || stepNode.type === 'Join') && isSubBranch) {
              return { success: true, branchContext, joinNode: stepNode };
            }
            if (stepNode.type === 'parallel' || stepNode.type === 'Parallel') {
              const outEdges = edges.filter((e) => e.source === sId);
              if (outEdges.length < 2) {
                const errMsg = `Runtime Error: Parallel node requires at least 2 branches.`;
                console.error(`❌ ${errMsg}`);

                const errorResult = {
                  stepId: sId,
                  type: 'parallel',
                  input: 'Branch Validation',
                  output: errMsg,
                  success: false,
                  timestamp: new Date(),
                };

                await Task.findByIdAndUpdate(task._id, { $push: { stepResults: errorResult } });
                branchContext.results.push(errorResult);

                return { success: false, branchContext };
              }

              const strategy = stepNode.failureStrategy || 'fail-fast';

              const isCached =
                Array.isArray(task.stepResults) &&
                task.stepResults.some((r) => r && r.stepId === sId && r.type === 'parallel');

              const parallelStartResult = {
                stepId: sId,
                type: 'parallel',
                input: 'Parallel Execution Start',
                output: `${outEdges.length} branches spawned concurrently...`,
                success: true,
                timestamp: new Date(),
              };

              if (!isCached) {
                await Task.findByIdAndUpdate(task._id, {
                  $push: { stepResults: parallelStartResult },
                });
              }
              branchContext.results.push(parallelStartResult);

              const branchPromises = outEdges.map((edge) => {
                const targetStep = stepsMap[edge.target];
                const isolatedContext = {
                  ...branchContext,
                  results: [...branchContext.results],
                  steps: { ...(branchContext.steps || {}) },
                  last: branchContext.last ? { ...branchContext.last } : null,
                };
                return processBranch(targetStep, isolatedContext, true);
              });

              let branchResults = [];
              let parallelSuccess = true;

              if (strategy === 'fail-fast') {
                branchResults = await Promise.all(branchPromises);
                if (branchResults.some((r) => !r.success)) parallelSuccess = false;
              } else {
                const settled = await Promise.allSettled(branchPromises);
                branchResults = settled.map((res) => {
                  if (res.status === 'fulfilled') {
                    if (!res.value.success) parallelSuccess = false;
                    return res.value;
                  } else {
                    parallelSuccess = false;
                    return { success: false, branchContext: { last: { output: res.reason } } };
                  }
                });
              }

              const aggregatedOutputs = {};
              const flatOutputs = [];
              branchResults.forEach((r, index) => {
                const targetId = outEdges[index].target;
                const outputVal = r.branchContext?.last?.output || null;
                aggregatedOutputs[targetId] = outputVal;
                flatOutputs.push(outputVal);
              });

              branchContext.parallel = { results: aggregatedOutputs, flat: flatOutputs };
              branchContext.last = { output: aggregatedOutputs };

              if (!parallelSuccess && strategy === 'fail-fast')
                return { success: false, branchContext };

              const uniqueJoinNodes = [
                ...new Set(
                  branchResults.map((r) => (r.joinNode ? getStepId(r.joinNode) : 'MISSING_JOIN'))
                ),
              ];

              if (uniqueJoinNodes.includes('MISSING_JOIN') || uniqueJoinNodes.length > 1) {
                const errMsg = `Join Synchronization Failed: All branches must converge to exactly one Join node. Detected: [${uniqueJoinNodes.join(', ')}]`;
                console.error(`❌ ${errMsg}`);

                const errorResult = {
                  stepId: sId,
                  type: 'join',
                  input: 'Checking branch convergence',
                  output: errMsg,
                  success: false,
                  timestamp: new Date(),
                };

                await Task.findByIdAndUpdate(task._id, { $push: { stepResults: errorResult } });
                branchContext.results.push(errorResult);

                return { success: false, branchContext };
              }

              const joinNode = branchResults.find((r) => r.joinNode)?.joinNode || null;

              if (joinNode) {
                const joinResult = {
                  stepId: getStepId(joinNode),
                  type: 'join',
                  input: aggregatedOutputs,
                  output: aggregatedOutputs,
                  success: true,
                  timestamp: new Date(),
                };

                const isJoinCached =
                  Array.isArray(task.stepResults) &&
                  task.stepResults.some(
                    (r) => r && r.stepId === getStepId(joinNode) && r.type === 'join'
                  );
                if (!isJoinCached) {
                  await Task.findByIdAndUpdate(task._id, { $push: { stepResults: joinResult } });
                }
                branchContext.results.push(joinResult);

                const nextEdge = getNextEdge(joinNode, joinResult);
                if (!nextEdge) break;
                stepNode = stepsMap[nextEdge.target];
                continue;
              } else {
                break;
              }
            }
            let result;
            const cachedResult = Array.isArray(task.stepResults)
              ? task.stepResults.find(
                  (r) =>
                    r &&
                    r.stepId === getStepId(stepNode) &&
                    r.type !== 'parallel' &&
                    r.type !== 'join' &&
                    r.success === true
                )
              : null;

            if (cachedResult) {
              writeLog(`[Replay] Fast-forwarding previously executed step: ${stepNode.name}`, 'info', {
                workerId: WORKER_ID, taskId: task._id, workflowId: task.workflowId, traceId: branchContext.traceId
              });
              result = cachedResult;
              // The specific stepResult will already contain the updated output/feedback
              // from when the user approved or rejected it via the API.
            } else {
              writeLog(`Executing Step: ${stepNode.name} (${stepNode.type})`, 'info', {
                workerId: WORKER_ID, taskId: task._id, workflowId: task.workflowId, traceId: branchContext.traceId
              });
              result = await executeStep(stepNode, branchContext, agent);
              
              if (!result) {
                throw new Error(
                  `executeStep returned ${result} for step ${stepNode.name} (${stepNode.type})`
                );
              }
              result.name = stepNode.name;
              result.type = stepNode.type;
              await Task.findByIdAndUpdate(task._id, { $push: { stepResults: result } });
            }

            branchContext.results.push(result);
            branchContext.steps = branchContext.steps || {};
            const sId2 = getStepId(stepNode);
            branchContext.steps[sId2] = result;
            if (stepNode.alias && stepNode.alias !== sId2) {
              branchContext.steps[stepNode.alias] = result;
            }
            branchContext.last = { input: result.input, output: result.output };

            if (!result.success) return { success: false, branchContext };

            const nextEdge = getNextEdge(stepNode, result);
            const nextStepId = nextEdge ? nextEdge.target : null;

            // ── HITL: Pause execution if this step requires human approval ──
            if (result.requiresApproval && !cachedResult) {
              await Task.findByIdAndUpdate(task._id, {
                $set: {
                  status: 'pending_approval',
                  approval: {
                    stepId: getStepId(stepNode),
                    requestedAt: new Date(),
                  },
                },
              });
              writeLog(`Task ${task._id} paused for approval at step ${getStepId(stepNode)}`, 'info', {
                workerId: WORKER_ID,
                taskId: task._id,
                stepId: getStepId(stepNode),
                traceId: branchContext.traceId
              });
              return { success: false, branchContext, paused: true };
            }

            if (!nextEdge) break;
            stepNode = stepsMap[nextEdge.target];
          }

          return { success: branchSuccess, branchContext };
        }
        const finalExecution = await processBranch(currentStep, context, false);
        if (finalExecution.paused) continue; // Move on to next task if paused for HITL
        success = finalExecution.success;
      } else {
        const llmResult = await executeStep(
          {
            type: 'llm',
            prompt: task.input?.text || 'Give a short summary.',
          },
          context,
          agent
        );

        await Task.findByIdAndUpdate(task._id, {
          $push: { stepResults: llmResult },
        });

        success = llmResult.success;
      }

      await completeTask(task._id, { success });

      const durationMs = task.startedAt ? Date.now() - new Date(task.startedAt).getTime() : 0;

      const stepTypes = context.results.map((result) => result.type || 'unknown');
      telemetryService.recordTaskMetrics({ stepTypes, durationMs }).catch((err) => {
        console.error('Telemetry failed:', err.message || err);
      });

      writeLog(`Task ${task._id} completed. Success: ${success}`, 'info', {
        workerId: WORKER_ID,
        taskId: task._id,
        workflowId: task.workflowId,
        traceId: context.traceId
      });
    } catch (error) {
      console.error('❌ Worker loop error:', error);
      await sleep(SAFE_FALLBACK_SETTINGS.pollIntervalMs);
    }
  }
}

async function start() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📡 MongoDB connected for Agent Runner');
  }
  runWorkerLoop();
}

module.exports = { start, runWorkerLoop };

if (require.main === module) {
  start();
}
