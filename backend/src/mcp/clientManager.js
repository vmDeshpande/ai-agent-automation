const SystemSettings = require("../models/systemSettings.model");
const { getResolvedMcpConfig } = require("./config");
const { createStdioTransport } = require("./transports/stdio");
const { createHttpTransport } = require("./transports/http");
const { McpError, toMcpError } = require("./errors");
const { version } = require("../../package.json");

const clientCache = new Map();

function cacheKey(userId, serverId) {
  return `${String(userId)}:${serverId}`;
}

function getTransport(server) {
  if (server.transport === "stdio") {
    return createStdioTransport(server);
  }

  if (server.transport === "streamable-http") {
    return createHttpTransport(server);
  }

  throw new McpError(`Unsupported MCP transport "${server.transport}"`, {
    code: "MCP_TRANSPORT_UNSUPPORTED",
    status: 400,
  });
}

async function getUserMcpConfig(userId) {
  const settings = await SystemSettings.findOne({ userId }).lean();
  return getResolvedMcpConfig(settings?.mcp || {});
}

async function getServerConfig(userId, serverId) {
  const config = await getUserMcpConfig(userId);

  if (!config.enabled) {
    throw new McpError("MCP is disabled for this user", {
      code: "MCP_DISABLED",
      status: 400,
    });
  }

  const server = config.servers.find((entry) => entry.id === serverId);

  if (!server) {
    throw new McpError(`MCP server "${serverId}" is not configured`, {
      code: "MCP_SERVER_NOT_FOUND",
      status: 404,
    });
  }

  return server;
}

async function createClient(server) {
  const { Client } = require("@modelcontextprotocol/sdk/client");

  const client = new Client({
    name: "ai-agent-automation",
    version: version || "unknown",
  });

  const transport = getTransport(server);

  transport.onerror = (error) => {
    console.error(`[MCP] transport error for ${server.id}:`, error.message);
  };

  transport.onclose = () => {
    console.warn(`[MCP] transport closed for ${server.id}`);
  };

  await client.connect(transport);

  return { client, transport };
}

async function getClient(userId, serverId) {
  const server = await getServerConfig(userId, serverId);
  const key = cacheKey(userId, server.id);
  const cached = clientCache.get(key);

  if (cached?.client) {
    return { ...cached, server };
  }

  try {
    const connection = await createClient(server);
    const entry = {
      ...connection,
      serverId: server.id,
      healthy: true,
      lastConnectedAt: new Date(),
      lastError: null,
    };

    clientCache.set(key, entry);
    return { ...entry, server };
  } catch (error) {
    throw toMcpError(error, {
      code: "MCP_CONNECT_FAILED",
      status: 502,
      message: `Failed to connect to MCP server "${server.id}"`,
    });
  }
}

function markServerError(userId, serverId, error) {
  const key = cacheKey(userId, serverId);
  const cached = clientCache.get(key);

  if (!cached) return;

  cached.healthy = false;
  cached.lastError = error?.message || String(error);
  cached.lastErrorAt = new Date();
}

async function disposeClient(userId, serverId) {
  const key = cacheKey(userId, serverId);
  const cached = clientCache.get(key);

  if (!cached) return;

  clientCache.delete(key);

  try {
    await cached.transport?.close?.();
  } catch (error) {
    console.warn(`[MCP] failed to close transport for ${serverId}: ${error.message}`);
  }

  try {
    await cached.client?.close?.();
  } catch (error) {
    console.warn(`[MCP] failed to close client for ${serverId}: ${error.message}`);
  }
}

async function reconnectClient(userId, serverId) {
  await disposeClient(userId, serverId);
  return getClient(userId, serverId);
}

function getCachedHealth(userId, serverId) {
  const key = cacheKey(userId, serverId);
  return clientCache.get(key) || null;
}

module.exports = {
  getUserMcpConfig,
  getServerConfig,
  getClient,
  disposeClient,
  reconnectClient,
  markServerError,
  getCachedHealth,
};
