const {
  listServers: listMcpServers,
  listTools: listMcpTools,
} = require("../mcp/toolRegistry");
const { invokeTool } = require("../mcp/executionAdapter");
const { getSafeErrorPayload, toMcpError } = require("../mcp/errors");

async function getServers(req, res) {
  try {
    const data = await listMcpServers(req.user._id);
    return res.json({ ok: true, ...data });
  } catch (error) {
    const err = toMcpError(error);
    return res.status(err.status).json({
      ok: false,
      error: err.code,
      message: err.message,
      details: err.details,
    });
  }
}

async function getTools(req, res) {
  try {
    const tools = await listMcpTools(req.user._id);
    return res.json({ ok: true, tools });
  } catch (error) {
    const err = toMcpError(error);
    return res.status(err.status).json({
      ok: false,
      error: err.code,
      message: err.message,
      details: err.details,
    });
  }
}

async function getHealth(req, res) {
  try {
    const data = await listMcpServers(req.user._id);
    return res.json({
      ok: true,
      enabled: data.enabled,
      servers: data.servers.map((server) => ({
        id: server.id,
        name: server.name,
        transport: server.transport,
        health: server.health,
      })),
    });
  } catch (error) {
    const err = toMcpError(error);
    return res.status(err.status).json({
      ok: false,
      error: err.code,
      message: err.message,
      details: err.details,
    });
  }
}

async function invoke(req, res) {
  try {
    const { serverId, toolName } = req.params;
    const result = await invokeTool({
      userId: req.user._id,
      serverId,
      toolName,
      argumentsInput: req.body?.arguments ?? {},
      context: req.body?.context || {},
      interpolate: (value) => value,
      timeoutMs: req.body?.timeoutMs,
    });

    return res.json({
      ok: true,
      tool: result.tool,
      input: result.args,
      output: result.result,
    });
  } catch (error) {
    const err = toMcpError(error);
    return res.status(err.status).json({
      ok: false,
      error: err.code,
      ...getSafeErrorPayload(err),
    });
  }
}

module.exports = {
  getServers,
  getTools,
  getHealth,
  invoke,
};
