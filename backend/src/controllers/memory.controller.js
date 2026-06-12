const mongoose = require("mongoose");
const Agent = require("../models/agent.model");
const AgentMemory = require("../models/agentMemory.model");

function sendError(res, code, error) {
  return res.status(code).json({ ok: false, error });
}

function getAuthenticatedUserId(req) {
  return req.user?._id || req.user?.id;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function findOwnedAgent(agentId, userId) {
  if (!agentId || !isValidObjectId(agentId)) return null;

  return Agent.findOne({
    _id: agentId,
    userId
  }).select("_id name");
}

/* -----------------------------
   List Memories
----------------------------- */

async function listMemories(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return sendError(res, 401, "unauthorized");

    const { agentId, search } = req.query;
    const filter = {};

    if (agentId) {
      const agent = await findOwnedAgent(agentId, userId);
      if (!agent) return sendError(res, 403, "forbidden");

      filter.agentId = agent._id;
    } else {
      const ownedAgents = await Agent.find({ userId }).select("_id").lean();
      const ownedAgentIds = ownedAgents.map((agent) => agent._id);

      if (ownedAgentIds.length === 0) {
        return res.json({ ok: true, memories: [] });
      }

      filter.agentId = { $in: ownedAgentIds };
    }

    if (search) {
      filter.content = {
        $regex: search,
        $options: "i"
      };
    }

    const memories = await AgentMemory
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("agentId", "name")
      .lean();

    return res.json({
      ok: true,
      memories
    });

  } catch (err) {

    console.error("listMemories error", err);

    return res.status(500).json({
      ok: false,
      error: "memory_fetch_failed"
    });

  }
}


/* -----------------------------
   Get Agent List
----------------------------- */

async function listAgents(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return sendError(res, 401, "unauthorized");

    const ownedAgents = await Agent.find({ userId }).select("_id").lean();
    const ownedAgentIds = ownedAgents.map((agent) => agent._id);

    if (ownedAgentIds.length === 0) {
      return res.json({ ok: true, agents: [] });
    }

    const agents = await AgentMemory.aggregate([
      {
        $match: {
          agentId: { $in: ownedAgentIds }
        }
      },
      {
        $group: {
          _id: "$agentId",
          count: { $sum: 1 }
        }
      }
    ]);

    return res.json({
      ok: true,
      agents
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      ok: false
    });

  }
}


/* -----------------------------
   Delete Memory
----------------------------- */

async function deleteMemory(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return sendError(res, 401, "unauthorized");

    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "invalid_memory_id");

    const memory = await AgentMemory.findById(id).select("_id agentId").lean();
    if (!memory) return sendError(res, 404, "memory_not_found");

    const agent = await findOwnedAgent(memory.agentId, userId);
    if (!agent) return sendError(res, 403, "forbidden");

    await AgentMemory.deleteOne({
      _id: memory._id
    });

    return res.json({
      ok: true
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      ok: false
    });

  }
}


/* -----------------------------
   Clear Agent Memory
----------------------------- */

async function clearAgentMemory(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return sendError(res, 401, "unauthorized");

    const { agentId } = req.params;
    const agent = await findOwnedAgent(agentId, userId);
    if (!agent) return sendError(res, 403, "forbidden");

    await AgentMemory.deleteMany({
      agentId: agent._id
    });

    return res.json({
      ok: true
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      ok: false
    });

  }
}

module.exports = {
  listMemories,
  listAgents,
  deleteMemory,
  clearAgentMemory
};
