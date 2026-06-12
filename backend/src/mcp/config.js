const fs = require("fs");
const path = require("path");
const { McpError } = require("./errors");

function parseJsonEnv(name) {
  const raw = process.env[name];
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new McpError(`Invalid ${name} JSON`, {
      code: "MCP_CONFIG_INVALID",
      status: 500,
    });
  }
}

function loadFileConfig(filePath) {
  if (!filePath) return null;

  const resolved = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolved)) {
    throw new McpError(`MCP config file not found: ${resolved}`, {
      code: "MCP_CONFIG_NOT_FOUND",
      status: 500,
    });
  }

  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    throw new McpError(`Invalid MCP config file: ${resolved}`, {
      code: "MCP_CONFIG_INVALID",
      status: 500,
    });
  }
}

function normalizeServerConfig(server, source = "settings") {
  if (!server || typeof server !== "object") {
    return null;
  }

  const transport = String(
    server.transport || (server.url ? "streamable-http" : "stdio")
  )
    .trim()
    .toLowerCase();

  const normalized = {
    id: String(server.id || server.name || "").trim(),
    name: String(server.name || server.id || "").trim(),
    transport,
    enabled: server.enabled !== false,
    command: server.command || "",
    args: Array.isArray(server.args) ? server.args : [],
    url: server.url || "",
    headers:
      server.headers && typeof server.headers === "object" ? server.headers : {},
    env: server.env && typeof server.env === "object" ? server.env : {},
    timeoutMs: Number(server.timeoutMs || 30000),
    autoDiscover: server.autoDiscover !== false,
    source,
  };

  if (!normalized.id) {
    return null;
  }

  if (transport === "stdio" && !normalized.command) {
    throw new McpError(`MCP stdio server "${normalized.id}" is missing command`, {
      code: "MCP_CONFIG_INVALID",
      status: 400,
    });
  }

  if (transport === "streamable-http" && !normalized.url) {
    throw new McpError(
      `MCP streamable-http server "${normalized.id}" is missing url`,
      {
        code: "MCP_CONFIG_INVALID",
        status: 400,
      }
    );
  }

  if (!["stdio", "streamable-http"].includes(transport)) {
    throw new McpError(
      `Unsupported MCP transport "${transport}" for server "${normalized.id}"`,
      {
        code: "MCP_TRANSPORT_UNSUPPORTED",
        status: 400,
      }
    );
  }

  return normalized;
}

function getEnvServers() {
  const fromJson = parseJsonEnv("MCP_CONFIG_JSON");
  const fromFile = loadFileConfig(process.env.MCP_CONFIG_PATH);
  const legacyUrl = process.env.MCP_SERVER_URL
    ? [
        {
          id: "env-default",
          name: "Environment MCP Server",
          transport: "streamable-http",
          url: process.env.MCP_SERVER_URL,
          enabled: true,
        },
      ]
    : [];

  const configSources = [fromFile, fromJson, legacyUrl].filter(Boolean);
  const flattened = configSources.flatMap((entry) =>
    Array.isArray(entry?.servers) ? entry.servers : Array.isArray(entry) ? entry : []
  );

  return flattened
    .map((server) => normalizeServerConfig(server, "env"))
    .filter(Boolean);
}

function mergeServers(userServers, envServers) {
  const map = new Map();

  for (const server of envServers) {
    map.set(server.id, server);
  }

  for (const server of userServers) {
    map.set(server.id, {
      ...(map.get(server.id) || {}),
      ...server,
      source: server.source || "settings",
    });
  }

  return Array.from(map.values()).filter((server) => server.enabled);
}

function redactObject(obj = {}) {
  return Object.fromEntries(
    Object.keys(obj).map((key) => [key, "[redacted]"])
  );
}

function sanitizeServerConfig(server) {
  if (!server) return null;

  return {
    id: server.id,
    name: server.name,
    transport: server.transport,
    enabled: server.enabled,
    timeoutMs: server.timeoutMs,
    autoDiscover: server.autoDiscover,
    command: server.command,
    args: server.args,
    url: server.url,
    source: server.source,
    headers: redactObject(server.headers),
    env: redactObject(server.env),
  };
}

function getResolvedMcpConfig(settings = {}) {
  const envEnabled = process.env.MCP_ENABLED !== "false";
  const settingsEnabled = settings?.enabled !== false;
  const envServers = getEnvServers();
  const settingsServers = Array.isArray(settings?.servers)
    ? settings.servers
        .map((server) => normalizeServerConfig(server, "settings"))
        .filter(Boolean)
    : [];

  return {
    enabled: envEnabled && settingsEnabled,
    servers: mergeServers(settingsServers, envServers),
  };
}

module.exports = {
  getResolvedMcpConfig,
  sanitizeServerConfig,
  normalizeServerConfig,
};
