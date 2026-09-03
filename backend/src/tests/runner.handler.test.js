/* H-P1-9 — Worker → Backend URL resolution in Docker.
 *
 * Verifies that the runner's internal backend URL resolution:
 *   1. Uses BACKEND_INTERNAL_URL when set (Docker service hostname).
 *   2. Strips trailing slashes so the concatenation with the broadcast
 *      path is safe.
 *   3. Falls back to http://localhost:5000 in local development, with the
 *      documented backend port (5000) — not the legacy 5001 default.
 *   4. Honors a custom PORT when BACKEND_INTERNAL_URL is unset.
 *   5. Treats whitespace-only BACKEND_INTERNAL_URL as unset.
 *
 * The env.js schema tests verify that BACKEND_INTERNAL_URL is optional
 * but, when provided, must be a valid http(s) URL.
 *
 * The tests never touch the network or the database. */

const originalEnv = { ...process.env };

/* A minimal but complete env that passes env.js's zod schema. We start
 * from this baseline and only mutate the variables under test. */
const validBaseEnv = {
  ...originalEnv,
  JWT_SECRET: 'x'.repeat(40),
  MONGO_URI: 'mongodb://localhost:27017/ai-agent',
  INTERNAL_AUTH_TOKEN: 'a'.repeat(20),
};

const { resolveBackendHost } = require('../agents/backendHost');

describe('backendHost.resolveBackendHost (H-P1-9)', () => {
  test('uses BACKEND_INTERNAL_URL when set (Docker service hostname)', () => {
    expect(
      resolveBackendHost({
        BACKEND_INTERNAL_URL: 'http://backend:5000',
      })
    ).toBe('http://backend:5000');
  });

  test('strips trailing slashes from BACKEND_INTERNAL_URL', () => {
    expect(
      resolveBackendHost({
        BACKEND_INTERNAL_URL: 'http://backend:5000////',
      })
    ).toBe('http://backend:5000');
  });

  test('treats whitespace-only BACKEND_INTERNAL_URL as unset and falls back', () => {
    expect(
      resolveBackendHost({
        BACKEND_INTERNAL_URL: '   ',
        PORT: '5000',
      })
    ).toBe('http://localhost:5000');
  });

  test('falls back to http://localhost:5000 in local dev (no BACKEND_INTERNAL_URL, no PORT)', () => {
    expect(
      resolveBackendHost({
        BACKEND_INTERNAL_URL: '',
        PORT: '',
      })
    ).toBe('http://localhost:5000');
  });

  test('uses PORT when set and BACKEND_INTERNAL_URL is unset', () => {
    expect(
      resolveBackendHost({
        BACKEND_INTERNAL_URL: '',
        PORT: '5050',
      })
    ).toBe('http://localhost:5050');
  });

  test('explicit override wins over PORT', () => {
    expect(
      resolveBackendHost({
        BACKEND_INTERNAL_URL: 'http://backend:5000',
        PORT: '9999',
      })
    ).toBe('http://backend:5000');
  });

  test('resolved URL composes correctly with the broadcast path', () => {
    const url = `${resolveBackendHost({ BACKEND_INTERNAL_URL: 'http://backend:5000' })}/api/internal/broadcast`;
    expect(url).toBe('http://backend:5000/api/internal/broadcast');
  });

  test('legacy 5001 default is no longer used as a fallback', () => {
    /* H-P1-9 regression: the previous implementation defaulted
     * `PORT` to 5001 inside the runner, which pointed the worker at
     * the wrong port. The fallback must be 5000 (the documented
     * backend port). */
    const result = resolveBackendHost({ BACKEND_INTERNAL_URL: '', PORT: '' });
    expect(result).not.toContain('5001');
    expect(result).toBe('http://localhost:5000');
  });

  test('Docker service name `backend` resolves correctly through the public path', () => {
    /* Mirrors the docker-compose worker environment block. */
    const dockerEnv = {
      BACKEND_INTERNAL_URL: 'http://backend:5000',
      NODE_ENV: 'production',
    };
    const host = resolveBackendHost(dockerEnv);
    expect(host).toBe('http://backend:5000');
    /* The broadcast path concatenation must not introduce a
     * double-slash or strip the port. */
    expect(`${host}/api/internal/broadcast`).toBe('http://backend:5000/api/internal/broadcast');
  });
});

describe('env.js schema (H-P1-9) — BACKEND_INTERNAL_URL is optional but validated', () => {
  function reloadValidate() {
    jest.resetModules();
    return require('../config/env');
  }

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('accepts an unset BACKEND_INTERNAL_URL (it is optional)', () => {
    process.env = { ...validBaseEnv };
    delete process.env.BACKEND_INTERNAL_URL;
    const validate = reloadValidate();
    expect(() => validate()).not.toThrow();
  });

  test('accepts a valid http URL', () => {
    process.env = {
      ...validBaseEnv,
      BACKEND_INTERNAL_URL: 'http://backend:5000',
    };
    const validate = reloadValidate();
    expect(() => validate()).not.toThrow();
  });

  test('accepts a valid https URL', () => {
    process.env = {
      ...validBaseEnv,
      BACKEND_INTERNAL_URL: 'https://api.example.internal:5000',
    };
    const validate = reloadValidate();
    expect(() => validate()).not.toThrow();
  });

  test('rejects a malformed URL', () => {
    process.env = {
      ...validBaseEnv,
      BACKEND_INTERNAL_URL: 'not-a-url',
    };
    const validate = reloadValidate();
    /* env.js calls process.exit(1) on failure. Stub it so the test
     * process doesn't actually exit. */
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process_exit_${code}`);
    });
    try {
      expect(() => validate()).toThrow(/process_exit_1/);
    } finally {
      exitSpy.mockRestore();
    }
  });
});
