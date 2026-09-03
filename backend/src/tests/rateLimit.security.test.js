jest.mock('express-rate-limit', () => {
  return jest.fn((opts) => {
    const middleware = (req, res, next) => {
      const key = `${req.ip || 'unknown'}:${req.method}:${req.baseUrl || req.path}`;
      middleware._hits = middleware._hits || new Map();
      const count = (middleware._hits.get(key) || 0) + 1;
      middleware._hits.set(key, count);
      middleware._totalCalls = (middleware._totalCalls || 0) + 1;
      if (count > opts.max) {
        if (opts.handler) {
          return opts.handler(req, res, next, { statusCode: 429, message: opts.message });
        }
        return res.status(429).json({ error: 'rate_limit_exceeded', message: opts.message });
      }
      next();
    };
    middleware._reset = () => {
      middleware._hits = new Map();
      middleware._totalCalls = 0;
    };
    middleware._options = opts;
    return middleware;
  });
});

const request = require('supertest');
const express = require('express');
const { globalLimiter } = require('../middleware/rateLimit.middleware');

function buildApp() {
  const app = express();
  app.use('/api', globalLimiter);
  app.get('/api/test', (req, res) => res.json({ ok: true }));
  app.get('/api/users', (req, res) => res.json({ ok: true }));
  app.get('/api/admin/secret', (req, res) => res.json({ ok: true }));
  app.get('/health', (req, res) => res.json({ ok: true }));
  return app;
}

describe('Global API Rate Limiter', () => {
  beforeEach(() => {
    globalLimiter._reset();
  });

  it('allows requests below the limit', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/test');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 429 when the limit is exceeded', async () => {
    const app = buildApp();
    const max = globalLimiter._options.max;
    for (let i = 0; i < max; i++) {
      await request(app).get('/api/test');
    }
    const res = await request(app).get('/api/test');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limit_exceeded');
  });

  it('protects a previously-unprotected endpoint once mounted under /api', async () => {
    const app = buildApp();
    const max = globalLimiter._options.max;
    for (let i = 0; i < max; i++) {
      await request(app).get('/api/users');
    }
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(429);
  });

  it('does not rate limit /health (not under /api)', async () => {
    const app = buildApp();
    for (let i = 0; i < globalLimiter._options.max + 5; i++) {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    }
  });

  it('does not rate limit /webhook/* (not under /api)', async () => {
    const app = express();
    app.use('/api', globalLimiter);
    app.post('/webhook/github', (req, res) => res.json({ ok: true }));
    for (let i = 0; i < globalLimiter._options.max + 5; i++) {
      const res = await request(app).post('/webhook/github');
      expect(res.status).toBe(200);
    }
  });

  it('rate limits nested API routes', async () => {
    const app = buildApp();
    const max = globalLimiter._options.max;
    for (let i = 0; i < max; i++) {
      await request(app).get('/api/admin/secret');
    }
    const res = await request(app).get('/api/admin/secret');
    expect(res.status).toBe(429);
  });

  it('is a single middleware (not applied twice for the same request)', async () => {
    const app = buildApp();
    await request(app).get('/api/test');
    expect(globalLimiter._totalCalls).toBe(1);
  });

  it('uses the configured limit value', () => {
    expect(globalLimiter._options.max).toBeGreaterThan(0);
    expect(globalLimiter._options.windowMs).toBeGreaterThan(0);
  });
});
