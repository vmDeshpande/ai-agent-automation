/* H-P1-10 — Frontend API URL: same-origin routing via Next.js rewrites.
 *
 * The hardening plan originally suggested setting
 * `NEXT_PUBLIC_API_URL=http://backend:5000`. That is wrong because
 * `NEXT_PUBLIC_*` is bundled into browser JavaScript, and a user's
 * browser generally cannot resolve the Docker-internal `backend`
 * hostname.
 *
 * The architecture-correct fix:
 *   1. `frontend/next.config.js` defines server-side rewrites that
 *      proxy `/api/*` and `/socket.io/*` to a server-only
 *      `BACKEND_INTERNAL_URL`. The browser only ever sees the
 *      same-origin `/api/*` path.
 *   2. `frontend/src/lib/api.ts` derives `API_BASE` as a relative
 *      `/api` when `NEXT_PUBLIC_API_URL` is unset, so the browser
 *      hits the Next.js rewrite.
 *   3. The Socket.IO client in the agent-teams chat connects to
 *      `window.location.origin` so the same-origin proxy handles
 *      the WebSocket upgrade as well.
 *
 * The test below reads the config source file as text and evaluates
 * the `rewrites()` function in a controlled `process.env`. This
 * avoids module-cache and global-mutation issues that arise when
 * loading the config via `require()` in jest (which has its own
 * module sandboxing on Windows). The behavior we verify is the same
 * behavior Next.js will apply at runtime, because Next.js also
 * reads the file and calls `rewrites()` with the same env. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NEXT_CONFIG_PATH = path.resolve(__dirname, '..', '..', '..', 'frontend', 'next.config.js');

function loadRewrites(env) {
  const source = fs.readFileSync(NEXT_CONFIG_PATH, 'utf8');
  const sandbox = {
    process: { env: { ...env } },
    module: { exports: {} },
    require,
    __dirname: path.dirname(NEXT_CONFIG_PATH),
    __filename: NEXT_CONFIG_PATH,
    exports: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: NEXT_CONFIG_PATH });
  const config = sandbox.module.exports;
  if (typeof config.rewrites !== 'function') {
    throw new Error('next.config.js does not export a rewrites function');
  }
  return config.rewrites();
}

describe('frontend/next.config.js rewrites (H-P1-10)', () => {
  test('proxies /api/* to BACKEND_INTERNAL_URL (Docker service hostname)', async () => {
    const rewrites = await loadRewrites({
      BACKEND_INTERNAL_URL: 'http://backend:5000',
    });
    const api = rewrites.find((r) => r.source === '/api/:path*');
    expect(api).toBeDefined();
    expect(api.destination).toBe('http://backend:5000/api/:path*');
  });

  test('proxies /socket.io/* to BACKEND_INTERNAL_URL for WebSocket upgrades', async () => {
    const rewrites = await loadRewrites({
      BACKEND_INTERNAL_URL: 'http://backend:5000',
    });
    const sock = rewrites.find((r) => r.source === '/socket.io/:path*');
    expect(sock).toBeDefined();
    expect(sock.destination).toBe('http://backend:5000/socket.io/:path*');
  });

  test('falls back to http://localhost:5000 in local dev when BACKEND_INTERNAL_URL is unset', async () => {
    const rewrites = await loadRewrites({});
    const api = rewrites.find((r) => r.source === '/api/:path*');
    expect(api.destination).toBe('http://localhost:5000/api/:path*');
  });

  test('honors a custom BACKEND_INTERNAL_URL override (e.g. staging)', async () => {
    const rewrites = await loadRewrites({
      BACKEND_INTERNAL_URL: 'http://10.0.0.5:5000',
    });
    const api = rewrites.find((r) => r.source === '/api/:path*');
    const sock = rewrites.find((r) => r.source === '/socket.io/:path*');
    expect(api.destination).toBe('http://10.0.0.5:5000/api/:path*');
    expect(sock.destination).toBe('http://10.0.0.5:5000/socket.io/:path*');
  });
});

describe('frontend/src/lib/api.ts API_BASE contract (H-P1-10)', () => {
  /* We re-derive the API_BASE constant using the same logic as
   * `frontend/src/lib/api.ts` so the test stays a backend test
   * (no TS runtime required) while still exercising the exact
   * branch logic. If the file's logic changes, this test must
   * change in lockstep. */
  function computeApiBase(env) {
    return env.NEXT_PUBLIC_API_URL ? `${env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}/api` : '/api';
  }

  test('defaults to same-origin /api when NEXT_PUBLIC_API_URL is unset', () => {
    expect(computeApiBase({})).toBe('/api');
    expect(computeApiBase({ NEXT_PUBLIC_API_URL: '' })).toBe('/api');
  });

  test('uses absolute URL only when NEXT_PUBLIC_API_URL is explicitly set', () => {
    expect(computeApiBase({ NEXT_PUBLIC_API_URL: 'https://api.example.com' })).toBe(
      'https://api.example.com/api'
    );
  });

  test('strips trailing slashes from NEXT_PUBLIC_API_URL to avoid double-slash paths', () => {
    expect(computeApiBase({ NEXT_PUBLIC_API_URL: 'https://api.example.com/' })).toBe(
      'https://api.example.com/api'
    );
  });

  test('browser-facing URL is never a Docker-internal hostname by default', () => {
    /* This is the central security/correctness claim: even if the
     * operator forgets to set NEXT_PUBLIC_API_URL, the bundled
     * client never references `backend:5000`. The Docker-internal
     * hostname is confined to the server-side rewrite. */
    const defaultBase = computeApiBase({});
    expect(defaultBase).not.toContain('backend:5000');
    expect(defaultBase).not.toContain('localhost:5000');
  });
});
