// backend/src/tools/registry.js
const { fork } = require("child_process");
const path = require("path");
const fs = require("fs");

const toolRegistryMap = {};
const toolMetadata = [];

function loadTools() {
  const files = fs.readdirSync(__dirname);
  for (const file of files) {
    if (file.endsWith(".js") && file !== "index.js" && file !== "registry.js" && file !== "sandboxWorker.js" && file !== "testSandbox.js") {
      try {
        const toolMod = require(path.join(__dirname, file));
        if (toolMod && toolMod.meta && toolMod.meta.id) {
          const id = toolMod.meta.id.toLowerCase();
          const toolName = file.replace(".js", "");
          toolRegistryMap[id] = toolName;
          toolMetadata.push(toolMod.meta);
        } else {
          console.warn(`[ToolRegistry] Skipping ${file}: missing or invalid meta schema`);
        }
      } catch (err) {
        console.error(`[ToolRegistry] Failed to load ${file}:`, err.message);
      }
    }
  }
}

// Initialize tools on startup
loadTools();

function hasTool(type) {
  if (!type) return false;
  return !!toolRegistryMap[type.toLowerCase()];
}

function getToolMetadata() {
  return toolMetadata;
}

async function dispatchTool(type, step, context) {
  const toolName = toolRegistryMap[type.toLowerCase()];
  if (!toolName) {
    throw new Error(`Execution Contract Violation: Missing tool registration for type '${type}'`);
  }

  // Standard interface method "run" with arguments wrapped in the classic signature array
  return await runToolInSandbox(toolName, "run", [step, context]);
}

function runToolInSandbox(toolName, functionName, args = []) {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "sandboxWorker.js");

    const uid = process.env.TOOL_SANDBOX_UID ? Number(process.env.TOOL_SANDBOX_UID) : undefined;
    const gid = process.env.TOOL_SANDBOX_GID ? Number(process.env.TOOL_SANDBOX_GID) : undefined;
    const timeoutMs = process.env.TOOL_EXECUTION_TIMEOUT_MS ? Number(process.env.TOOL_EXECUTION_TIMEOUT_MS) : 30000;

    const allowedEnv = { IS_SANDBOX: "true" };

    const SYSTEM_ENV_VARS = ["PATH", "HOME", "USER", "NODE_ENV", "PWD"];
    for (const key of SYSTEM_ENV_VARS) {
      if (process.env[key] !== undefined) {
        allowedEnv[key] = process.env[key];
      }
    }

    const TOOL_CONFIG_VARS = [
      "FILE_BASE_DIR", "PUPPETEER_HEADLESS",
      "MAIL_HOST", "MAIL_PORT", "MAIL_USER", "MAIL_PASS", "MAIL_FROM",
      "EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM",
      "GITHUB_TOKEN", "SLACK_WEBHOOK_URL", "DISCORD_WEBHOOK_URL"
    ];
    for (const key of TOOL_CONFIG_VARS) {
      if (process.env[key] !== undefined) {
        allowedEnv[key] = process.env[key];
      }
    }

    const forkOpts = {
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      execArgv: ["--max-old-space-size=256"],
      env: allowedEnv
    };

    if (uid !== undefined && !isNaN(uid)) forkOpts.uid = uid;
    if (gid !== undefined && !isNaN(gid)) forkOpts.gid = gid;

    const child = fork(workerPath, [], forkOpts);
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { child.kill("SIGKILL"); } catch (e) {}
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    child.on("message", (response) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      if (response && response.success) {
        resolve(response.result);
      } else {
        reject(new Error(response ? response.error : "Unknown execution error"));
      }
    });

    child.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("exit", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Sandbox worker exited with code ${code}`));
      } else {
        resolve(null);
      }
    });

    child.send({ toolName, functionName, args });
  });
}

module.exports = { 
  runToolInSandbox,
  hasTool,
  dispatchTool,
  getToolMetadata
};