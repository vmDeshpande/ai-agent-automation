const mockTeamStore = [];
const mockSessionStore = [];
const mockMessageStore = [];

function mockGenerateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

jest.mock('../models/agentTeam.model', () => ({
  create: async (data) => {
    const doc = {
      _id: mockGenerateId(),
      ...data,
      save: async function () {
        const idx = mockTeamStore.findIndex((t) => String(t._id) === String(this._id));
        if (idx !== -1) mockTeamStore[idx] = this;
        return this;
      },
      toObject: function () {
        return JSON.parse(JSON.stringify(this));
      },
    };
    mockTeamStore.push(doc);
    return doc;
  },
  findById: async (id) => {
    const found = mockTeamStore.find((t) => String(t._id) === String(id));
    if (found) {
      return {
        ...found,
        save: async function () {
          const idx = mockTeamStore.findIndex((t) => String(t._id) === String(this._id));
          if (idx !== -1) mockTeamStore[idx] = this;
          return this;
        },
        toObject: function () {
          return JSON.parse(JSON.stringify(this));
        },
      };
    }
    return null;
  },
  findOne: async (query) => {
    return mockTeamStore.find((t) => String(t._id) === String(query._id)) || null;
  },
}));

jest.mock('../models/agentSession.model', () => ({
  findOne: async (query) => {
    return (
      mockSessionStore.find(
        (s) => String(s._id) === String(query._id) && String(s.teamId) === String(query.teamId)
      ) || null
    );
  },
  create: async (data) => {
    const doc = {
      _id: mockGenerateId(),
      ...data,
    };
    mockSessionStore.push(doc);
    return doc;
  },
}));

jest.mock('../models/messageLog.model', () => ({
  create: async (data) => {
    const doc = {
      _id: mockGenerateId(),
      ...data,
    };
    mockMessageStore.push(doc);
    return doc;
  },
}));

const crypto = require('crypto');
const { createTeam } = require('../controllers/agentTeam.controller');
const { receiveAgentMessage } = require('../controllers/a2a.webhook.controller');

describe('AgentTeam A2A Secret Security', () => {
  beforeEach(() => {
    mockTeamStore.length = 0;
    mockSessionStore.length = 0;
    mockMessageStore.length = 0;
  });

  describe('createTeam', () => {
    it('should not return generatedSecret in the response', async () => {
      const req = {
        user: { _id: mockGenerateId() },
        body: { name: 'Test Team' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createTeam(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.ok).toBe(true);
      expect(responseBody.team).toBeDefined();
      expect(responseBody.generatedSecret).toBeUndefined();
    });

    it('should not persist plaintext a2aSecret', async () => {
      const req = {
        user: { _id: mockGenerateId() },
        body: { name: 'Test Team' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createTeam(req, res);

      const createdTeam = mockTeamStore[0];
      expect(createdTeam.metadata.a2aSecret).toBeUndefined();
      expect(createdTeam.metadata.a2aSecretHash).toBeDefined();
      expect(createdTeam.metadata.a2aSecretHash.startsWith('sha256:')).toBe(true);
    });

    it('should not expose a2aSecretHash in the response', async () => {
      const req = {
        user: { _id: mockGenerateId() },
        body: { name: 'Test Team' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createTeam(req, res);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.team.metadata).toBeDefined();
      expect(responseBody.team.metadata.a2aSecretHash).toBeUndefined();
    });
  });

  describe('receiveAgentMessage', () => {
    const createMockTeam = (overrides = {}) => {
      const secret = crypto.randomBytes(32).toString('hex');
      const team = {
        _id: mockGenerateId(),
        name: 'Test Team',
        userId: mockGenerateId(),
        metadata: {
          a2aSecretHash: `sha256:${crypto.createHash('sha256').update(secret).digest('hex')}`,
        },
        externalAgents: [],
        ...overrides,
        save: async function () {
          const idx = mockTeamStore.findIndex((t) => String(t._id) === String(this._id));
          if (idx !== -1) mockTeamStore[idx] = this;
          return this;
        },
      };
      mockTeamStore.push(team);
      return { team, secret };
    };

    const createMockSession = (teamId) => {
      const session = {
        _id: mockGenerateId(),
        teamId,
        status: 'active',
      };
      mockSessionStore.push(session);
      return session;
    };

    it('should accept a valid A2A secret', async () => {
      const { team, secret } = createMockTeam();
      createMockSession(team._id);

      const req = {
        params: { teamId: String(team._id) },
        headers: { 'x-a2a-secret': secret },
        body: {
          sessionId: String(mockSessionStore[0]._id),
          from: { id: 'internal-agent', type: 'internal' },
          to: { id: 'broadcast', type: 'internal' },
          type: 'user_prompt',
          content: { result: 'hello' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await receiveAgentMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.ok).toBe(true);
    });

    it('should reject an invalid A2A secret', async () => {
      const { team } = createMockTeam();
      createMockSession(team._id);

      const req = {
        params: { teamId: String(team._id) },
        headers: { 'x-a2a-secret': 'invalid-secret' },
        body: {
          sessionId: String(mockSessionStore[0]._id),
          from: { id: 'internal-agent', type: 'internal' },
          to: { id: 'broadcast', type: 'internal' },
          type: 'user_prompt',
          content: { result: 'hello' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await receiveAgentMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.error).toBe('invalid_secret');
    });

    it('should reject missing secret', async () => {
      const { team } = createMockTeam();
      createMockSession(team._id);

      const req = {
        params: { teamId: String(team._id) },
        headers: {},
        body: {
          sessionId: String(mockSessionStore[0]._id),
          from: { id: 'internal-agent', type: 'internal' },
          to: { id: 'broadcast', type: 'internal' },
          type: 'user_prompt',
          content: { result: 'hello' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await receiveAgentMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.error).toBe('missing_secret');
    });

    it('should migrate legacy plaintext secret to hash on successful auth', async () => {
      const legacySecret = crypto.randomBytes(32).toString('hex');
      const team = {
        _id: mockGenerateId(),
        name: 'Legacy Team',
        userId: mockGenerateId(),
        metadata: { a2aSecret: legacySecret },
        externalAgents: [],
        save: async function () {
          const idx = mockTeamStore.findIndex((t) => String(t._id) === String(this._id));
          if (idx !== -1) mockTeamStore[idx] = this;
          return this;
        },
      };
      mockTeamStore.push(team);
      createMockSession(team._id);

      const req = {
        params: { teamId: String(team._id) },
        headers: { 'x-a2a-secret': legacySecret },
        body: {
          sessionId: String(mockSessionStore[0]._id),
          from: { id: 'internal-agent', type: 'internal' },
          to: { id: 'broadcast', type: 'internal' },
          type: 'user_prompt',
          content: { result: 'hello' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await receiveAgentMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(team.metadata.a2aSecret).toBeUndefined();
      expect(team.metadata.a2aSecretHash).toBeDefined();
      expect(team.metadata.a2aSecretHash.startsWith('sha256:')).toBe(true);
    });

    it('should reject legacy plaintext secret after migration if wrong secret provided', async () => {
      const legacySecret = crypto.randomBytes(32).toString('hex');
      const team = {
        _id: mockGenerateId(),
        name: 'Legacy Team',
        userId: mockGenerateId(),
        metadata: { a2aSecret: legacySecret },
        externalAgents: [],
        save: async function () {
          const idx = mockTeamStore.findIndex((t) => String(t._id) === String(this._id));
          if (idx !== -1) mockTeamStore[idx] = this;
          return this;
        },
      };
      mockTeamStore.push(team);
      createMockSession(team._id);

      const req = {
        params: { teamId: String(team._id) },
        headers: { 'x-a2a-secret': 'wrong-secret' },
        body: {
          sessionId: String(mockSessionStore[0]._id),
          from: { id: 'internal-agent', type: 'internal' },
          to: { id: 'broadcast', type: 'internal' },
          type: 'user_prompt',
          content: { result: 'hello' },
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await receiveAgentMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(team.metadata.a2aSecret).toBe(legacySecret);
      expect(team.metadata.a2aSecretHash).toBeUndefined();
    });
  });
});
