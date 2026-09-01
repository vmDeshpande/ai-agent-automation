const { McpError } = require('../errors');
const { validateUrl } = require('../../agents/utils/ssrfProtection');

function createHttpTransport(server) {
  try {
    const {
      StreamableHTTPClientTransport,
    } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

    const headers = {
      ...(server.headers || {}),
    };

    const serverUrl = server.url || '';
    const validatedUrl = validateUrl(serverUrl);

    return new StreamableHTTPClientTransport(new URL(validatedUrl), {
      requestInit: {
        headers,
      },
    });
  } catch (error) {
    throw new McpError(
      `Failed to initialize streamable HTTP transport for "${server.id}": ${error.message}`,
      {
        code: 'MCP_TRANSPORT_INIT_FAILED',
        status: 500,
      }
    );
  }
}

module.exports = { createHttpTransport };
