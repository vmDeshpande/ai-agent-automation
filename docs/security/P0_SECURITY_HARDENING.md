# P0 Security Hardening

**Status:** Completed  
**Date:** 2026-09-01  
**Version:** 0.11.0  
**Scope:** Backend security-critical vulnerabilities requiring immediate remediation before production deployment

---

## Overview

This document records the P0 security hardening milestone for the ai-agent-automation platform. P0 issues are critical vulnerabilities that could lead to server compromise, data exfiltration, or authentication bypass.

All P0 findings from the initial security audit have been addressed, verified with regression tests, and validated against the existing test suite.

---

## Security Goals

- Prevent server-side request forgery (SSRF) attacks
- Enforce origin-based access control on API and WebSocket endpoints
- Eliminate weak/default authentication configurations
- Validate all workflow step configurations at the API boundary
- Prevent arbitrary filesystem enumeration through the file tool
- Enforce internal service authentication

---

## P0-1 — SSRF Protection

### Risk

User-supplied URLs in workflow steps could be used to make the server fetch internal resources, including cloud metadata endpoints, internal APIs, and local services.

### Protected Components

- HTTP handler (`backend/src/agents/handlers/http.handler.js`)
- Browser handler (`backend/src/agents/handlers/browser.handler.js`)
- MCP HTTP transport (`backend/src/mcp/transports/http.js`)

### Centralized Protection

The SSRF validation logic lives in `backend/src/agents/utils/ssrfProtection.js` and exposes:

- `validateUrl(urlString)` — validates a URL against private/reserved IP ranges
- `isPrivateIP(ip)` — checks if an IP address belongs to a private or special-use range
- `resolveHostname(hostname)` — resolves hostnames via DNS before making security decisions

### How URL Validation Works

1. Parse the URL using the `URL` constructor
2. Reject non-HTTP/HTTPS protocols
3. Check hostname against a blocklist of known private/metadata hostnames
4. Resolve the hostname via DNS
5. Validate all resolved IPs against private/reserved ranges
6. Block if any resolved IP is private

### Blocked IPv4 Ranges

- `127.0.0.0/8` — loopback
- `10.0.0.0/8` — private
- `172.16.0.0/12` — private
- `192.168.0.0/16` — private
- `169.254.0.0/16` — link-local / cloud metadata
- `0.0.0.0/8` — current network
- `100.64.0.0/10` — shared address space
- `192.0.0.0/24` — IETF protocol assignments
- `192.0.2.0/24` — TEST-NET-1
- `198.18.0.0/15` — network benchmark tests
- `198.51.100.0/24` — TEST-NET-2
- `203.0.113.0/24` — TEST-NET-3
- `224.0.0.0/4` — multicast
- `240.0.0.0/4` — reserved
- `255.255.255.255/32` — limited broadcast

### Blocked IPv6 Ranges

- `::1` — loopback
- `fc00::/7` — unique local
- `fd00::/7` — unique local
- `fe80::/10` — link-local
- `::ffff:0.0.0.0/96` — IPv4-mapped IPv6 (validates the mapped IPv4 address)

### Cloud Metadata Protection

The following hostnames are explicitly blocked:

- `localhost`
- `127.0.0.1`
- `::1`
- `0.0.0.0`
- `169.254.169.254`
- `metadata.google.internal`
- `metadata.internal`
- `metadata`

### Redirect Handling

The HTTP handler sets `maxRedirects: 0` to prevent automatic redirect following, which could bypass SSRF protections. When a 3xx response is received, the `Location` header is extracted and validated against the same SSRF rules before any follow-up request is made.

### Browser Navigation Protection

The browser handler validates `config.url` through `validateUrl()` before any puppeteer navigation occurs.

### MCP HTTP Transport Protection

MCP server URLs configured for streamable HTTP transport are validated through `validateUrl()` before the transport is created.

### Configuration

No configuration bypass exists. The previous `SSRF_ALLOW_PRIVATE` environment variable has been removed.

### Legitimate Public Requests

Public HTTPS requests to external APIs continue to work normally. Only requests to private/reserved IP ranges and metadata endpoints are blocked.

### Regression Tests

`backend/src/tests/ssrfProtection.test.js` — 13 tests covering:

- Loopback IPv4/IPv6 blocking
- Private IPv4 range blocking
- IPv6 private/local range blocking
- IPv4-mapped IPv6 blocking
- Cloud metadata endpoint blocking
- Public URL allowance
- Protocol filtering

---

## P0-2 — CORS Security

### Previous Behavior

The Express API used `cors()` with no origin restrictions, and Socket.IO accepted connections from any origin (`origin: '*'`).

### Centralized CORS Middleware

`backend/src/middleware/cors.middleware.js` implements origin-based access control using the `ALLOWED_ORIGINS` environment variable.

### ALLOWED_ORIGINS

- Comma-separated list of allowed origins
- In development: defaults to `http://localhost:3000` and `http://127.0.0.1:3000`
- In production: must be explicitly set; if unset, all origins are rejected

### Socket.IO CORS

`backend/src/utils/socket.js` applies the same origin allowlist to WebSocket connections.

### Credentials and Origin Handling

The CORS middleware is configured with `credentials: true` and accepts standard HTTP methods. Origins not in the allowlist are rejected with a clear error message.

### Fail-Closed Behavior

If `ALLOWED_ORIGINS` is not configured in production, no origins are allowed. The server does not fall back to permissive behavior.

### Protected Endpoints

- All Express API routes
- Socket.IO connections

### Regression Tests

Existing test suite passes. CORS behavior is verified through integration tests in `backend/src/tests/workflowApi.test.js`.

---

## P0-3 — JWT Secret Security

### Previous Behavior

`backend/src/middleware/auth.middleware.js` fell back to a hardcoded default secret (`change_this_secret`) when `JWT_SECRET` was not set.

### Fix

The fallback has been removed. `JWT_SECRET` is loaded from the environment, and the server throws an error during startup if it is missing.

### Why Predictable Fallbacks Are Unsafe

A predictable or default JWT secret allows attackers to forge valid authentication tokens, granting unauthorized access to any account or role.

### Startup Behavior

If `JWT_SECRET` is missing, the auth middleware throws an error and the server fails to start. This prevents the application from running in an insecure state.

### Configuration

`JWT_SECRET` must be set in the environment before starting the backend. The value should be a strong, randomly generated string (minimum 32 characters).

### Relevant Source Files

- `backend/src/middleware/auth.middleware.js`
- `backend/src/config/env.js` — validates `JWT_SECRET` presence and minimum length

---

## P0-4 — Workflow/Input Validation

### Why Backend Validation Is Required

Frontend validation alone is insufficient. Malformed or malicious workflow definitions can be submitted directly through the API, bypassing frontend checks.

### Where Validation Occurs

Validation is performed at the controller boundary in `backend/src/controllers/workflow.controller.js` before workflows are persisted or executed.

### Type-Specific Validation

`backend/src/utils/workflowValidation.js` provides `validateWorkflowSteps()`, which validates each step's configuration based on its type.

### Supported Step Types

The following step types are validated:

- `http` — method must be GET/POST/PUT/DELETE; url is required
- `llm` — prompt is required
- `file` — action must be read/write/append/remove/list; path is required
- `email` — to and subject are required
- `browser` — action must be screenshot/evaluate; url is required
- `document_query` — documentId and query are required
- `condition` — conditionType must be contains/boolean
- `switch` — no additional config required
- `delay` — seconds must be a positive number
- `approval` — no additional config required
- `mcp` — serverId and toolName are required
- `agent_call` — agentId is required
- `tool` — tool identifier is required

### Validation Behavior

Malformed configurations are rejected with a 400 response and a descriptive error message. Valid configurations continue to be accepted.

### Backward Compatibility

Steps without a `config` object are still accepted. This preserves compatibility with existing workflows that may use root-level fields.

### Affected Controller Entry Points

- `createWorkflow`
- `updateWorkflowSteps`
- `runWorkflowNow`
- `runWorkflowPartial`
- `cloneWorkflow`

### Regression Tests

`backend/src/tests/workflowValidation.test.js` — 11 tests covering valid configs, missing fields, invalid enums, and edge cases.

---

## P0-5 — File Security

### Directory Enumeration Issue

The file handler's `list` action could enumerate the entire sandbox directory tree, including the root `runtime/workflow-files/` directory, potentially exposing filesystem structure.

### Current Behavior

The `list` action can now only enumerate subdirectories within the sandbox. Listing the root sandbox directory is explicitly blocked.

### Sandbox Boundaries

All file operations continue to be sandboxed to `runtime/workflow-files/` through `fileResolver.js`. Path traversal protection is preserved and unchanged.

### Preservation of Existing Protection

`fileResolver.js` continues to:

- Reject null bytes
- Reject absolute paths
- Reject `..` traversal attempts
- Resolve paths relative to the workflow base directory

### Legitimate File Operations

The following operations remain available within the sandbox:

- `read`
- `write`
- `append`
- `remove`

### Regression Tests

`backend/src/tests/fileSecurity.test.js` — 4 tests covering:

- Subdirectory listing (allowed)
- Root sandbox directory listing (blocked)
- Parent directory traversal (blocked)
- Read/write/append/remove preservation

---

## P0-6 — Internal Authentication

### Purpose

The internal authentication mechanism protects the `/api/internal/broadcast` endpoint, which is used by the worker process to send real-time progress updates to the frontend.

### INTERNAL_AUTH_TOKEN

`INTERNAL_AUTH_TOKEN` is a shared secret between the backend and worker processes.

### Startup Validation

`backend/src/config/env.js` now enforces that `INTERNAL_AUTH_TOKEN` is set and is at least 16 characters long. The server fails to start if the token is missing or too short.

### Runtime Enforcement

`backend/src/app.js` validates the `X-Internal-Token` header on every request to `/api/internal/broadcast`. Requests without a valid token receive a 403 response.

### Protected Endpoint

- `POST /api/internal/broadcast`

### Behavior When Token Is Missing or Invalid

- Missing at startup: server fails to start
- Missing at runtime: 403 response
- Invalid value: 403 response

### Worker Configuration

`backend/src/agents/runner.js` also validates the presence of `INTERNAL_AUTH_TOKEN` before attempting to broadcast progress events.

### Relevant Source Files

- `backend/src/config/env.js`
- `backend/src/app.js`
- `backend/src/agents/runner.js`
- `backend/.env.example`

---

## Required Security Configuration

The following environment variables are required for secure operation:

| Variable | Required | Minimum Length | Purpose |
|---|---|---|---|
| `JWT_SECRET` | Yes | 32 characters | Signs and verifies authentication tokens |
| `INTERNAL_AUTH_TOKEN` | Yes | 16 characters | Authenticates worker-to-backend internal requests |
| `ALLOWED_ORIGINS` | Yes (production) | N/A | Comma-separated list of allowed CORS origins |

### Configuration Examples

```env
JWT_SECRET=<strong-random-secret-min-32-chars>
INTERNAL_AUTH_TOKEN=<strong-random-secret-min-16-chars>
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

### Development Defaults

In development, `ALLOWED_ORIGINS` defaults to `http://localhost:3000,http://127.0.0.1:3000` if not explicitly set.

### Production Requirements

In production, all three variables must be explicitly set. The server will fail to start if `JWT_SECRET` or `INTERNAL_AUTH_TOKEN` is missing. CORS will reject all origins if `ALLOWED_ORIGINS` is not set.

---

## Security Regression Tests

### SSRF Tests (13)

`backend/src/tests/ssrfProtection.test.js`

- Loopback IPv4/IPv6 blocking
- Private IPv4 range blocking
- IPv6 private/local range blocking
- IPv4-mapped IPv6 blocking
- Cloud metadata endpoint blocking
- Public URL allowance
- Protocol filtering

### Workflow Validation Tests (11)

`backend/src/tests/workflowValidation.test.js`

- Valid workflow step acceptance
- Missing stepId rejection
- Missing name rejection
- Invalid HTTP method rejection
- Missing HTTP URL rejection
- Invalid file action rejection
- Missing file path rejection
- Missing email recipient rejection
- Missing email subject rejection
- Missing browser URL rejection
- Missing LLM prompt rejection

### File Security Tests (4)

`backend/src/tests/fileSecurity.test.js`

- Subdirectory listing allowed
- Root sandbox directory listing blocked
- Parent directory traversal blocked
- Read/write/append/remove preserved

### Total P0 Security Regression Tests

**28 tests** across 3 test files.

### Full Backend Regression Result

**52 tests passed** across 15 test suites.

---

## Behavioral Changes

### HTTP Redirect Handling

The HTTP handler no longer automatically follows redirects. This is a security-driven behavioral change because automatic redirect following could bypass SSRF protections.

**Compatibility implication:** Workflows that previously relied on automatic HTTP redirect following may now receive the redirect response (3xx status) instead of the final redirected content.

If redirect following is required for a specific workflow, the workflow logic should be updated to handle 3xx responses explicitly and issue a second validated request to the `Location` header value.

---

## Security Boundaries

### Input Validation Boundary

```
untrusted API input
       ↓
validation (workflowValidation.js)
       ↓
persistence (MongoDB)
       ↓
execution (executor.js / handlers)
```

### SSRF Protection Boundary

```
user-controlled URL
       ↓
SSRF validation (ssrfProtection.js)
       ↓
DNS resolution / destination validation
       ↓
network request (axios / puppeteer / MCP transport)
```

### Authentication Boundary

```
external request
        ↓
authentication / origin validation
        ↓
protected API / internal endpoint
```

## P1 — High Priority Security Hardening

### H-P1-11 — WebSocket Room Authorization

#### Original Vulnerability

The original Socket.IO setup authorized the `join_war_room` event inline in `backend/server.js`. While the implementation did perform a database lookup to verify ownership, it was not isolated in a testable module and called `socket.disconnect()` on any error — including transient database errors — which made the authorization boundary hard to audit and unreliable in practice.

#### Current Secure Architecture

Socket.IO handlers are now registered through a dedicated module:

- `backend/src/utils/socketHandlers.js` exports `setupSocketHandlers(io)` which registers the `connection` event and the `join_war_room` event.
- `backend/server.js` calls `setupSocketHandlers(io)` after `socketUtil.init(server)`.
- `backend/src/utils/socket.js` exposes `__setIO` for test injection while preserving the existing public API (`init`, `getIO`).

The frontend continues to send `{ teamId, token }` or `{ workflowId, token }` to the `join_war_room` event. The server is now the sole authority on whether the socket is allowed to join the room.

#### How Room Authorization Works

1. The socket emits `join_war_room` with `{ workflowId, teamId, token }`.
2. The server verifies the JWT using `process.env.JWT_SECRET` (the same secret used by the REST API).
3. The server extracts the authenticated `userId` from the token.
4. The server performs a database lookup on the appropriate collection:
   - `Workflow.findOne({ _id: workflowId, $or: [{ userId }, { ownerId }] })`, or
   - `AgentTeam.findOne({ _id: teamId, $or: [{ userId }, { ownerId }] })`.
5. If the resource is found **and** the authenticated user owns it (via `userId` or `ownerId`), the socket joins `war_room_<id>`.
6. If the resource does not exist, the user does not own it, the token is invalid, or no resource ID is provided, the server returns a callback response `{ ok: false, error }` and does **not** join the room.
7. The socket is **not** disconnected on authorization failure — it remains connected for other legitimate operations.

#### What Ownership Checks Are Performed

- **Workflow rooms:** Server queries the `workflows` collection with `{ _id, $or: [{ userId }, { ownerId }] }`.
- **Agent-team rooms:** Server queries the `agentteams` collection with the same `$or` pattern.
- **Nonexistent resources:** Same response as unauthorized (`{ ok: false, error: 'forbidden' }`) to avoid leaking the existence of other users' resources.

#### What Happens on Unauthorized Joins

- The callback receives `{ ok: false, error: 'forbidden' }` (or `'unauthorized'` / `'invalid_request'` depending on the failure).
- The socket is **not** added to the room.
- The socket is **not** disconnected.
- No further events are emitted to the unauthorized socket for that room.

#### Internal Worker Broadcasts

The internal worker→backend broadcast path (`/api/internal/broadcast`) is unchanged. It remains protected by `INTERNAL_AUTH_TOKEN` and is the only way the worker emits progress events into a `war_room_<id>` room.

#### Implementation Files

- `backend/src/utils/socketHandlers.js` — Dedicated handler module
- `backend/src/utils/socket.js` — Refactored with `__setIO` for testability
- `backend/server.js` — Calls `setupSocketHandlers(io)`
- `backend/src/tests/socketAuth.security.test.js` — 8 security regression tests

---

### H-P1-5 — Webhook Public Endpoint Payload Size Limit

#### Original Vulnerability

The public webhook receiver at `POST /webhook/:source` had no route-level body size limit. The global `express.json()` parser was configured without a `limit` option, meaning webhook bodies of arbitrary size could be buffered into memory, enabling denial-of-service attacks.

#### How It Works Now

- `backend/src/routes/webhook.public.routes.js` registers route-level `express.json({ limit: '1mb' })` and `express.urlencoded({ limit: '1mb', extended: true })` middleware.
- A body-parse error handler maps `entity.too.large` to `413 payload_too_large` and `entity.parse.failed` to `400 invalid_json`.
- `backend/src/app.js` sets a 2 MB global cap on the body parser and excludes the `/webhook` path from the global parser, so the route-level 1 MB limit is the one that actually applies to webhook requests.

#### Why a 1 MB Limit

- Webhook payloads from typical providers (GitHub, GitLab, Stripe, etc.) are well under 1 MB.
- 1 MB is sufficient for the application's document ingestion use case while preventing memory exhaustion.
- The limit applies to both `application/json` and `application/x-www-form-urlencoded` content types.

#### Implementation Files

- `backend/src/routes/webhook.public.routes.js` — Route-level body parser and error handler
- `backend/src/app.js` — Global body parser cap and webhook path exclusion
- `backend/src/tests/webhookPayloadSize.test.js` — 6 security regression tests

---

### H-P1-6 — Incomplete Rate Limiting

#### Original Vulnerability

The `globalLimiter` middleware existed but was applied per-route in `app.js`. Any new `/api/*` route added without explicitly attaching `globalLimiter` would be unprotected. The audit specifically called out `/api/logs`, `/api/system`, `/api/telemetry`, `/api/insights`, `/api/mcp`, `/api/keys` as potentially unprotected.

#### Current Rate-Limit Architecture

A single API-wide baseline rate limiter is now applied at the `/api` mount point:

```js
app.use('/api', globalLimiter);
```

All `/api/*` routes inherit this baseline (15-minute window, 100 requests by default; configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_GLOBAL_MAX`).

#### Interaction with Route-Specific Limiters

- `authLimiter` — Stricter, applied to `/api/auth/register` and `/api/auth/login` (50 requests / 15 min). Stacks with the global baseline.
- `dashboardLimiter` — 100 requests / 1 min on `/api/dashboard/*` endpoints (defined in the route file). Stacks with the global baseline.
- `expensiveLimiter` — 10 requests / 1 min on document upload, document chat, and workflow run endpoints (defined in route files). Stacks with the global baseline.
- `webhookLimiter` — 20 requests / 1 min on the `/webhook` public receiver. Does NOT apply under `/api`.

The per-route `globalLimiter` applications in `app.js` were removed to prevent double-counting.

#### Protected API Surfaces

Every `/api/*` route is now protected by the baseline, including:

- `/api/auth` (baseline + `authLimiter` on register/login)
- `/api/dashboard` (baseline + `dashboardLimiter` per endpoint)
- `/api/tasks`
- `/api/documents` (baseline + `expensiveLimiter` on upload/chat)
- `/api/workflows`
- `/api/agents`
- `/api/agent-teams`
- `/api/schedules`
- `/api/webhooks`
- `/api/templates`
- `/api/logs`
- `/api/settings`
- `/api/system`
- `/api/memory`
- `/api/assistant`
- `/api/telemetry`
- `/api/insights`
- `/api/mcp`
- `/api/keys`
- `/api/workflows/public`

#### Test Coverage

`backend/src/tests/rateLimit.security.test.js` — 8 tests:

1. Requests below the limit succeed
2. Requests at/over the limit return 429
3. Previously-unprotected endpoints are now protected under `/api`
4. `/health` is not rate limited
5. `/webhook/*` is not rate limited by `globalLimiter`
6. Nested API routes are rate limited
7. Middleware is applied exactly once per request
8. Configured limit values are sensible

#### Compatibility Considerations

- The internal `/api/internal/broadcast` endpoint continues to be protected by `INTERNAL_AUTH_TOKEN`, not by the rate limiter.
- `trust proxy` is set to `1`, so `express-rate-limit` uses the first proxy hop for IP detection. This is correct for the documented reverse-proxy deployment but should be reviewed if the deployment topology changes.
- Adding a new `/api/*` route now automatically inherits the baseline; no per-route changes are needed.

#### Implementation Files

- `backend/src/app.js` — Single `/api` mount of `globalLimiter`; per-route duplicates removed
- `backend/src/tests/rateLimit.security.test.js` — 8 security regression tests

---

### H-P1-12 — A2A Secret Exposure

#### Original Vulnerability

The team creation API (`POST /api/agent-teams`) generated an A2A secret and returned it in the JSON response as `generatedSecret`. The same plaintext secret was stored in `team.metadata.a2aSecret` in MongoDB.

This exposed the secret in:
- HTTP response bodies
- Browser history
- Server/proxy logs
- Monitoring systems

Anyone with access to the secret could send unauthorized A2A messages to the team.

#### How A2A Secrets Worked Before

1. Client creates a team via `POST /api/agent-teams`
2. Server generates a 32-byte random hex secret
3. Server stores plaintext secret in `team.metadata.a2aSecret`
4. Server returns the plaintext secret in the JSON response as `generatedSecret`
5. External systems send A2A messages with the secret in the `x-a2a-secret` header
6. Server compares the header directly against the stored plaintext

#### What Changed

**Team creation (`backend/src/controllers/agentTeam.controller.js`):**
- The secret is still generated using cryptographically secure randomness (`crypto.randomBytes(32).toString('hex')`)
- The plaintext secret is hashed using SHA-256 before storage
- The hash is stored in `team.metadata.a2aSecretHash` with the format `sha256:<64-hex-chars>`
- The plaintext secret is **never** returned in the API response
- The plaintext secret is **never** stored in the database

**A2A authentication (`backend/src/controllers/a2a.webhook.controller.js`):**
- Incoming secrets from the `x-a2a-secret` header are hashed before comparison
- The hash is compared against the stored `sha256:<hash>` using `crypto.timingSafeEqual`
- This prevents timing side-channel attacks
- Legacy plaintext secrets are still accepted for backward compatibility

#### Where Secrets Are Stored Now

- **New teams:** `team.metadata.a2aSecretHash` contains `sha256:<hash>`
- **Legacy teams:** May still contain `team.metadata.a2aSecret` (plaintext) until first successful A2A authentication
- **Never exposed:** The plaintext secret is never returned by any API endpoint

#### How Incoming A2A Authentication Works

1. Extract `x-a2a-secret` header from incoming request
2. Load team from database
3. Retrieve stored value: `team.metadata.a2aSecretHash` (new) or `team.metadata.a2aSecret` (legacy)
4. If stored value is a hash (`sha256:` prefix):
   - Hash the provided secret using SHA-256
   - Compare using `crypto.timingSafeEqual` (constant-time)
5. If stored value is plaintext (legacy):
   - Compare directly
   - On success: migrate to hash, delete plaintext
6. Reject if invalid or missing

#### Why Plaintext Secrets Are No Longer Returned

Returning secrets in API responses creates multiple exposure vectors:
- Logs capture the response body
- Browser history stores the response
- Proxy/gateway logs may record the full JSON
- Debugging tools intercept and display the response

By not returning the secret, the only secure copy remains with the authorized party who received it through a secure channel.

#### Why SHA-256 Hashing Is Used

SHA-256 is a one-way cryptographic hash function:
- The plaintext secret cannot be recovered from the hash
- Even if the database is compromised, attackers cannot derive the plaintext secret
- The hash is deterministic: the same secret always produces the same hash
- This allows verification without storing the plaintext

#### Why Timing-Safe Comparison Is Used

`crypto.timingSafeEqual` performs constant-time comparison:
- Prevents timing side-channel attacks where an attacker measures response times to deduce the correct secret byte-by-byte
- Standard `===` comparison may return early on the first mismatched byte, leaking information

#### Legacy Plaintext Secret Migration

Existing teams created before this fix may still have plaintext `a2aSecret` in MongoDB. The implementation handles this transparently:

1. When an A2A request arrives with a legacy plaintext team:
   - The secret is verified against the stored plaintext
   - On successful verification:
     - The plaintext is hashed
     - The hash is stored in `metadata.a2aSecretHash`
     - The plaintext is deleted from `metadata.a2aSecret`
     - The team document is saved
   - On failed verification:
     - The plaintext is **not** modified
     - The request is rejected
2. Teams that never receive A2A traffic will retain their legacy plaintext value until manually migrated or recreated

**Operational note:** This migration happens automatically during normal A2A traffic. No manual intervention is required. If immediate migration is desired for compliance, recreate the team using the updated API.

#### Implementation Files

- `backend/src/controllers/agentTeam.controller.js` — Team creation, secret hashing
- `backend/src/controllers/a2a.webhook.controller.js` — A2A authentication, legacy migration
- `backend/src/tests/agentTeam.security.test.js` — 8 security regression tests

---

### H-P1-10 — Frontend API URL Hardcoded to localhost in Docker Build

**Finding:** `infra/docker-compose.yml` built the frontend with `NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT:-5000}`. On Docker Desktop this works because the host port is published, but on native Linux Docker hosts (and any reverse-proxy or public-hostname deployment) the browser cannot reach the backend via `localhost:5000`.

#### Why the Original "Use Docker Service Hostname" Fix Was Wrong

`NEXT_PUBLIC_*` variables are bundled into browser JavaScript at build time. Setting `NEXT_PUBLIC_API_URL=http://backend:5000` would have made the browser try to resolve the Docker-internal `backend` hostname, which only works from inside the Docker network. A remote browser would fail to connect — and the hostname itself is information leakage.

#### Architecture-Correct Fix: Same-Origin Routing via Next.js Rewrites

The frontend now uses **same-origin API routing**:

1. `frontend/next.config.js` defines server-side `rewrites()` that proxy `/api/*` and `/socket.io/*` to the backend using a **server-only** `BACKEND_INTERNAL_URL` env var.
2. `frontend/src/lib/api.ts` derives `API_BASE` as the relative path `/api` when `NEXT_PUBLIC_API_URL` is unset.
3. The Socket.IO client in the agent-teams chat connects to `window.location.origin` so WebSocket upgrades also flow through the same-origin proxy.

The browser only ever sees relative paths. The Docker-internal `backend` hostname is confined to the server-side rewrite and never reaches the browser bundle.

#### Why This Is Correct

- **No Docker-internal hostname leakage.** The browser bundle has no reference to `backend:5000` or any other container name.
- **Host-agnostic.** Works on Docker Desktop, native Linux Docker, behind nginx, behind Cloudflare, behind a custom domain — no rebuild required for any of these.
- **Local development preserved.** When `BACKEND_INTERNAL_URL` is unset, the rewrites fall back to `http://localhost:5000`, which is where the backend listens by default.
- **Backend port not exposed publicly.** With the nginx profile, only port 80 needs to be published. The browser talks to the same origin and the Next.js server proxies to the backend container internally.

#### Implementation Files

- `frontend/next.config.js` — `rewrites()` for `/api/*` and `/socket.io/*`
- `frontend/src/lib/api.ts` — relative `API_BASE` default
- `frontend/src/app/agent-teams/[id]/chat/page.tsx` — same-origin Socket.IO connect
- `infra/docker-compose.yml` — `BACKEND_INTERNAL_URL: http://backend:5000` on the frontend service
- `infra/Dockerfile` — `ARG/ENV BACKEND_INTERNAL_URL` with sensible default
- `infra/.env.example` — documents the same-origin approach and the optional `NEXT_PUBLIC_API_URL` build-arg escape hatch
- `backend/src/tests/frontendConfig.handler.test.js` — 8 regression tests for the rewrite contract

---

P0 completion does not mean the platform is fully production-hardened. Remaining work is tracked in `hardening_plan.md` and is organized as follows:

### P1 — High Priority (7 remaining items)

- Broad CORS on API (partially addressed by P0-2; API CORS now restricted)
- Missing CSP/HSTS in Helmet — **backend Express JSON API completed; frontend CSP is a separate future task**
- No schema validation on all API inputs
- Document upload lacks size/MIME enforcement
- Agent memory cross-user risk
- Docker MongoDB runs without authentication
- Worker → Backend localhost coupling in Docker
- Frontend API URL hardcoded to localhost in Docker
- WebSocket room authorization implemented for war rooms (H-P1-11)
- A2A team secret exposure (H-P1-12) — secret hashed, not returned
- Worker → Backend URL in Docker (H-P1-9) — uses `backend:5000` service hostname
- Frontend API URL in Docker (H-P1-10) — same-origin via Next.js rewrites, no browser-facing Docker-internal hostname
- Frontend CSP not configured (Next.js layer)

### P2 — Medium Priority (10 items)

- No graceful worker shutdown
- Stale task recovery missing
- Health check endpoint validation incomplete
- Dashboard queries hit MongoDB directly — **COMPLETED**: Redis caching layer added for `getDashboardStats` and `getExecutionTrend` with user-isolated keys, TTL, and graceful fallback when Redis is unavailable
- Missing database indexes — **COMPLETED**: Added `Task` indexes on `workflowId`, `startedAt`, and compound `{userId, status, createdAt}`; added `Workflow` indexes on `status`, `agentId`, and compound `{userId, status}`
- Missing database indexes
- No request correlation IDs
- Agent call handler JSON parsing fragile
- Email handler has no recipient validation
- Document chat uses hardcoded default provider/model
- Insights endpoints lack pagination limits

### P3 — Low Priority (5 items)

- Duplicate sendOK/sendError helpers
- Frontend TypeScript error in visual-builder.tsx
- Settings page monolith
- Stale scripts and documentation drift
- No frontend test suite

---

*End of P0 Security Hardening Documentation*
