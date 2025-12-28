const Agent = require("../models/agent.model");

/** Helpers */
function sendError(res, code, msg) {
  return res.status(code).json({ ok: false, error: msg });
}
function sendOK(res, payload) {
  return res.json({ ok: true, ...payload });
}

/** Create agent - POST /api/agents */
async function createAgent(req, res) {
  try {
    const userId = req.user._id;
    const { name, description, type, config, capabilities, isActive, quota } = req.body;

    if (!name) return sendError(res, 400, "name_required");

    const agent = await Agent.create({
      name,
      description: description || "",
      userId,
      type: type || "custom",
      config: config || {},
      capabilities: capabilities || ["llm"],
      isActive: isActive === undefined ? true : !!isActive,
      quota: quota || {}
    });

    return sendOK(res, { agent });
  } catch (err) {
    console.error("createAgent error", err);
    return sendError(res, 500, "server_error");
  }
}

/** List agents for user - GET /api/agents */
async function listAgents(req, res) {
  try {
    const userId = req.user._id;
    const agents = await Agent.find({ userId }).sort({ createdAt: -1 });
    return sendOK(res, { agents });
  } catch (err) {
    console.error("listAgents error", err);
    return sendError(res, 500, "server_error");
  }
}

/** Get single agent - GET /api/agents/:id */
async function getAgent(req, res) {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return sendError(res, 404, "not_found");
    if (agent.userId.toString() !== req.user._id.toString()) return sendError(res, 403, "forbidden");
    return sendOK(res, { agent });
  } catch (err) {
    console.error("getAgent error", err);
    return sendError(res, 500, "server_error");
  }
}

/** Update agent - PUT /api/agents/:id */
async function updateAgent(req, res) {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return sendError(res, 404, "not_found");
    if (agent.userId.toString() !== req.user._id.toString()) return sendError(res, 403, "forbidden");

    const allowed = ["name", "description", "type", "config", "capabilities", "isActive", "quota"];
    allowed.forEach(k => {
      if (req.body[k] !== undefined) agent[k] = req.body[k];
    });

    await agent.save();
    return sendOK(res, { agent });
  } catch (err) {
    console.error("updateAgent error", err);
    return sendError(res, 500, "server_error");
  }
}

/** Delete agent - DELETE /api/agents/:id */
async function deleteAgent(req, res) {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return sendError(res, 404, "not_found");
    if (agent.userId.toString() !== req.user._id.toString()) return sendError(res, 403, "forbidden");

    await agent.deleteOne();
    return sendOK(res, { message: "agent_deleted" });
  } catch (err) {
    console.error("deleteAgent error", err);
    return sendError(res, 500, "server_error");
  }
}

module.exports = {
  createAgent,
  listAgents,
  getAgent,
  updateAgent,
  deleteAgent
};
