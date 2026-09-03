const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Workflow = require('../models/workflow.model');
const AgentTeam = require('../models/agentTeam.model');

const EventEmitter = require('events');
global.socketSync = global.socketSync || new EventEmitter();

function userIdVariants(userId) {
  const variants = [userId];
  if (mongoose.Types.ObjectId.isValid(userId)) {
    variants.push(new mongoose.Types.ObjectId(userId));
  }
  return variants;
}

async function authorizeResource({ userId, workflowId, teamId }) {
  if (workflowId) {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) return false;
    const found = await Workflow.findOne({
      _id: workflowId,
      $or: [
        { userId: { $in: userIdVariants(userId) } },
        { ownerId: { $in: userIdVariants(userId) } },
      ],
    });
    return Boolean(found);
  }
  if (teamId) {
    if (!mongoose.Types.ObjectId.isValid(teamId)) return false;
    const found = await AgentTeam.findOne({
      _id: teamId,
      $or: [
        { userId: { $in: userIdVariants(userId) } },
        { ownerId: { $in: userIdVariants(userId) } },
      ],
    });
    return Boolean(found);
  }
  return false;
}

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join_war_room', async (data = {}, callback) => {
      try {
        const { token, workflowId, teamId } = data;

        if (!token) {
          if (typeof callback === 'function') callback({ ok: false, error: 'unauthorized' });
          return;
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          if (typeof callback === 'function') callback({ ok: false, error: 'unauthorized' });
          return;
        }
        const userId = decoded.id || decoded.userId || decoded.sub;
        if (!userId) {
          if (typeof callback === 'function') callback({ ok: false, error: 'unauthorized' });
          return;
        }

        if (!workflowId && !teamId) {
          if (typeof callback === 'function') callback({ ok: false, error: 'invalid_request' });
          return;
        }

        const authorized = await authorizeResource({ userId, workflowId, teamId });
        if (!authorized) {
          if (typeof callback === 'function') callback({ ok: false, error: 'forbidden' });
          return;
        }

        const resourceId = String(workflowId || teamId);
        const roomName = `war_room_${resourceId}`;
        await socket.join(roomName);

        if (typeof callback === 'function') callback({ ok: true, room: roomName });

        try {
          global.socketSync.emit(`joined_${resourceId}`);
        } catch {
          // best-effort signaling
        }
      } catch {
        if (typeof callback === 'function') callback({ ok: false, error: 'server_error' });
      }
    });
  });
}

module.exports = {
  setupSocketHandlers,
  authorizeResource,
};
