const express = require('express');
const request = require('supertest');

jest.mock('../models/webhook.model', () => ({
  findOne: jest.fn(),
}));

jest.mock('../models/workflow.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/task.model', () => ({
  create: jest.fn(async (data) => ({
    _id: 'task-' + Date.now(),
    ...data,
  })),
}));

const webhookPublicRoutes = require('../routes/webhook.public.routes');

function buildApp() {
  const app = express();
  app.use('/webhook', webhookPublicRoutes);
  return app;
}

describe('Public Webhook Payload Size Limit', () => {
  let Webhook;
  beforeEach(() => {
    Webhook = require('../models/webhook.model');
    Webhook.findOne.mockReset();
  });

  it('accepts a normal JSON payload under 1 MB', async () => {
    Webhook.findOne.mockResolvedValue({
      _id: 'wh-1',
      source: 'github',
      name: 'GitHub Hook',
      secret: 'valid-secret',
      active: true,
      userId: 'user-1',
      workflowId: null,
    });

    const app = buildApp();
    const payload = { event: 'push', data: 'x'.repeat(1000) };

    const res = await request(app)
      .post('/webhook/github?secret=valid-secret')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 413 for a JSON payload over 1 MB', async () => {
    const app = buildApp();
    const large = 'x'.repeat(2 * 1024 * 1024);

    const res = await request(app)
      .post('/webhook/github?secret=valid-secret')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event: 'push', data: large }));

    expect(res.status).toBe(413);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('payload_too_large');
  });

  it('returns 413 for a form-urlencoded payload over 1 MB', async () => {
    const app = buildApp();
    const large = 'x'.repeat(2 * 1024 * 1024);

    const res = await request(app)
      .post('/webhook/github?secret=valid-secret')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(`data=${large}`);

    expect(res.status).toBe(413);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('payload_too_large');
  });

  it('returns 401 when secret is missing (auth still works)', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/webhook/github')
      .set('Content-Type', 'application/json')
      .send({ event: 'push' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_secret');
  });

  it('returns 403 when secret is invalid (auth still works)', async () => {
    Webhook.findOne.mockResolvedValue(null);

    const app = buildApp();

    const res = await request(app)
      .post('/webhook/github?secret=wrong')
      .set('Content-Type', 'application/json')
      .send({ event: 'push' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('invalid_secret_or_inactive');
  });

  it('returns 400 for malformed JSON', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/webhook/github?secret=valid-secret')
      .set('Content-Type', 'application/json')
      .set('Content-Length', String(Buffer.byteLength('{not json')))
      .send('{not json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_json');
  });
});
