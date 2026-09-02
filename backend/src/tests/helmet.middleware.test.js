const request = require('supertest');
const express = require('express');
const helmetMiddleware = require('../middleware/helmet.middleware');

describe('Helmet Security Headers', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(helmetMiddleware);
    app.get('/health', (req, res) => res.json({ ok: true }));
  });

  it('should set X-Content-Type-Options', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should set X-Frame-Options', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('should set Referrer-Policy', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should set Content-Security-Policy with restrictive defaults', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['content-security-policy']).toContain("base-uri 'none'");
    expect(response.headers['content-security-policy']).toContain("form-action 'none'");
    expect(response.headers['content-security-policy']).toContain("object-src 'none'");
  });

  it('should not set HSTS by default', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('should set Cross-Origin-Opener-Policy', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
  });

  it('should set Permissions-Policy', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['permissions-policy']).toBeDefined();
    expect(response.headers['permissions-policy']).toContain('geolocation=()');
    expect(response.headers['permissions-policy']).toContain('microphone=()');
    expect(response.headers['permissions-policy']).toContain('camera=()');
  });
});
