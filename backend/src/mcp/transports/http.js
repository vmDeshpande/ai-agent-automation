const { McpError } = require("../errors");

function createHttpTransport(server) {
  try {
    const {
      StreamableHTTPClientTransport,
    } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

    const headers = {
      ...(server.headers || {}),
    };

    return new StreamableHTTPClientTransport(new URL(server.url), {
      requestInit: {
        headers,
      },
    });
  } catch (error) {
    throw new McpError(
      `Failed to initialize streamable HTTP transport for "${server.id}": ${error.message}`,
      {
        code: "MCP_TRANSPORT_INIT_FAILED",
        status: 500,
      }
    );
  }
}

module.exports = { createHttpTransport };
