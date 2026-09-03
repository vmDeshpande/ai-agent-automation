let io;

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  if (raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

function attachConnectionHandler(serverIo) {
  io = serverIo;
}

function createServer(server) {
  const newIo = require('socket.io')(server, {
    cors: {
      origin: (origin, callback) => {
        const allowed = getAllowedOrigins();
        if (!origin || allowed.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Socket.IO CORS: Origin ${origin} not allowed`), false);
      },
      methods: ['GET', 'POST'],
    },
  });
  attachConnectionHandler(newIo);
  return newIo;
}

module.exports = {
  init: (server) => createServer(server),
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  },
  __setIO: (newIo) => {
    io = newIo;
  },
};
