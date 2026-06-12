const { McpError } = require("../errors");

function createStdioTransport(server) {
  try {
    const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

    return new StdioClientTransport({
      command: server.command,
      args: Array.isArray(server.args) ? server.args : [],
      env:
        server.env && Object.keys(server.env).length > 0
          ? { ...process.env, ...server.env }
          : process.env,
      stderr: "pipe",
    });
  } catch (error) {
    throw new McpError(
      `Failed to initialize stdio transport for "${server.id}": ${error.message}`,
      {
        code: "MCP_TRANSPORT_INIT_FAILED",
        status: 500,
      }
    );
  }
}

module.exports = { createStdioTransport };
