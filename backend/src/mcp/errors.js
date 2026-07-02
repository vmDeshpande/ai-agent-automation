class McpError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "McpError";
    this.code = options.code || "MCP_ERROR";
    this.status = options.status || 500;
    this.details = options.details;
  }
}

function toMcpError(error, fallback = {}) {
  if (error instanceof McpError) {
    return error;
  }

  const message = error?.message || fallback.message || "MCP operation failed";
  const code = fallback.code || "MCP_ERROR";
  const status = fallback.status || 500;

  return new McpError(message, {
    code,
    status,
    details: error?.details,
  });
}

function getSafeErrorPayload(error) {
  const err = toMcpError(error);

  return {
    code: err.code,
    message: err.message,
    details: err.details,
  };
}

module.exports = {
  McpError,
  toMcpError,
  getSafeErrorPayload,
};
