const _workflowStore = [];
const _teamStore = [];

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../models/workflow.model', () => {
  return {
    findOne: jest.fn(async (query) => {
      return (
        _workflowStore.find((w) => {
          if (String(w._id) !== String(query._id)) return false;
          const userVariants = [String(w.userId)];
          if (query.$or) {
            for (const cond of query.$or) {
              if (cond.userId && cond.userId.$in) {
                const allowed = cond.userId.$in.map((v) => String(v));
                if (allowed.includes(userVariants[0])) return true;
              }
              if (cond.ownerId && cond.ownerId.$in) {
                const allowed = cond.ownerId.$in.map((v) => String(v));
                if (allowed.includes(String(w.ownerId))) return true;
              }
            }
          }
          return false;
        }) || null
      );
    }),
  };
});

jest.mock('../models/agentTeam.model', () => {
  return {
    findOne: jest.fn(async (query) => {
      return (
        _teamStore.find((t) => {
          if (String(t._id) !== String(query._id)) return false;
          if (query.$or) {
            for (const cond of query.$or) {
              if (cond.userId && cond.userId.$in) {
                const allowed = cond.userId.$in.map((v) => String(v));
                if (allowed.includes(String(t.userId))) return true;
              }
              if (cond.ownerId && cond.ownerId.$in) {
                const allowed = cond.ownerId.$in.map((v) => String(v));
                if (allowed.includes(String(t.ownerId))) return true;
              }
            }
          }
          return false;
        }) || null
      );
    }),
  };
});

const socketUtil = require('../utils/socket');
const { setupSocketHandlers } = require('../utils/socketHandlers');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

function makeSocket() {
  const socket = {
    id: 'sock-' + Math.random(),
    rooms: new Set(),
    join: jest.fn(async (room) => {
      socket.rooms.add(room);
    }),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    handlers: {},
    on(event, handler) {
      socket.handlers[event] = handler;
    },
  };
  return socket;
}

function makeIO() {
  const handlers = {};
  return {
    on(event, handler) {
      handlers[event] = handler;
    },
    sockets: { adapter: { rooms: new Map() } },
    _emit(event, socket) {
      if (handlers[event]) handlers[event](socket);
    },
  };
}

describe('Socket.IO Room Authorization', () => {
  beforeEach(() => {
    _workflowStore.length = 0;
    _teamStore.length = 0;
    jwt.verify.mockReset();
  });

  it('allows a user to join their own workflow room', async () => {
    const userId = new mongoose.Types.ObjectId();
    const workflowId = new mongoose.Types.ObjectId();
    _workflowStore.push({ _id: workflowId, userId, name: 'My workflow' });

    jwt.verify.mockReturnValue({ id: String(userId) });

    const io = makeIO();
    socketUtil.__setIO(io);
    setupSocketHandlers(io);

    const socket = makeSocket();
    io._emit('connection', socket);

    const callback = jest.fn();
    await socket.handlers.join_war_room(
      { workflowId: String(workflowId), token: 'good-token' },
      callback
    );

    expect(socket.join).toHaveBeenCalledWith(`war_room_${workflowId}`);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("rejects joining another user's workflow room", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const attackerId = new mongoose.Types.ObjectId();
    const workflowId = new mongoose.Types.ObjectId();
    _workflowStore.push({ _id: workflowId, userId: ownerId, name: 'Owner workflow' });

    jwt.verify.mockReturnValue({ id: String(attackerId) });

    const io = makeIO();
    socketUtil.__setIO(io);
    setupSocketHandlers(io);

    const socket = makeSocket();
    io._emit('connection', socket);

    const callback = jest.fn();
    await socket.handlers.join_war_room(
      { workflowId: String(workflowId), token: 'attacker-token' },
      callback
    );

    expect(socket.join).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('rejects joining a nonexistent workflow room', async () => {
    const userId = new mongoose.Types.ObjectId();
    const workflowId = new mongoose.Types.ObjectId();

    jwt.verify.mockReturnValue({ id: String(userId) });

    const io = makeIO();
    socketUtil.__setIO(io);
    setupSocketHandlers(io);

    const socket = makeSocket();
    io._emit('connection', socket);

    const callback = jest.fn();
    await socket.handlers.join_war_room(
      { workflowId: String(workflowId), token: 'good-token' },
      callback
    );

    expect(socket.join).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('allows a user to join their own agent-team room', async () => {
    const userId = new mongoose.Types.ObjectId();
    const teamId = new mongoose.Types.ObjectId();
    _teamStore.push({ _id: teamId, userId, name: 'My team' });

    jwt.verify.mockReturnValue({ id: String(userId) });

    const io = makeIO();
    socketUtil.__setIO(io);
    setupSocketHandlers(io);

    const socket = makeSocket();
    io._emit('connection', socket);

    const callback = jest.fn();
    await socket.handlers.join_war_room({ teamId: String(teamId), token: 'good-token' }, callback);

    expect(socket.join).toHaveBeenCalledWith(`war_room_${teamId}`);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("rejects joining another user's agent-team room", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const attackerId = new mongoose.Types.ObjectId();
    const teamId = new mongoose.Types.ObjectId();
    _teamStore.push({ _id: teamId, userId: ownerId, name: 'Owner team' });

    jwt.verify.mockReturnValue({ id: String(attackerId) });

    const io = makeIO();
    socketUtil.__setIO(io);
    setupSocketHandlers(io);

    const socket = makeSocket();
    io._emit('connection', socket);

    const callback = jest.fn();
    await socket.handlers.join_war_room(
      { teamId: String(teamId), token: 'attacker-token' },
      callback
    );

    expect(socket.join).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('rejects join without a token', async () => {
    const io = makeIO();
    socketUtil.__setIO(io);
    setupSocketHandlers(io);

    const socket = makeSocket();
    io._emit('connection', socket);

    const callback = jest.fn();
    await socket.handlers.join_war_room(
      { teamId: new mongoose.Types.ObjectId().toString() },
      callback
    );

    expect(socket.join).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('rejects join with an invalid token', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    const io = makeIO();
    socketUtil.__setIO(io);
    setupSocketHandlers(io);

    const socket = makeSocket();
    io._emit('connection', socket);

    const callback = jest.fn();
    await socket.handlers.join_war_room(
      { teamId: new mongoose.Types.ObjectId().toString(), token: 'bad' },
      callback
    );

    expect(socket.join).not.toHaveBeenCalled();
  });

  it('rejects join when neither workflowId nor teamId is provided', async () => {
    const userId = new mongoose.Types.ObjectId();
    jwt.verify.mockReturnValue({ id: String(userId) });

    const io = makeIO();
    socketUtil.__setIO(io);
    setupSocketHandlers(io);

    const socket = makeSocket();
    io._emit('connection', socket);

    const callback = jest.fn();
    await socket.handlers.join_war_room({ token: 'good-token' }, callback);

    expect(socket.join).not.toHaveBeenCalled();
  });
});
