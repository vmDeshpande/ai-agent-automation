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

    // Important: do not depend on args[1] when ctx is provided by the tool contract.
    // Fallback to args[1] only when ctx is null/undefined.
    const safeInterpolate = (val, ctx) => {
      return interpolate(val, ctx ?? args[1] ?? {});
    };

    let result;
    if (functionName === "run") {
      if (!Array.isArray(args)) {
        throw new Error(`Execution Contract Violation: expected args to be an array for tool "${toolName}" function "run".`);
      }

      // Standard contract: [step, context]
      if (args.length < 2) {
        throw new Error(
          `Execution Contract Violation: expected args for tool "${toolName}" function "run" to be [step, context]; received ${JSON.stringify(args)}.`
        );
      }

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