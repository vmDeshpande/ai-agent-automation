const {
  getUserMcpConfig,
  getClient,
  markServerError,
  reconnectClient,
  getCachedHealth,
} = require("./clientManager");
const { sanitizeServerConfig } = require("./config");
const { McpError, toMcpError } = require("./errors");

function normalizeTool(server, tool) {
  return {
    id: `${server.id}:${tool.name}`,
    name: tool.name,
    description: tool.description || "",
    inputSchema: tool.inputSchema || { type: "object", properties: {} },
    serverId: server.id,
    serverName: server.name,
    source: "mcp",
    timeoutMs: server.timeoutMs,
  };
}

async function listToolsForServer(userId, server) {
  try {
    const { client } = await getClient(userId, server.id);
    const result = await client.listTools();
    const tools = Array.isArray(result?.tools) ? result.tools : [];

    return tools.map((tool) => normalizeTool(server, tool));
  } catch (error) {
    markServerError(userId, server.id, error);

    try {
      const { client } = await reconnectClient(userId, server.id);
      const result = await client.listTools();
      const tools = Array.isArray(result?.tools) ? result.tools : [];
      return tools.map((tool) => normalizeTool(server, tool));
    } catch (retryError) {
      throw toMcpError(retryError, {
        code: "MCP_DISCOVERY_FAILED",
        status: 502,
        message: `Failed to discover tools for MCP server "${server.id}"`,
      });
    }
  }
}

async function listServers(userId) {
  const config = await getUserMcpConfig(userId);

  if (!config.enabled) {
    return {
      enabled: false,
      servers: [],
    };
  }

  return {
    enabled: true,
    servers: config.servers.map((server) => {
      const cached = getCachedHealth(userId, server.id);
      return {
        ...sanitizeServerConfig(server),
        health: cached
          ? {
              healthy: cached.healthy !== false,
              lastConnectedAt: cached.lastConnectedAt || null,
              lastError: cached.lastError || null,
              lastErrorAt: cached.lastErrorAt || null,
            }
          : {
              healthy: null,
              lastConnectedAt: null,
              lastError: null,
              lastErrorAt: null,
            },
      };
    }),
  };
}

async function listTools(userId) {
  const config = await getUserMcpConfig(userId);

  if (!config.enabled) {
    return [];
  }

  const toolGroups = await Promise.all(
    config.servers.map(async (server) => {
      try {
        const tools = await listToolsForServer(userId, server);
        return tools;
      } catch (error) {
        console.error(`[MCP] tool discovery failed for ${server.id}: ${error.message}`);
        return [];
      }
    })
  );

  return toolGroups.flat();
}

async function getToolByName(userId, serverId, toolName) {
  const tools = await listTools(userId);
  const match = tools.find(
    (tool) => tool.serverId === serverId && tool.name === toolName
  );

  if (!match) {
    throw new McpError(
      `MCP tool "${toolName}" was not found on server "${serverId}"`,
      {
        code: "MCP_TOOL_NOT_FOUND",
        status: 404,
      }
    );
  }

  return match;
}

module.exports = {
  listServers,
  listTools,
  getToolByName,
};
