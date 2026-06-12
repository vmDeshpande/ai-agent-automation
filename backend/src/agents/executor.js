// backend/src/agents/executor.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { runLLM } = require("./llmAdapter");
const { runGitHub } = require("../integrations/github");
const { runSlack } = require("../integrations/slack");
const { runDiscord } = require("../integrations/discord");
const { invokeTool: invokeMcpTool } = require("../mcp/executionAdapter");
require("dotenv").config();

function resolveWorkflowFilePath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw new Error("Invalid file path");
  }

  if (filePath.includes("\0")) {
    throw new Error("Invalid file path");
  }

  if (path.isAbsolute(filePath) || path.win32.isAbsolute(filePath)) {
    throw new Error("Invalid file path: absolute paths are not allowed");
  }

  const workflowBaseDir = path.resolve(
    process.cwd(),
    "runtime",
    "workflow-files"
  );

  const resolvedPath = path.resolve(workflowBaseDir, filePath);
  const relativePath = path.relative(workflowBaseDir, resolvedPath);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Invalid file path: path escapes workflow directory");
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
      internalExecuteStep(step, context, agent, validatedStepId),
      timeoutPromise
    ]);

    return result;
  } catch (err) {
    // 5. Explicitly intercept timeout errors and bubble up failure signature
    const isTimeout = err.message?.includes("timed out");
    return {
      stepId: validatedStepId,
      type: step.type || "unknown",
      tool: step.tool || "unknown",
      input: isTimeout ? "[timeout]" : "[error]",
      output: err.message,
      success: false,
      error: err.stack ? String(err.stack).slice(0, 2000) : undefined,
      timestamp: new Date()
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Isolated Tool Processing Logic
 */
async function internalExecuteStep(step, context, agent, validatedStepId) {
  // ----- LLM -----
  if (step.type === "llm") {
    const prompt = interpolate(step.prompt, context);
    let finalPrompt = prompt;
    let memoryMetrics = null;

    if (step.useMemory && agent) {
      const { retrieveMemory } = require("../services/memoryService");
      const memories = await retrieveMemory(agent, prompt, step.memoryTopK || 5);

      if (memories.length > 0) {
        const similarityScores = memories.map((m) =>
          typeof m.score === "number" ? m.score : 0
        );
        const averageSimilarity =
          similarityScores.reduce((acc, s) => acc + s, 0) / similarityScores.length;

        memoryMetrics = {
          useMemory: true,
          retrievedMemoriesCount: memories.length,
          similarityScores,
          averageSimilarity: Math.round(averageSimilarity * 1000) / 1000
        };

        const MAX_MEMORY_CHARS = 4000;
        let memoryText = memories
          .map((m, i) => {
            const parsed = JSON.parse(m.content);
            return `Memory ${i + 1}:\nUser: ${parsed.user}\nAssistant: ${parsed.assistant}`;
          })
          .join("\n\n");

        if (memoryText.length > MAX_MEMORY_CHARS) {
          memoryText = memoryText.slice(0, MAX_MEMORY_CHARS);
        }

        finalPrompt = `SYSTEM INSTRUCTION:
You are an AI agent with persistent memory.
The following MEMORY is factual and must be used when answering.

MEMORY:
${memoryText}

USER QUESTION:
${prompt}

Use the MEMORY section to answer the question.`;
      } else {
        memoryMetrics = {
          useMemory: true,
          retrievedMemoriesCount: 0,
          similarityScores: [],
          averageSimilarity: 0
        };
      }
    }

    const llmRes = await runLLM(finalPrompt, {
      provider: agent?.config?.provider,
      model: agent?.config?.model,
      temperature: agent?.config?.temperature,
      ...step.options
    });

    const result = {
      stepId: validatedStepId,
      type: "llm",
      tool: "llm",
      input: prompt,
      output: llmRes.text,
      raw: llmRes.raw,
      success: true,
      timestamp: new Date(),
      ...(memoryMetrics ? { metrics: memoryMetrics } : {})
    };

    if (step.useMemory && agent && llmRes.text) {
      const { storeMemory } = require("../services/memoryService");
      await storeMemory(agent, JSON.stringify({ user: prompt, assistant: llmRes.text }), {
        taskId: context.taskId,
        workflowId: context.workflow?._id,
        type: "conversation"
      });
    }

    return result;
  }

  // Delay step
  if (step.type === "delay") {
    const sec = Number(step.seconds ?? step.delay ?? step.prompt ?? 0);
    console.log("⏳ Delay step → sleeping for", sec, "seconds");
    await new Promise(resolve => setTimeout(resolve, sec * 1000));

    return {
      stepId: validatedStepId,
      type: "delay",
      tool: "delay",
      input: sec,
      output: `Slept for ${sec} seconds`,
      success: true,
      timestamp: new Date(),
    };
  }

  // ----- HTTP -----
  if (step.type === "http") {
    let parsedBody = null;
    if (step.body) {
      const interpolated = interpolate(step.body, context);
      try { parsedBody = JSON.parse(interpolated); } catch (err) { parsedBody = interpolated; }
    }

    const response = await axios({
      method: (step.method || "GET").toLowerCase(),
      url: interpolate(step.url || "", context),
      data: parsedBody,
      headers: step.headers || {},
      timeout: step.timeout || 30000,
      validateStatus: () => true,
    });

    return {
      stepId: validatedStepId,
      type: "http",
      tool: "http",
      input: interpolate(step.url || "", context),
      output: response.data,
      success: response.status >= 200 && response.status < 300,
      timestamp: new Date()
    };
  }

  // ----- EMAIL -----
  if (step.type === "email") {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const to = interpolate(step.to || "", context);
    const subject = interpolate(step.subject || "", context);
    const text = interpolate(step.text || "", context);
    const html = interpolate(step.html || "", context);

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to, subject, text, html,
    });

    return {
      stepId: validatedStepId,
      type: "email",
      tool: "email",
      input: { to, subject, text, html },
      output: { messageId: info.messageId, accepted: info.accepted },
      success: true,
      timestamp: new Date(),
    };
  }

  // ----- FILE -----
  if (step.type === "file") {
    const action = (step.action || "read").toLowerCase();
    const requestedPath = step.path ? interpolate(step.path, context) : `stepName_${step.name}_TaskId_${context.taskId}.txt`;
    const resolvedPath = resolveWorkflowFilePath(requestedPath);
    const content = interpolate(step.content || "", context);
    const { runToolInSandbox } = require("../tools/registry");

    if (action === "write") {
      const res = await runToolInSandbox("fileTool", "write", [resolvedPath, content]);
      return { stepId: validatedStepId, type: "file", tool: "file", input: { action, path: resolvedPath, content }, output: { path: res.path }, success: true, timestamp: new Date() };
    }
    if (action === "append") {
      const res = await runToolInSandbox("fileTool", "append", [resolvedPath, content]);
      return { stepId: validatedStepId, type: "file", tool: "file", input: { action, path: resolvedPath, content }, output: { path: res.path }, success: true, timestamp: new Date() };
    }
    if (action === "read") {
      const res = await runToolInSandbox("fileTool", "read", [resolvedPath]);
      return { stepId: validatedStepId, type: "file", tool: "file", input: { action, path: resolvedPath }, output: res, success: true, timestamp: new Date() };
    }
  }

  // ----- BROWSER -----
  if (step.type === "browser") {
    const action = (step.action || "screenshot").toLowerCase();
    const url = interpolate(step.url || "", context);
    const { runToolInSandbox } = require("../tools/registry");

    if (action === "screenshot") {
      const outPath = path.join("runtime", `screenshot_${context.taskId}_${Date.now()}.png`);
      const res = await runToolInSandbox("browserTool", "screenshot", [url, { path: outPath }]);
      return { stepId: validatedStepId, type: "browser", tool: "browser", input: { action, url }, output: { path: res.path }, success: true, timestamp: new Date() };
    }
    if (action === "evaluate") {
      const userCode = step.code || "return document.title;";
      const res = await runToolInSandbox("browserTool", "evaluate", [url, userCode]);
      return { stepId: validatedStepId, type: "browser", tool: "browser", input: { action, url, code: userCode }, output: res.result, success: !res.result?.error, timestamp: new Date() };
    }
  }

  // ----- DOCUMENT QUERY -----
  if (step.type === "document_query") {
    const { queryDocument } = require("../services/documentService");
    const query = interpolate(step.query || "", context);
    const chunks = await queryDocument(agent, context.userId, step.documentId, query, step.topK || 3);

    let contextText = chunks.map((c, i) => `Chunk ${i + 1}:\n${c.content}`).join("\n\n");
    if (contextText.length > 3000) contextText = contextText.slice(0, 3000);

    const finalPrompt = `DOCUMENT CONTEXT:\n${contextText}\n\nQUESTION:\n${query}`;
    const llmRes = await runLLM(finalPrompt, { provider: agent?.config?.provider, model: agent?.config?.model, temperature: agent?.config?.temperature });

    return { stepId: validatedStepId, type: "document_query", tool: "document", input: query, output: llmRes.text, success: true, timestamp: new Date() };
  }

  // ----- CONDITION -----
  if (step.type === "condition") {
    const normalize = (val) => String(val || "").toLowerCase().trim().replace(/[^\w\s]/g, "");
    const rawOutput = context.last?.output || "";
    const text = normalize(rawOutput);
    let evaluation = false;

    if (step.conditionType === "boolean") {
      const prompt = `Question:\n${context.results[0]?.input || ""}\n\nAnswer:\n${rawOutput}\n\nRespond only with true or false.`;
      const aiResult = await runLLM(prompt, { provider: agent?.config?.provider, model: agent?.config?.model, temperature: 0 });
      evaluation = aiResult.text.toLowerCase().includes("true");
    }
    return { stepId: validatedStepId, type: "condition", output: evaluation, branch: evaluation ? "true" : "false", success: true, timestamp: new Date() };
  }

  // ----- SWITCH -----
  if (step.type === "switch") {
    const output = String(context.last?.output || "").toLowerCase().trim();
    return { stepId: validatedStepId, type: "switch", tool: "switch", input: output, output, caseValue: output, success: true, timestamp: new Date() };
  }

  // ----- MCP -----
  if (step.type === "mcp") {
    const execution = await invokeMcpTool({
      userId: context.userId, serverId: step.serverId, toolName: step.toolName,
      argumentsInput: step.arguments, context, interpolate, timeoutMs: finalTimeoutMs,
    });
    return { stepId: validatedStepId, type: "mcp", tool: "mcp", output: execution.result, success: true, timestamp: new Date() };
  }

  // ----- GITHUB -----
  if (step.type === "github") {
    const output = await runGitHub(step, context, interpolate);
    return { stepId: validatedStepId, type: "github", tool: "github", output, success: true, timestamp: new Date() };
  }

  // ----- SLACK -----
  if (step.type === "slack") {
    const output = await runSlack(step, context, interpolate);
    return { stepId: validatedStepId, type: "slack", tool: "slack", output, success: true, timestamp: new Date() };
  }

  // ----- DISCORD -----
  if (step.type === "discord") {
    const output = await runDiscord(step, context, interpolate);
    return { stepId: validatedStepId, type: "discord", tool: "discord", output, success: true, timestamp: new Date() };
  }

  return {
    stepId: validatedStepId,
    type: step.type || "unknown",
    tool: step.tool || "unknown",
    input: null,
    output: `Unknown step type: ${step.type}`,
    success: false,
    timestamp: new Date()
  };
}

function interpolate(template = "", context = {}) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const parts = key.trim().split(".");
    let val = context;
    for (const p of parts) {
      if (val === undefined || val === null) break;
      val = val[p];
    }
    if (val === undefined || val === null) return "";
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    return String(val);
  });
}

module.exports = { executeStep };