/**
 * Resolve the internal backend base URL used by the worker for
 * `/api/internal/broadcast` calls.
 *
 * Precedence:
 *   1. Explicit `BACKEND_INTERNAL_URL` env var (e.g. `http://backend:5000`
 *      in Docker, or a custom host:port in non-Docker deployments).
 *   2. `http://localhost:<PORT>` fallback for local development, where the
 *      worker and the API server run in the same process tree. The default
 *      port is 5000, which matches the backend's documented default and
 *      the value `PORT` takes in the Docker compose service definition.
 *
 * Extracted to a standalone module so the resolution logic is trivially
 * unit-testable without booting the rest of the runner (Mongo, telemetry,
 * queue, etc.).
 */
function resolveBackendHost(env = process.env) {
  if (env.BACKEND_INTERNAL_URL && env.BACKEND_INTERNAL_URL.trim() !== '') {
    return env.BACKEND_INTERNAL_URL.replace(/\/+$/, '');
  }
  const port = env.PORT || 5000;
  return `http://localhost:${port}`;
}

module.exports = { resolveBackendHost };
