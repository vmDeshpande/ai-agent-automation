require('dotenv').config();
const { performance } = require('perf_hooks');
const { ExecutionError, TimeoutError } = require('./utils/errors');
const { writeLog } = require('./logger');

const handlers = {
  llm: require('./handlers/llm.handler'),
  delay: require('./handlers/delay.handler'),
  http: require('./handlers/http.handler'),
  email: require('./handlers/email.handler'),
  file: require('./handlers/file.handler'),
  browser: require('./handlers/browser.handler'),
  document_query: require('./handlers/document.handler'),
  condition: require('./handlers/condition.handler'),
  switch: require('./handlers/switch.handler'),
  mcp: require('./handlers/mcp.handler'),
  tool: require('./handlers/tool.handler'),
  approval: require('./handlers/approval.handler'),
  agent_call: require('./handlers/agentCall.handler'),
};

async function executeStep(step, context = {}, agent = null) {
  const validatedStepId = step.stepId || step.id || step.name || null;
  const explicitTimeout = Number(step.timeoutMs ?? step.timeout);
  const finalTimeoutMs = !isNaN(explicitTimeout) && explicitTimeout > 0 ? explicitTimeout : 30000;

  const stepConfig = step.config || step; 
  const maxRetries = Math.max(0, Number(stepConfig.maxRetries) || 0);
  const backoffMultiplier = Math.max(1, Number(stepConfig.backoffMultiplier) || 1);
  let currentBackoffMs = 1000; 
  let stepAgent = agent; 
  if (stepConfig.agentId) {
    try {
      const AgentModel = require('../models/agent.model'); 
      const fetchedAgent = await AgentModel.findOne({ 
        _id: stepConfig.agentId, 
        userId: context.userId 
      }).lean();
      
      if (fetchedAgent) {
        stepAgent = fetchedAgent;
      } else {
        writeLog(`Step agent ${stepConfig.agentId} not found, falling back to global agent.`, 'warn', { taskId: context?.taskId });
      }
    } catch (dbErr) {
      writeLog(`Failed to fetch step agent: ${dbErr.message}`, 'error', { taskId: context?.taskId });
    }
  }

  let lastResult = null;
  const stepStartTimeMs = performance.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new TimeoutError(`Step execution timed out after ${finalTimeoutMs}ms`, { configuredTimeoutMs: finalTimeoutMs }));
      }, finalTimeoutMs);
    });

    try {
      const result = await Promise.race([
        internalExecuteStep(step, context, stepAgent, validatedStepId, finalTimeoutMs),
        timeoutPromise,
      ]);

      lastResult = result;

      if (result.success || result.requiresApproval) {
        if (!result.requiresApproval) {
          result.durationMs = Math.round(performance.now() - stepStartTimeMs);
        }
        return result;
      }

      if (attempt < maxRetries) {
        writeLog(
          `Step '${validatedStepId}' failed (Attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${currentBackoffMs}ms...`, 
          'warn', 
          { 
            traceId: context?.traceId,
            taskId: context?.taskId,
            workflowId: context?.workflow?._id 
          }
        );
        await new Promise(res => setTimeout(res, currentBackoffMs));
        currentBackoffMs = Math.floor(currentBackoffMs * backoffMultiplier);
        continue;
      }

    } catch (err) {
      let normalizedError;

      if (err instanceof ExecutionError) {
        normalizedError = err;
      } else if (err?.message && (err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('timed out'))) {
        normalizedError = new TimeoutError(err.message, { configuredTimeoutMs: finalTimeoutMs });
      } else {
        normalizedError = new ExecutionError(
          err?.message || 'Unknown execution error',
          'UNKNOWN_ERROR',
          { rawName: err?.name }
        );
      }

      const isTimeout = normalizedError instanceof TimeoutError;

      lastResult = {
        stepId: validatedStepId,
        type: step.type || 'unknown',
        tool: step.tool || 'unknown',
        success: false,
        timestamp: new Date(),
        input: isTimeout ? '[timeout]' : '[error]',
        output: normalizedError.message,
        error: err.stack ? String(err.stack).slice(0, 2000) : undefined,
        errorMetadata: {
          code: normalizedError.code,
          name: normalizedError.name,
          details: normalizedError.details
        },
        durationMs: Math.round(performance.now() - stepStartTimeMs)
      };

      if (attempt < maxRetries) {
        writeLog(
          `Step '${validatedStepId}' threw error (Attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${currentBackoffMs}ms...`, 
          'warn', 
          { 
            traceId: context?.traceId,
            taskId: context?.taskId,
            workflowId: context?.workflow?._id 
          }
        );
        await new Promise(res => setTimeout(res, currentBackoffMs));
        currentBackoffMs = Math.floor(currentBackoffMs * backoffMultiplier);
        continue;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  if (lastResult && !lastResult.durationMs && !lastResult.requiresApproval) {
    lastResult.durationMs = Math.round(performance.now() - stepStartTimeMs);
  }
  
  return lastResult;
}

async function internalExecuteStep(step, context, agent, validatedStepId, timeoutMs) {
  const stepType = String(step.type || '').toLowerCase();
  
  const handler = handlers[stepType];

  if (!handler) {
    return {
      stepId: validatedStepId,
      type: stepType,
      output: `Unknown step type: ${stepType}`,
      success: false,
      timestamp: new Date(),
    };
  }

  return handler.execute(
    step,
    context,
    agent,
    validatedStepId,
    timeoutMs
  );
}

module.exports = { executeStep };
