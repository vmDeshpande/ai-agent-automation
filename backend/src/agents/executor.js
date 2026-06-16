const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { runLLM } = require('./llmAdapter');
const { invokeTool: invokeMcpTool } = require('../mcp/executionAdapter');
const { hasTool, dispatchTool } = require('../tools/registry');
require('dotenv').config();

// ─── UTILITY FUNCTIONS (MOVED TO TOP TO PREVENT REFERENCE ERRORS) ──────────────────

function interpolate(template = '', context = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const parts = key.trim().split('.');
    let val = context;
    for (const p of parts) {
      if (val === undefined || val === null) break;
      val = val[p];
    }
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  });
}

function resolveWorkflowFilePath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('Invalid file path');
  }

  if (filePath.includes('\0')) {
    throw new Error('Invalid file path');
  }

  if (path.isAbsolute(filePath) || path.win32.isAbsolute(filePath)) {
    throw new Error('Invalid file path: absolute paths are not allowed');
  }

  const workflowBaseDir = path.resolve(process.cwd(), 'runtime', 'workflow-files');
  const resolvedPath = path.resolve(workflowBaseDir, filePath);
  const relativePath = path.relative(workflowBaseDir, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid file path: path escapes workflow directory');
  }

  return resolvedPath;
}

/**
 * Core execution engine wrapper with built-in timeout enforcements
 */
async function executeStep(step, context = {}, agent = null) {
  // 1. Uniform step identification validation fallback
  const validatedStepId = step.stepId || step.id || step.name || null;

  // 2. Validate and clean timeout configuration
  const explicitTimeout = Number(step.timeoutMs ?? step.timeout);
  const finalTimeoutMs = !isNaN(explicitTimeout) && explicitTimeout > 0 ? explicitTimeout : 30000;

  // 3. Define timeout rejection promise
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Step execution timed out after ${finalTimeoutMs}ms`));
    }, finalTimeoutMs);
  });

  try {
    // 4. Race the base step process against the isolation timeout monitor
    const result = await Promise.race([
      internalExecuteStep(step, context, agent, validatedStepId, finalTimeoutMs),
      timeoutPromise,
    ]);

    return result;
  } catch (err) {
    // 5. Explicitly intercept timeout errors and bubble up failure signature
    const isTimeout = err.message?.includes('timed out');
    return {
      stepId: validatedStepId,
      type: step.type || 'unknown',
      tool: step.tool || 'unknown',
      input: isTimeout ? '[timeout]' : '[error]',
      output: err.message,
      success: false,
      error: err.stack ? String(err.stack).slice(0, 2000) : undefined,
      timestamp: new Date(),
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Isolated Tool Processing Logic - Completely Decoupled Platform Implementation
 */
async function internalExecuteStep(step, context, agent, validatedStepId, finalTimeoutMs) {
  const stepType = String(step.type || '').toLowerCase();

  // =========================
  // LLM
  // =========================
  if (stepType === 'llm') {
    const prompt = interpolate(step.prompt || '', context);
    let finalPrompt = prompt;
    let memoryMetrics = null;

    if (step.useMemory && agent) {
      const { retrieveMemory, storeMemory } = require('../services/memoryService');

      const memories = await retrieveMemory(agent, prompt, step.memoryTopK || 5);

      memoryMetrics = {
        useMemory: true,
        retrievedMemoriesCount: memories.length,
      };

      if (memories.length > 0) {
        const memoryText = memories
          .map((m, i) => {
            try {
              const parsed = JSON.parse(m.content);

              return `Memory ${i + 1}:\nUser: ${parsed.user}\nAssistant: ${parsed.assistant}`;
            } catch {
              return m.content;
            }
          })
          .join('\n\n')
          .slice(0, 4000);

        finalPrompt = `SYSTEM INSTRUCTION:\nYou are an AI agent with persistent memory.\n\nMEMORY:\n${memoryText}\n\nUSER QUESTION:\n${prompt}\n\nUse the MEMORY section when relevant.`;
      }
    }

    const llmRes = await runLLM(finalPrompt, {
      provider: agent?.config?.provider,
      model: agent?.config?.model,
      temperature: agent?.config?.temperature,
      ...step.options,
    });

    if (step.useMemory && agent && llmRes?.text) {
      const { storeMemory } = require('../services/memoryService');
      await storeMemory(
        agent,
        JSON.stringify({
          user: prompt,
          assistant: llmRes.text,
        }),
        {
          taskId: context.taskId,
          workflowId: context.workflow?._id,
          type: 'conversation',
        }
      );
    }

    return {
      stepId: validatedStepId,
      type: 'llm',
      tool: 'llm',
      input: prompt,
      output: llmRes.text,
      raw: llmRes.raw,
      success: true,
      timestamp: new Date(),
      metrics: memoryMetrics,
    };
  }

  // =========================
  // DELAY
  // =========================
  if (stepType === 'delay') {
    const sec = Number(step.seconds ?? step.delay ?? 0);

    await new Promise((resolve) => setTimeout(resolve, sec * 1000));

    return {
      stepId: validatedStepId,
      type: 'delay',
      tool: 'delay',
      input: sec,
      output: `Slept for ${sec} seconds`,
      success: true,
      timestamp: new Date(),
    };
  }

  // =========================
  // HTTP
  // =========================
  if (stepType === 'http') {
    let parsedBody = null;

    if (step.body) {
      const interpolated = interpolate(step.body, context);

      try {
        parsedBody = JSON.parse(interpolated);
      } catch {
        parsedBody = interpolated;
      }
    }

    const response = await axios({
      method: (step.method || 'GET').toLowerCase(),
      url: interpolate(step.url || '', context),
      data: parsedBody,
      headers: step.headers || {},
      timeout: step.timeout || 30000,
      validateStatus: () => true,
    });

    return {
      stepId: validatedStepId,
      type: 'http',
      tool: 'http',
      input: interpolate(step.url || '', context),
      output: response.data,
      success: response.status >= 200 && response.status < 300,
      timestamp: new Date(),
    };
  }

  // =========================
  // EMAIL
  // =========================
  if (stepType === 'email') {
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: interpolate(step.to || '', context),
      subject: interpolate(step.subject || '', context),
      text: interpolate(step.text || '', context),
      html: interpolate(step.html || '', context),
    });

    return {
      stepId: validatedStepId,
      type: 'email',
      tool: 'email',
      output: {
        messageId: info.messageId,
        accepted: info.accepted,
      },
      success: true,
      timestamp: new Date(),
    };
  }

  // =========================
  // FILE
  // =========================
  if (stepType === 'file') {
    const filePath = resolveWorkflowFilePath(step.path);

    fs.mkdirSync(path.dirname(filePath), {
      recursive: true,
    });

    if (step.action === 'read') {
      return {
        stepId: validatedStepId,
        type: 'file',
        tool: 'file',
        output: fs.readFileSync(filePath, 'utf8'),
        success: true,
        timestamp: new Date(),
      };
    }

    const content = interpolate(step.content || context.last?.output || '', context);

    if (step.action === 'append') {
      fs.appendFileSync(filePath, content);
    } else {
      fs.writeFileSync(filePath, content);
    }

    return {
      stepId: validatedStepId,
      type: 'file',
      tool: 'file',
      output: filePath,
      success: true,
      timestamp: new Date(),
    };
  }

  // =========================
  // DOCUMENT QUERY
  // =========================
  if (stepType === 'document_query') {
    const { queryDocument } = require('../services/documentService');

    const query = interpolate(step.query || '', context);

    const chunks = await queryDocument(
      agent,
      context.userId,
      step.documentId,
      query,
      step.topK || 3
    );

    const contextText = chunks
      .map((c) => c.content)
      .join('\n\n')
      .slice(0, 3000);

    const llmRes = await runLLM(`DOCUMENT CONTEXT:\n${contextText}\n\nQUESTION:\n${query}`, {
      provider: agent?.config?.provider,
      model: agent?.config?.model,
      temperature: agent?.config?.temperature,
    });

    return {
      stepId: validatedStepId,
      type: 'document_query',
      tool: 'document',
      input: query,
      output: llmRes.text,
      success: true,
      timestamp: new Date(),
    };
  }

  // =========================
  // CONDITION
  // =========================
  if (stepType === 'condition') {
    const output = String(context.last?.output || '');

    let evaluation = false;

    if (step.conditionType === 'contains') {
      evaluation = output.toLowerCase().includes(
        String(step.value || '')
          .toLowerCase()
          .trim()
      );
    } else if (step.conditionType === 'boolean') {
      const aiResult = await runLLM(`Answer only true or false:\n${output}`, {
        provider: agent?.config?.provider,
        model: agent?.config?.model,
        temperature: 0,
      });

      evaluation = aiResult.text.toLowerCase().includes('true');
    }

    return {
      stepId: validatedStepId,
      type: 'condition',
      output: evaluation,
      branch: evaluation ? 'true' : 'false',
      success: true,
      timestamp: new Date(),
    };
  }

  // =========================
  // SWITCH
  // =========================
  if (stepType === 'switch') {
    const value = String(context.last?.output || '')
      .toLowerCase()
      .trim();

    return {
      stepId: validatedStepId,
      type: 'switch',
      tool: 'switch',
      output: value,
      caseValue: value,
      success: true,
      timestamp: new Date(),
    };
  }

  // =========================
  // MCP
  // =========================
  if (stepType === 'mcp') {
    const execution = await invokeMcpTool({
      userId: context.userId,
      serverId: step.serverId,
      toolName: step.toolName,
      argumentsInput: step.arguments,
      context,
      interpolate,
      timeoutMs: finalTimeoutMs,
    });

    return {
      stepId: validatedStepId,
      type: 'mcp',
      tool: 'mcp',
      output: execution.result,
      success: true,
      timestamp: new Date(),
    };
  }

  // =========================
  // TOOL REGISTRY
  // =========================
  if (hasTool(stepType)) {
    const toolResult = await dispatchTool(stepType, step, context);

    return {
      stepId: validatedStepId,
      type: stepType,
      tool: stepType,
      output: toolResult,
      success: true,
      timestamp: new Date(),
    };
  }

  return {
    stepId: validatedStepId,
    type: stepType,
    output: `Unknown step type: ${stepType}`,
    success: false,
    timestamp: new Date(),
  };
}

module.exports = { executeStep };