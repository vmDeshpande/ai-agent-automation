const crypto = require('crypto');
const AgentTeam = require('../models/agentTeam.model');
const AgentSession = require('../models/agentSession.model');
const MessageLog = require('../models/messageLog.model');
const eventBroker = require('../agents/eventBroker');

function hashA2ASecret(secret) {
  return `sha256:${crypto.createHash('sha256').update(secret).digest('hex')}`;
}

function verifyA2ASecret(providedSecret, storedValue) {
  if (!storedValue || !providedSecret) return false;

  if (storedValue === providedSecret) {
    return true;
  }

  if (storedValue.startsWith('sha256:')) {
    const providedHash = hashA2ASecret(providedSecret);
    const storedBuffer = Buffer.from(storedValue.slice(7), 'hex');
    const providedBuffer = Buffer.from(providedHash.slice(7), 'hex');
    return (
      storedBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(storedBuffer, providedBuffer)
    );
  }

  return false;
}

async function receiveAgentMessage(req, res) {
  try {
    const { teamId } = req.params;
    const { sessionId, from, to, type, content } = req.body;
    const secret = req.headers['x-a2a-secret'];

    if (!secret) return res.status(401).json({ ok: false, error: 'missing_secret' });
    if (!sessionId || !from || !from.id || !to || !to.id || !type || !content) {
      return res.status(400).json({ ok: false, error: 'invalid_payload_schema' });
    }

    const team = await AgentTeam.findById(teamId);
    if (!team) return res.status(404).json({ ok: false, error: 'team_not_found' });

    const storedValue = team.metadata?.a2aSecretHash || team.metadata?.a2aSecret;
    const isValid = verifyA2ASecret(secret, storedValue);

    if (!isValid) {
      return res.status(403).json({ ok: false, error: 'invalid_secret' });
    }

    if (team.metadata?.a2aSecret && !team.metadata?.a2aSecretHash) {
      team.metadata.a2aSecretHash = hashA2ASecret(team.metadata.a2aSecret);
      delete team.metadata.a2aSecret;
      await team.save();
    }

    const session = await AgentSession.findOne({ _id: sessionId, teamId, status: 'active' });
    if (!session) return res.status(400).json({ ok: false, error: 'invalid_or_inactive_session' });

    if (from.type === 'external') {
      const isAuthorized = team.externalAgents.some((agent) => agent.name === from.id);
      if (!isAuthorized) {
        return res.status(403).json({ ok: false, error: 'unauthorized_agent_identity' });
      }
    }

    const message = await MessageLog.create({
      sessionId,
      teamId,
      from: { id: from.id, type: from.type },
      to: { id: to.id, type: to.type },
      type,
      content,
      status: 'delivered',
    });

    eventBroker.emit('NEW_SWARM_MESSAGE', message._id);

    return res.status(200).json({
      ok: true,
      status: 'delivered',
      messageId: message._id,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

module.exports = { receiveAgentMessage };
