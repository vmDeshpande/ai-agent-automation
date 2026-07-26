const crypto = require('crypto');
const AgentTeam = require('../models/agentTeam.model');
const AgentSession = require('../models/agentSession.model');
const MessageLog = require('../models/messageLog.model');
const Agent = require('../models/agent.model');
const broker = require('../agents/eventBroker');
const socketUtil = require('../utils/socket');

async function createTeam(req, res) {
  try {
    const { name, description, agents, externalAgents, topology, nodes, edges } = req.body;

    if (!name) return res.status(400).json({ ok: false, error: 'name_required' });

    const a2aSecret = crypto.randomBytes(32).toString('hex');

    const team = await AgentTeam.create({
      name,
      description: description || '',
      userId: req.user._id,
      agents: agents || [],
      externalAgents: externalAgents || [],
      topology: topology || 'mesh',
      nodes: nodes || [],
      edges: edges || [],
      metadata: { a2aSecret },
    });

    const teamResponse = team.toObject();
    if (teamResponse.metadata) {
      delete teamResponse.metadata.a2aSecret;
    }

    return res.status(201).json({ ok: true, team: teamResponse, generatedSecret: a2aSecret });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

async function getTeams(req, res) {
  try {
    const teams = await AgentTeam.find({ userId: req.user._id }).populate(
      'agents',
      'name capabilities type'
    );
    return res.json({ ok: true, teams });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

async function createSession(req, res) {
  try {
    const { teamId } = req.params;
    const { objective } = req.body;

    if (!objective) return res.status(400).json({ ok: false, error: 'objective_required' });

    const team = await AgentTeam.findOne({ _id: teamId, userId: req.user._id });
    if (!team) return res.status(404).json({ ok: false, error: 'team_not_found' });

    const session = await AgentSession.create({
      teamId,
      userId: req.user._id,
      objective,
      status: 'active',
      sharedState: {},
    });

    return res.status(201).json({ ok: true, session });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

async function getSessionLogs(req, res) {
  try {
    const { sessionId } = req.params;

    const session = await AgentSession.findOne({ _id: sessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ ok: false, error: 'session_not_found' });

    const logs = await MessageLog.find({ sessionId }).sort({ createdAt: 1 });

    return res.json({ ok: true, logs });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

async function getDiscovery(req, res) {
  try {
    const { teamId } = req.params;

    const team = await AgentTeam.findOne({ _id: teamId, userId: req.user._id }).populate(
      'agents',
      'name capabilities role'
    );
    if (!team) return res.status(404).json({ ok: false, error: 'team_not_found' });

    const internalCapabilities = team.agents.map((a) => ({
      id: a._id,
      name: a.name,
      type: 'internal',
      role: a.role,
      capabilities: a.capabilities,
    }));

    const externalCapabilities = team.externalAgents.map((a) => ({
      id: a.name,
      name: a.name,
      type: 'external',
      capabilities: a.capabilities,
    }));

    return res.json({
      ok: true,
      discovery: [...internalCapabilities, ...externalCapabilities],
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

async function runTeam(req, res) {
  try {
    const { input } = req.body;
    const teamId = req.params.id;

    const team = await AgentTeam.findOne({ _id: teamId, userId: req.user._id });
    if (!team) return res.status(404).json({ ok: false, error: 'team_not_found' });

    const session = await AgentSession.create({
      teamId: team._id,
      userId: req.user._id,
      objective: input,
      status: 'active',
      sharedState: {}
    });

    res.json({ ok: true, sessionId: session._id, workflowId: teamId });

    const triggerSwarm = async () => {
      try {
        const msg = await MessageLog.create({
          sessionId: session._id,
          teamId: team._id,
          from: { id: 'user', type: 'external' },
          to: { id: 'broadcast', type: 'internal' },
          type: 'user_prompt',
          content: { result: input },
          status: 'delivered'
        });

        broker.emit('NEW_SWARM_MESSAGE', msg._id);
      } catch (err) {
        console.error(err);
      }
    };

    const io = socketUtil.getIO();
    const room = io.sockets.adapter.rooms.get(`war_room_${teamId}`);

    if (room && room.size > 0) {
      triggerSwarm();
    } else {
      const syncEvent = `joined_${teamId}`;
      global.socketSync.once(syncEvent, triggerSwarm);
      
      setTimeout(() => {
        global.socketSync.removeListener(syncEvent, triggerSwarm);
      }, 10000);
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

module.exports = {
  createTeam,
  getTeams,
  createSession,
  getSessionLogs,
  getDiscovery,
  runTeam
};
