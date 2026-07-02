const { getClient, markServerError, reconnectClient } = require("./clientManager");
const { getToolByName } = require("./toolRegistry");
const { McpError, toMcpError } = require("./errors");

function deepInterpolate(value, context, interpolate) {
  if (typeof value === "string") {
    const interpolated = interpolate(value, context);

    try {
      return JSON.parse(interpolated);
    } catch {
      return interpolated;
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => deepInterpolate(entry, context, interpolate));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        deepInterpolate(entry, context, interpolate),
      ])
    );
  }

  return value;
}

function normalizeToolResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }

  const textBlocks = Array.isArray(result.content)
    ? result.content
        .filter((entry) => entry?.type === "text")
        .map((entry) => entry.text)
        .filter(Boolean)
    : [];

  return {
    ...result,
    text: textBlocks.join("\n").trim(),
  };
}

async function callTool(userId, serverId, toolName, args, timeoutMs) {
  try {
    const { client } = await getClient(userId, serverId);
    return await client.callTool({
      name: toolName,
      arguments: args,
    }, undefined, {
      timeout: timeoutMs,
      maxTotalTimeout: timeoutMs,
    });
  } catch (error) {
    markServerError(userId, serverId, error);

    try {
      const { client } = await reconnectClient(userId, serverId);
      return await client.callTool({
        name: toolName,
        arguments: args,
      }, undefined, {
        timeout: timeoutMs,
        maxTotalTimeout: timeoutMs,
      });
    } catch (retryError) {
      throw toMcpError(retryError, {
        code: "MCP_EXECUTION_FAILED",
        status: 502,
        message: `Failed to execute MCP tool "${toolName}" on server "${serverId}"`,
      });
    }
  }
}

async function invokeTool({
  userId,
  serverId,
  toolName,
  argumentsInput,
  context,
  interpolate,
  timeoutMs,
}) {
  if (!userId) {
    throw new McpError("MCP invocation requires user context", {
      code: "MCP_USER_CONTEXT_REQUIRED",
      status: 400,
    });
  }

  const tool = await getToolByName(userId, serverId, toolName);
  const args =
    typeof argumentsInput === "undefined" || argumentsInput === null
      ? {}
      : deepInterpolate(argumentsInput, context, interpolate);

  const result = await callTool(
    userId,
    serverId,
    toolName,
    args,
    timeoutMs || tool.timeoutMs,
  );

  return {
    tool,
    args,
    result: normalizeToolResult(result),
  };
}

module.exports = {
  invokeTool,
};
