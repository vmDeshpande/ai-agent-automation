// backend/src/tools/sandboxWorker.js
const tools = require("./index");

process.on("message", async (msg) => {
  const { toolName, functionName, args = [] } = msg;
  try {
    const tool = tools[toolName];
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found in registry.`);
    }

    // Maintainer standard expectation checklist verification
    if (typeof tool.run !== "function") {
      throw new Error(`Standardization Contract Error: Tool "${toolName}" is missing a common "run" method.`);
    }

    // Safe string interpolation utility matrix mapping logic
    const { interpolate } = require("../agents/utils/interpolate");
    const safeInterpolate = (val, ctx) => {
      const context = args[1] || {};
      return interpolate(val, ctx || context);
    };

    let result;
    if (functionName === "run") {
      // Destructure position parameters from standard verification tuples
      const [step, context] = args;
      result = await tool.run(step, context, safeInterpolate);
    } else {
      // Fallback architecture matching older test files configuration triggers
      const fn = tool[functionName];
      if (typeof fn !== "function") {
        throw new Error(`Function "${functionName}" not found on tool "${toolName}".`);
      }
      result = await fn(...(Array.isArray(args) ? args : [args]));
    }

    process.send({ success: true, result });
    process.exit(0);
  } catch (error) {
    process.send({ success: false, error: error.message });
    process.exit(1);
  }
});