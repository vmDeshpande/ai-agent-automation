// Handler-style test for the task logs export controller (issue #198).
// Only files matching `*.handler.test.js` are run by `npm test` per
// backend/package.json `testMatch`, so this file follows that naming
// convention despite testing a controller rather than a step handler.
//
// Mocks the Task and Log models with the minimal surface the controller
// exercises, so this test runs without a real MongoDB instance.
jest.mock('../models/task.model', () => {
  const stub = {
    findById: jest.fn(),
  };
  return stub;
});
jest.mock('../models/workflow.model', () => ({}));
jest.mock('../models/log.model', () => ({
  find: jest.fn(),
}));
jest.mock('../utils/workflowMetadata', () => ({ getWorkflowGraph: jest.fn(() => ({ steps: [], edges: [] })) }));

const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');

const Task = require('../models/task.model');
const Log = require('../models/log.model');
const { getTaskLogs } = require('../controllers/task.controller');
// Match the production route registration (task.routes.js) so the CodeQL
// `MissingRateLimit` alert doesn't fire on the test stub's `app.get(...)`.
// In production the same `expensiveLimiter` middleware is wired in.
const { expensiveLimiter } = require('../middleware/rateLimit.middleware');

const USER_ID = new mongoose.Types.ObjectId('111111111111111111111111');

function buildApp() {
  const app = express();
  app.use(express.json());
  // Stub auth middleware — attach the user to req
  app.use((req, _res, next) => {
    req.user = { _id: USER_ID };
    next();
  });
  app.get('/api/tasks/:id/logs', expensiveLimiter, getTaskLogs);
  return app;
}

const TASK_FIXTURE = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Test Task',
  status: 'completed',
  userId: USER_ID,
  // Task.findById returns a mongoose document-like object; provide chainable helpers
  // the controller uses.
};

describe('GET /api/tasks/:id/logs (export)', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it('returns logs as text/plain attachment by default', async () => {
    Task.findById.mockResolvedValue(TASK_FIXTURE);
    const sortChain = { lean: jest.fn().mockResolvedValue([
      { createdAt: new Date('2026-08-04T10:00:00Z'), level: 'info', message: 'Step one started' },
      { createdAt: new Date('2026-08-04T10:00:30Z'), level: 'success', message: 'Step one ok' },
    ]) };
    Log.find.mockReturnValue({ sort: () => sortChain });

    const res = await request(app).get(`/api/tasks/${TASK_FIXTURE._id}/logs`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.headers['content-disposition']).toContain(`task-${TASK_FIXTURE._id}-logs.txt`);
    expect(res.text).toContain('Task: Test Task');
    expect(res.text).toContain('[info] Step one started');
    expect(res.text).toContain('[success] Step one ok');
  });

  it('returns logs as JSON when ?format=json', async () => {
    Task.findById.mockResolvedValue(TASK_FIXTURE);
    const sortChain = { lean: jest.fn().mockResolvedValue([
      { createdAt: new Date('2026-08-04T10:00:00Z'), level: 'info', message: 'm1' },
    ]) };
    Log.find.mockReturnValue({ sort: () => sortChain });

    const res = await request(app).get(`/api/tasks/${TASK_FIXTURE._id}/logs?format=json`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-disposition']).toContain(`task-${TASK_FIXTURE._id}-logs.json`);
    const body = JSON.parse(res.text);
    expect(body.taskId).toBe(TASK_FIXTURE._id.toString());
    expect(body.logCount).toBe(1);
    expect(body.logs[0].message).toBe('m1');
  });

  it('returns 404 when task is missing', async () => {
    Task.findById.mockResolvedValue(null);

    const res = await request(app).get(`/api/tasks/${new mongoose.Types.ObjectId()}/logs`);
    expect(res.status).toBe(404);
    const body = JSON.parse(res.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('not_found');
  });

  it('returns 403 when task belongs to another user', async () => {
    Task.findById.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      name: 'Other Task',
      status: 'completed',
      userId: new mongoose.Types.ObjectId(),
    });

    const res = await request(app).get(`/api/tasks/${new mongoose.Types.ObjectId()}/logs`);
    expect(res.status).toBe(403);
    const body = JSON.parse(res.text);
    expect(body.error).toBe('forbidden');
  });

  it('writes "(no log entries)" when no logs exist', async () => {
    Task.findById.mockResolvedValue(TASK_FIXTURE);
    const sortChain = { lean: jest.fn().mockResolvedValue([]) };
    Log.find.mockReturnValue({ sort: () => sortChain });

    const res = await request(app).get(`/api/tasks/${TASK_FIXTURE._id}/logs`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('(no log entries)');
  });
});
