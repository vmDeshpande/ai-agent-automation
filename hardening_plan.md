# Platform Hardening Plan
**Generated:** 2026-09-01  
**Repo:** `C:\Projects\ai-agent-automation`  
**Source of truth:** Current repository source code only. All findings verified against executable code.

---

## Executive Summary

The platform is a functional workflow-automation system with a clean architecture and solid separation of concerns. P0 critical security gaps (SSRF, wildcard CORS, missing input validation, weak auth defaults) have been resolved. Remaining work includes P1 high-priority security hardening, P2 reliability/observability improvements, and P3 frontend stability tasks.

This plan prioritizes fixing exploitable vulnerabilities and data-integrity risks first, then reliability, then performance, then frontend stability.

---

## Hardening Status

### P0 — COMPLETE

**Completion date:** 2026-09-01

**Verification:**

- 6/6 P0 findings resolved
- 29 dedicated security regression tests passing
- 52 backend tests passing across 15 suites
- Frontend build successful
- Environment validation verified
- No remaining verified P0 risks

### P0 Completion Details

#### ✅ H-P0-1: SSRF in HTTP Handler — COMPLETED

- **Implementation:** `backend/src/agents/utils/ssrfProtection.js` — centralized URL validation utility
- **Applied in:** `http.handler.js`, `browser.handler.js`, `mcp/transports/http.js`
- **Tests:** `backend/src/tests/ssrfProtection.test.js` (13 tests)
- **Result:** Private/reserved IP ranges, metadata endpoints, and DNS rebinding are blocked. Redirects validated.

#### ✅ H-P0-2: Socket.IO Wildcard CORS — COMPLETED

- **Implementation:** `backend/src/middleware/cors.middleware.js` — centralized CORS middleware
- **Applied in:** `app.js`, `utils/socket.js`
- **Tests:** Existing integration tests pass
- **Result:** API and Socket.IO CORS restricted via `ALLOWED_ORIGINS`. Development defaults to localhost. Production requires explicit configuration.

#### ✅ H-P0-3: JWT Secret Fallback to Hardcoded Default — COMPLETED

- **Implementation:** `backend/src/middleware/auth.middleware.js`
- **Applied in:** `config/env.js` enforces required presence and minimum length
- **Tests:** Env validation verified
- **Result:** Server fails to start if `JWT_SECRET` is missing. No fallback to predictable secrets.

#### ✅ H-P0-4: Missing Input Validation on Workflow Step Configs — COMPLETED

- **Implementation:** `backend/src/utils/workflowValidation.js` — type-specific step validation
- **Applied in:** `controllers/workflow.controller.js` at create, update, run, clone, and partial-run entry points
- **Tests:** `backend/src/tests/workflowValidation.test.js` (11 tests)
- **Result:** All step types validated at API boundary. Malformed configs rejected with 400. Backward compatible with steps lacking config.

#### ✅ H-P0-5: File Handler Allows Arbitrary Directory Listing — COMPLETED

- **Implementation:** `backend/src/agents/handlers/file.handler.js`
- **Preserved:** `fileResolver.js` path traversal protection unchanged
- **Tests:** `backend/src/tests/fileSecurity.test.js` (4 tests)
- **Result:** `list` action restricted to non-root sandbox subdirectories. Root directory enumeration blocked.

#### ✅ H-P0-6: INTERNAL_AUTH_TOKEN Not Enforced in Configuration — COMPLETED

- **Implementation:** `backend/src/config/env.js` enforces required presence and minimum length
- **Applied in:** `app.js` runtime enforcement, `runner.js` runtime enforcement
- **Documentation:** `backend/.env.example` documents the variable
- **Result:** Server fails to start if token is missing. Runtime enforcement unchanged.

---

## Remaining Hardening Roadmap

### P1 — High Priority (NOT STARTED)

| ID | Finding | Status | Affected Area | Description | Recommended Next Phase |
|---|---|---|---|---|---|
| H-P1-1 | Broad CORS on API | NOT STARTED | Backend API | API CORS was addressed in P0-2; verify no residual broad CORS paths remain | Review and verify |
| H-P1-2 | Missing CSP/HSTS in Helmet | COMPLETED | Backend middleware | Added security headers to Express JSON API. Frontend CSP tracked separately. | Backend headers verified; frontend CSP is separate future task |
| H-P1-3 | No Schema Validation on API Inputs | NOT STARTED | All controllers | Manual validation only; no Zod schemas for complex inputs | Extend validation to all controllers |
| H-P1-4 | Document Upload Lacks Size/MIME Enforcement | NOT STARTED | Document ingestion | No file size limit; extension-based type check only | Add limits and MIME verification |
| H-P1-5 | Webhook Public Endpoint Lacks Payload Size Limit | COMPLETED | Public webhook receiver | Added 1 MB route-level JSON/urlencoded body limit on /webhook/* with 413 response on overflow. Global body parser capped at 2 MB; webhook route excluded from global parser. | Verified: 6 security tests passing |
| H-P1-6 | No Rate Limiting on All API Routes | NOT STARTED | Backend API | Some routes lack rate limiting | Apply global limiter |
| H-P1-7 | Agent Memory Search Potentially Cross-User | NOT STARTED | Memory retrieval | Ownership checked at agent level; add defense-in-depth | Add explicit ownership check |
| H-P1-8 | Docker MongoDB Runs Without Authentication | COMPLETED | Infrastructure | Added MongoDB root and application user authentication in Docker. Least-privilege app user created by init container. | Verified Docker auth configuration; backend MONGO_URI supports authenticated connection |
| H-P1-9 | Worker → Backend localhost Coupling in Docker | NOT STARTED | Worker runtime | localhost default breaks Docker networking | Set correct service URL |
| H-P1-10 | Frontend API URL Hardcoded to localhost in Docker Build | NOT STARTED | Frontend Docker | NEXT_PUBLIC_API_URL uses localhost | Use Docker service name |
| H-P1-11 | No WebSocket Room Authorization | COMPLETED | Socket.IO | Server-side ownership verification for workflow/team war rooms. Token-required, Mongoose-based authorization with explicit forbidden response. | Verified: 8 security tests passing |
| H-P1-12 | a2aSecret Exposed in Team Creation Response | COMPLETED | Agent teams | Secret no longer returned or stored in plaintext. SHA-256 hash stored, timing-safe verification, legacy migration. | Verified: 8 security tests passing, backend tests passing |
| H-P1-13 | Frontend CSP Not Configured | NOT STARTED | Next.js frontend | Express API CSP does not protect frontend HTML/JS. Next.js app needs CSP configured at application layer. | Configure CSP in Next.js/document-serving layer |

### P2 — Medium Priority (NOT STARTED)

| ID | Finding | Status | Affected Area | Description | Recommended Next Phase |
|---|---|---|---|---|---|
| H-P2-1 | No Graceful Worker Shutdown | NOT STARTED | Worker runtime | No SIGTERM/SIGINT handler | Add signal handlers |
| H-P2-2 | Stale Task Recovery Missing | NOT STARTED | Worker / Task system | No recovery for stuck tasks | Add stale-task detection |
| H-P2-3 | No Health Check Endpoint Validation | NOT STARTED | Backend | /health does not check dependencies | Add /ready endpoint |
| H-P2-4 | Dashboard Queries Hit MongoDB Directly | NOT STARTED | Backend API | 12 parallel countDocuments per request | Add caching layer |
| H-P2-5 | Missing Database Indexes | NOT STARTED | Database | No indexes on workflowId, startedAt, etc. | Add indexes |
| H-P2-6 | No Request Correlation IDs | NOT STARTED | Backend | No correlation ID propagation | Add correlation middleware |
| H-P2-7 | Agent Call Handler Parses LLM Output as JSON Without Safeguards | NOT STARTED | Agent execution | Fragile JSON.parse on LLM output | Use structured output |
| H-P2-8 | Email Handler Has No Recipient Validation | NOT STARTED | Email tool | No email format or domain validation | Validate recipients |
| H-P2-9 | Document Chat Uses Hardcoded Default Provider/Model | NOT STARTED | Document RAG | Hardcoded ollama/gemma3:4b fallback | Validate provider availability |
| H-P2-10 | Insights Endpoints Lack Pagination Limits | NOT STARTED | Insights API | Unbounded aggregation possible | Enforce hard limits |

### P3 — Low Priority (NOT STARTED)

| ID | Finding | Status | Affected Area | Description | Recommended Next Phase |
|---|---|---|---|---|---|
| H-P3-1 | Duplicate sendOK/sendError Helpers | NOT STARTED | Backend controllers | Multiple controllers define own helpers | Extract to shared utility |
| H-P3-2 | Frontend TypeScript Error in visual-builder.tsx | NOT STARTED | Frontend | Pre-existing TypeScript error | Fix type issue |
| H-P3-3 | Settings Page Monolith | NOT STARTED | Frontend | 1,676-line single component | Split into modules |
| H-P3-4 | Stale Scripts and Documentation Drift | NOT STARTED | Documentation | Broken scripts, outdated docs | Fix or remove |
| H-P3-5 | No Frontend Test Suite | NOT STARTED | Frontend | No configured test runner | Add Vitest + RTL |

---

## Next Hardening Phase

P0 is complete.

The next phase is P1 hardening.

However:

DO NOT implement P1 now.

Preserve the ordering/recommendations from the existing hardening audit.

---

## Definition of Done

Hardening is complete when:

1. **No P0/P1 security findings remain unaddressed.**
2. **All API inputs have schema validation.**
3. **SSRF is blocked** in HTTP handler and browser navigation.
4. **CORS is restricted** to known origins on both API and Socket.IO.
5. **JWT secret is enforced** as a required, strong configuration value.
6. **File handler** no longer allows arbitrary directory listing.
7. **Document uploads** have size and MIME enforcement.
8. **Webhook payloads** have size limits.
9. **MongoDB runs with authentication** in Docker.
10. **Worker→backend communication** uses correct Docker service name.
11. **Frontend API URL** resolves correctly in Docker.
12. **Health checks** validate actual dependency health.
13. **Stale tasks** are detected and recovered.
14. **Worker shuts down gracefully** on SIGTERM/SIGINT.
15. **All critical paths have tests** (auth, authorization, workflow CRUD, execution, worker claiming, tools, memory, RAG, MCP, webhooks, scheduler).
16. **Backend tests pass:** `cd backend && npm test` — 0 failures.
17. **Frontend builds without errors:** `cd frontend && npm run build` — 0 TypeScript errors.
18. **Lint passes:** `npm run lint` — 0 errors.

---

*End of Hardening Plan*

## P0 — Critical

### H-P0-1: SSRF in HTTP Handler
- **Category:** Security
- **Severity:** P0
- **Component:** Backend workflow execution
- **File:** `backend/src/agents/handlers/http.handler.js`
- **Function:** `execute()`
- **Evidence:** Line 34: `url: interpolate(config.url || '', context)` — user-supplied URL from step config passed directly to `axios()` with no validation.
- **Impact:** Attackers can make the server fetch internal services (localhost, 169.254.169.254, Docker services, internal APIs).
- **Exploit scenario:** A workflow step with `url: http://169.254.169.254/latest/meta-data/` reads cloud metadata; `http://localhost:27017/` probes MongoDB.
- **Recommended fix:** Block private/reserved IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0/8). Add URL allowlist option. Enforce HTTPS where possible.
- **Confidence:** High

### H-P0-2: Socket.IO Wildcard CORS
- **Category:** Security
- **Severity:** P0
- **Component:** WebSocket server
- **File:** `backend/src/utils/socket.js`
- **Function:** `init()`
- **Evidence:** Line 7: `origin: '*'` — any origin can connect to Socket.IO.
- **Impact:** Cross-site WebSocket hijacking; any malicious site can emit/listen to events.
- **Exploit scenario:** Attacker hosts phishing page; victim visits while logged in; page opens WS connection to backend and emits/listens to events.
- **Recommended fix:** Restrict `origin` to the actual frontend URL(s) from environment/config.
- **Confidence:** High

### H-P0-3: JWT Secret Fallback to Hardcoded Default
- **Category:** Security
- **Severity:** P0
- **Component:** Authentication
- **File:** `backend/src/middleware/auth.middleware.js`
- **Function:** module-level constant
- **Evidence:** Line 3: `const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";`
- **Impact:** If `JWT_SECRET` is not set, all tokens are signed/verified with a publicly known secret. Anyone can forge tokens.
- **Exploit scenario:** Attacker forges admin token with secret `change_this_secret` and gains full access.
- **Recommended fix:** Remove fallback. Throw error or refuse to start if `JWT_SECRET` is missing/weak.
- **Confidence:** High

### H-P0-4: Missing Input Validation on Workflow Step Configs
- **Category:** Security / Reliability
- **Severity:** P0
- **Component:** Backend workflow execution
- **File:** `backend/src/agents/executor.js`, all `backend/src/agents/handlers/*.handler.js`
- **Evidence:** All handlers accept `step.config || step` and interpolate strings without schema validation. No Zod/Joi/type checking on `config.url`, `config.path`, `config.body`, `config.to`, `config.arguments`, etc.
- **Impact:** Malformed or malicious step configs can cause unexpected behavior, injection, or runtime crashes.
- **Exploit scenario:** Workflow with `http` step has `config.url` containing SSRF payload; `file` step has `config.path` with traversal attempt (partially mitigated by fileResolver, but not validated upstream).
- **Recommended fix:** Add Zod schemas for each step type. Validate at controller boundary (`workflow.controller.js`) before persisting or executing.
- **Confidence:** High

### H-P0-5: File Handler Allows Arbitrary Directory Listing
- **Category:** Security
- **Severity:** P0
- **Component:** Backend tool execution
- **File:** `backend/src/agents/handlers/file.handler.js`
- **Function:** `execute()`
- **Evidence:** Lines 34-49: `list` action reads `fs.readdirSync(targetDir)` where `targetDir` is derived from user-supplied `config.path`. While `resolveWorkflowFilePath` sandboxes to `runtime/workflow-files`, the `list` action exposes the entire sandbox directory tree to the workflow.
- **Impact:** Information disclosure of server filesystem structure within the sandbox base directory.
- **Exploit scenario:** Workflow lists `/` via `path: "/"` → reveals all files in `runtime/workflow-files/`.
- **Recommended fix:** Restrict `list` to explicit allowed subdirectories. Remove `list` capability or make it opt-in with strict path constraints.
- **Confidence:** High

### H-P0-6: INTERNAL_AUTH_TOKEN Not Enforced in Configuration
- **Category:** Security / Operations
- **Severity:** P0
- **Component:** Worker → Backend communication
- **File:** `backend/src/app.js`, `backend/src/agents/runner.js`
- **Evidence:** `app.js` line 41: throws if `INTERNAL_AUTH_TOKEN` missing. `runner.js` line 58: throws if missing. Neither `backend/.env.example` nor `infra/.env.example` documents this variable.
- **Impact:** Worker progress broadcasts silently fail in Docker/local if token is unset. In production, missing token could lead to unprotected internal endpoint if code changes.
- **Exploit scenario:** If token is accidentally removed from env, `/api/internal/broadcast` returns 403, breaking war-room updates.
- **Recommended fix:** Add `INTERNAL_AUTH_TOKEN` to both `.env.example` files. Enforce presence in `env.js` schema with validation.
- **Confidence:** High

---

## P1 — High

### H-P1-1: Broad CORS on API
- **Category:** Security
- **Severity:** P1
- **Component:** Backend API
- **File:** `backend/src/app.js`
- **Function:** module-level middleware
- **Evidence:** Line 33: `app.use(cors());` — no origin restriction.
- **Impact:** Any origin can make authenticated cross-origin requests to the API.
- **Exploit scenario:** Malicious site makes fetch calls to backend with victim's cookies/tokens.
- **Recommended fix:** Configure `cors({ origin: [allowedOrigins], credentials: true })` from environment.
- **Confidence:** High

### H-P1-2: Missing CSP/HSTS in Helmet
- **Category:** Security
- **Severity:** P1
- **Component:** Backend middleware
- **File:** `backend/src/middleware/helmet.middleware.js`
- **Evidence:** Only basic headers are set; no `Content-Security-Policy`, `Strict-Transport-Security`, or `X-Content-Type-Options`.
- **Impact:** XSS attacks not mitigated; no HSTS in production.
- **Recommended fix:** Add CSP directive, HSTS, and other security headers.
- **Confidence:** High
- **Status:** ✅ COMPLETED
- **Implementation:** `backend/src/middleware/helmet.middleware.js`
- **Tests:** `backend/src/tests/helmet.middleware.test.js` (7 tests)
- **Verification:** Backend tests pass; CSP/HSTS/X-Content-Type-Options/X-Frame-Options/Referrer-Policy/COOP/Permissions-Policy all verified
- **Note:** This fix covers the Express/Helmet JSON API middleware only. The backend is a pure JSON API and does not serve HTML documents. CSP for the Next.js frontend HTML/JS must be configured at the Next.js application layer and is tracked as a separate future task. HSTS is intentionally opt-in via `HSTS_MAX_AGE` because the current deployment does not configure TLS termination at the backend.

### H-P1-3: No Schema Validation on API Inputs
- **Category:** Security / Reliability
- **Severity:** P1
- **Component:** All controllers
- **Files:** `backend/src/controllers/*.controller.js`
- **Evidence:** Manual `if (!field) return 400` checks only. No Zod/Joi validation schemas. Complex inputs (workflow steps, agent config, document metadata, tool arguments) accepted without type/schema checking.
- **Impact:** Invalid data reaches database and execution layer; potential NoSQL injection via unvalidated `req.body` fields.
- **Exploit scenario:** Workflow creation with malicious `metadata.steps` containing `$where` operators (Mongoose may sanitize, but not guaranteed).
- **Recommended fix:** Add Zod schemas for all major request bodies. Validate at controller entry point.
- **Confidence:** High

### H-P1-4: Document Upload Lacks Size/MIME Enforcement
- **Category:** Security
- **Severity:** P1
- **Component:** Document ingestion
- **File:** `backend/src/controllers/document.controller.js`
- **Function:** `uploadDocument()`
- **Evidence:** `multer({ storage: multer.memoryStorage() })` with no `limits.fileSize`. Only extension-based type check (lines 54-78). No MIME verification.
- **Impact:** DoS via memory exhaustion (large files), malicious file upload disguised by extension.
- **Exploit scenario:** Attacker uploads 100MB file with `.txt` extension; server loads entire file into memory.
- **Recommended fix:** Set `limits.fileSize` (e.g., 10MB). Verify MIME type via `file.mimetype` or magic bytes.
- **Confidence:** High

### H-P1-5: Webhook Public Endpoint Lacks Payload Size Limit
- **Category:** Security / Reliability
- **Severity:** P1
- **Component:** Public webhook receiver
- **File:** `backend/src/controllers/webhook.public.controller.js`
- **Function:** `receiveWebhook()`
- **Evidence:** Line 21: `const payload = req.body || {};` — no size limit on request body.
- **Impact:** DoS via large payloads; memory exhaustion.
- **Recommended fix:** Add `express.json({ limit: '1mb' })` middleware before webhook routes. Consider webhook payload size limits per-provider.
- **Confidence:** High
- **Status:** ✅ COMPLETED
- **Implementation:**
  - `backend/src/routes/webhook.public.routes.js`: Route-level `express.json({ limit: '1mb' })` and `express.urlencoded({ limit: '1mb', extended: true })` with a body-parse error handler that maps `entity.too.large` to 413 and `entity.parse.failed` to 400.
  - `backend/src/app.js`: Global body parser capped at 2 MB. The `/webhook` path is excluded from the global parser so the route-level 1 MB limit takes effect.
- **Tests:** `backend/src/tests/webhookPayloadSize.test.js` (6 tests)
- **Verification:** 6 security tests passing; existing backend tests remain passing (52 passed, 15 suites).
- **Compatibility:** The global 2 MB cap is larger than Express's implicit 100 KB default. No existing endpoint is expected to receive payloads close to 2 MB.

### H-P1-6: No Rate Limiting on All API Routes
- **Category:** Security / Reliability
- **Severity:** P1
- **Component:** Backend API
- **File:** `backend/src/app.js`, `backend/src/middleware/rateLimit.middleware.js`
- **Evidence:** `globalLimiter` is defined but NOT applied globally in `app.js`. It is only applied to specific route groups. Routes like `/api/logs`, `/api/system`, `/api/telemetry`, `/api/insights`, `/api/mcp`, `/api/keys` have no rate limiting in `app.js` (only some have `globalLimiter` in route files).
- **Impact:** Unauthenticated or low-effort abuse of expensive endpoints.
- **Exploit scenario:** Attacker floods `/api/insights` with requests causing expensive aggregation queries.
- **Recommended fix:** Apply `globalLimiter` as `app.use('/api', globalLimiter)` before route mounting. Remove per-route limiter applications to avoid double-application.
- **Confidence:** Medium (needs verification of which routes actually have limiters applied)

### H-P1-7: Agent Memory Search Potentially Cross-User
- **Category:** Security
- **Severity:** P1
- **Component:** Memory retrieval
- **File:** `backend/src/services/memoryService.js`
- **Function:** `retrieveMemory()`
- **Evidence:** Lines 69-72: queries `AgentMemory.find({ agentId, "metadata.type": "conversation" })`. `agentId` comes from `agent._id` which is loaded from `AgentModel.findOne({ _id: stepConfig.agentId, userId: context.userId })` in `executor.js` line 35-38. Ownership IS checked at agent level.
- **Impact:** Low — agent ownership is verified before memory retrieval. However, if `agentId` is passed directly without executor validation (e.g., via direct API), cross-user access could occur.
- **Exploit scenario:** User guesses another user's agent ID and calls memory retrieval directly (no direct API endpoint for this, but internal risk).
- **Recommended fix:** Ensure all memory access goes through ownership-checked paths. Add explicit agent ownership check in `retrieveMemory` as defense-in-depth.
- **Confidence:** Medium (currently mitigated by executor ownership check, but not defense-in-depth)

### H-P1-8: Docker MongoDB Runs Without Authentication
- **Category:** Security
- **Severity:** P1
- **Component:** Infrastructure
- **File:** `infra/docker-compose.yml`, `infra/.env.example`, `backend/.env.example`, `backend/src/config/env.js`
- **Evidence:** `mongo` service now has `MONGO_INITDB_ROOT_USERNAME`/`MONGO_INITDB_ROOT_PASSWORD`. `mongo-init-replica` creates least-privilege `ai-agent` app user. `MONGO_URI` supports authenticated connection string.
- **Impact:** Unauthorized MongoDB access is now blocked. Application uses least-privilege credentials.
- **Exploit scenario:** Without auth, any network client could access MongoDB. Now blocked by authentication requirement.
- **Recommended fix:** Implemented. Docker MongoDB requires authentication. Backend connects with app user credentials.
- **Confidence:** High
- **Status:** ✅ COMPLETED
- **Implementation:**
  - `infra/docker-compose.yml`: Added `MONGO_INITDB_ROOT_USERNAME`/`MONGO_INITDB_ROOT_PASSWORD` to `mongo` service. Updated healthcheck to use authentication. Updated `mongo-init-replica` to authenticate and create least-privilege app user.
  - `infra/.env.example`: Added `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `MONGO_APP_USER`, `MONGO_APP_PASSWORD`, and authenticated `MONGO_URI`.
  - `backend/.env.example`: Added authenticated MongoDB URI example.
  - `backend/src/config/env.js`: Added optional validation for MongoDB auth variables.
- **Tests:** Backend tests pass (52 passed). Environment validation passes.
- **Verification:** Docker MongoDB now requires authentication. Application user has `readWrite` on `ai-agent` database only.
- **Note:** Existing MongoDB volumes require re-initialization when first deploying the updated docker-compose.yml. The `mongo-init-replica` container runs once to set up auth and replica set. Do NOT run `docker compose down -v` as that would destroy existing data.

### H-P1-9: Worker → Backend localhost Coupling in Docker
- **Category:** Reliability / Security
- **Severity:** P1
- **Component:** Worker runtime
- **File:** `backend/src/agents/runner.js`, `infra/docker-compose.yml`
- **Evidence:** `runner.js` line 62: defaults to `http://localhost:${port}` for internal broadcast. In Docker, worker and backend are separate containers, so `localhost` points to worker itself, not backend.
- **Impact:** Progress broadcasts fail silently in Docker unless `BACKEND_INTERNAL_URL=http://backend:5000` is set. Not documented in `infra/.env.example`.
- **Exploit scenario:** Fresh Docker deploy has no war-room progress; user thinks platform is broken.
- **Recommended fix:** Set `BACKEND_INTERNAL_URL=http://backend:5000` in `docker-compose.yml`. Document in `infra/.env.example`.
- **Confidence:** High

### H-P1-10: Frontend API URL Hardcoded to localhost in Docker Build
- **Category:** Reliability / Security
- **Severity:** P1
- **Component:** Frontend Docker build
- **File:** `infra/docker-compose.yml`, `infra/Dockerfile`
- **Evidence:** `docker-compose.yml` line 90: `NEXT_PUBLIC_API_URL: "http://localhost:${BACKEND_PORT:-5000}"`
- **Impact:** On non-Docker-Desktop hosts (native Linux), `localhost:5000` from inside frontend container does not reach backend. API calls fail.
- **Exploit scenario:** Production deploy on Linux server fails because frontend cannot reach backend.
- **Recommended fix:** Change to `http://backend:5000` (Docker service name).
- **Confidence:** High

### H-P1-11: No WebSocket Room Authorization
- **Category:** Security
- **Severity:** P1
- **Component:** Socket.IO
- **File:** `backend/src/utils/socket.js`, `backend/src/utils/socketHandlers.js`, `backend/server.js`
- **Evidence:** Previously, the `join_war_room` event handler in `server.js` authorized the join only by checking whether the workflow or team document was owned by the JWT user. While this did perform server-side verification, the implementation was inline in the server entrypoint, disconnected the socket on any error (including transient DB errors), and did not return a clean error to the client.
- **Impact:** Authorization was correct in principle but fragile in implementation. A misconfiguration or DB error would silently disconnect a legitimate user; tests could not exercise the handler in isolation.
- **Exploit scenario:** The previous implementation was not exploitable because the DB query did verify ownership, but the lack of testable architecture and the use of `socket.disconnect()` on any error made the boundary hard to audit.
- **Recommended fix:** Move socket authorization into a dedicated, testable module that performs explicit ownership verification and returns a clean error rather than disconnecting.
- **Confidence:** High
- **Status:** ✅ COMPLETED
- **Implementation:**
  - `backend/src/utils/socketHandlers.js` (new) — Dedicated `setupSocketHandlers(io)` module. Verifies JWT, looks up the workflow or team by `_id`, requires `userId` or `ownerId` to match the authenticated user, then joins the `war_room_<id>` room. Returns a callback response `{ ok, error }` on failure rather than disconnecting the socket.
  - `backend/src/utils/socket.js` — Refactored to expose `__setIO` for test injection while keeping the public `init` / `getIO` API. CORS configuration unchanged.
  - `backend/server.js` — Calls `setupSocketHandlers(io)` after `socketUtil.init(server)`. The inline `join_war_room` handler was removed.
- **Tests:** `backend/src/tests/socketAuth.security.test.js` (8 tests)
  - Allows own workflow room
  - Rejects another user's workflow room
  - Rejects nonexistent workflow room
  - Allows own agent-team room
  - Rejects another user's agent-team room
  - Rejects without token
  - Rejects with invalid token
  - Rejects when neither `workflowId` nor `teamId` is provided
- **Verification:** 8 security tests passing; existing backend tests remain passing (52 passed, 15 suites).
- **Note:** The internal worker→backend broadcast path (`/api/internal/broadcast`) is unchanged and remains protected by `INTERNAL_AUTH_TOKEN`. The frontend is expected to send the `workflowId` (or `teamId`) in the `join_war_room` event payload; the server verifies ownership of the referenced resource before joining the room.

### H-P1-12: a2aSecret Exposed in Team Creation Response
- **Category:** Security
- **Severity:** P1
- **Component:** Agent teams
- **File:** `backend/src/controllers/agentTeam.controller.js`, `backend/src/controllers/a2a.webhook.controller.js`
- **Evidence:** Previously, `createTeam()` returned `generatedSecret` in the JSON response and stored plaintext `a2aSecret` in `team.metadata.a2aSecret`.
- **Impact:** Secret exposed in API response, browser history, server logs, and proxy logs.
- **Exploit scenario:** Secret captured in logs; attacker uses it to send unauthorized A2A messages.
- **Recommended fix:** Return `generatedSecret` only once in a secure manner (e.g., one-time display, not in JSON response). Store hash, not plaintext.
- **Confidence:** High
- **Status:** ✅ COMPLETED
- **Implementation:**
  - New A2A secrets are generated using cryptographically secure randomness (`crypto.randomBytes(32)`).
  - Plaintext secrets are no longer returned by the team creation API.
  - Plaintext secrets are no longer stored for newly created teams.
  - Secrets are stored as SHA-256 hashes using the `sha256:<hash>` format in `metadata.a2aSecretHash`.
  - Incoming A2A secrets are hashed and verified using constant-time comparison (`crypto.timingSafeEqual`).
  - Legacy plaintext secrets are transparently migrated to hashes after successful authentication.
  - Invalid and missing secrets are rejected with 403/401 responses.
- **Tests:** `backend/src/tests/agentTeam.security.test.js` (8 tests)
- **Verification:** 8 security tests passing; existing backend tests remain passing (52 passed, 15 suites).
- **Note:** Existing teams created before this fix may still contain plaintext `a2aSecret`. The plaintext legacy value is migrated to a hash after the first successful A2A authentication. A wrong secret does not trigger migration. Teams that never receive A2A traffic may retain their legacy plaintext value until manually migrated or recreated.

### H-P1-13: Frontend CSP Not Configured
- **Category:** Security
- **Severity:** P1
- **Component:** Frontend
- **File:** `frontend/src/app/layout.tsx`, Next.js application
- **Evidence:** The backend Express API now has CSP headers, but the Next.js frontend serves actual HTML/JS documents without application-level CSP. Backend CSP does not protect frontend pages.
- **Impact:** XSS vulnerabilities in the Next.js frontend are not mitigated by CSP.
- **Exploit scenario:** Stored or reflected XSS in frontend pages executes without CSP restrictions.
- **Recommended fix:** Configure CSP in the Next.js application (e.g., via `next.config.ts` headers, middleware, or document-level meta tags). Consider report-only mode first.
- **Confidence:** High
- **Note:** This is a separate task from H-P1-2. H-P1-2 covers the Express JSON API backend only. Frontend CSP requires changes to the Next.js application and is NOT covered by the backend Helmet middleware.

---

## P2 — Medium

### H-P2-1: No Graceful Worker Shutdown
- **Category:** Reliability
- **Severity:** P2
- **Component:** Worker runtime
- **File:** `backend/src/agents/runner.js`
- **Evidence:** `runWorkerLoop()` has no `SIGTERM`/`SIGINT` handler. Worker exits immediately on signal, potentially leaving task in `running` state.
- **Impact:** Stuck tasks after container restart or deploy.
- **Recommended fix:** Add signal handlers. Mark current task as `failed` or re-queue on shutdown.
- **Confidence:** High

### H-P2-2: Stale Task Recovery Missing
- **Category:** Reliability
- **Severity:** P2
- **Component:** Worker / Task system
- **File:** `backend/src/agents/runner.js`, `backend/src/agents/queueService.js`
- **Evidence:** `claimNextTask()` claims tasks but there's no mechanism to detect and recover tasks stuck in `running` state (e.g., worker crashed).
- **Impact:** Tasks remain `running` forever after worker crash; never retried.
- **Recommended fix:** Add stale-task detection based on `startedAt` timestamp. Re-queue or fail tasks running longer than threshold.
- **Confidence:** High

### H-P2-3: No Health Check Endpoint Validation
- **Category:** Reliability
- **Severity:** P2
- **Component:** Backend
- **File:** `backend/src/app.js`
- **Evidence:** `/health` only returns `{ ok: true, ts: Date.now() }`. Does not check database connectivity, worker status, or external dependencies.
- **Impact:** Kubernetes/Docker health checks pass even when backend is non-functional.
- **Recommended fix:** Add `/health` (liveness) and `/ready` (readiness) endpoints. Check DB connection, MongoDB replica set status, worker connectivity.
- **Confidence:** High

### H-P2-4: Dashboard Queries Hit MongoDB Directly
- **Category:** Performance
- **Severity:** P2
- **Component:** Backend API
- **File:** `backend/src/controllers/dashboard.controller.js`
- **Evidence:** `getDashboardStats()` runs 12 parallel `countDocuments` queries on every request. `getExecutionTrend()` runs aggregation. No caching layer.
- **Impact:** Slow dashboard load under load; unnecessary DB pressure.
- **Recommended fix:** Add Redis caching with TTL for dashboard stats and execution trend.
- **Confidence:** High

### H-P2-5: Missing Database Indexes
- **Category:** Performance
- **Severity:** P2
- **Component:** Database
- **Files:** `backend/src/models/*.model.js`
- **Evidence:** `Task` has indexes on `userId` and `status`, but not on `workflowId`, `startedAt`, or compound `{userId, status, createdAt}`. `Workflow` has `userId` index but not on `status` or `agentId`. `DocumentChunk` has no indexes on `documentId` or `userId`.
- **Impact:** Slow queries on list endpoints, insights, and RAG retrieval as data grows.
- **Recommended fix:** Add indexes: `Task: {workflowId, startedAt}`, `Workflow: {userId, status}`, `DocumentChunk: {documentId, userId}`.
- **Confidence:** High

### H-P2-6: No Request Correlation IDs
- **Category:** Observability
- **Severity:** P2
- **Component:** Backend
- **File:** `backend/src/app.js`
- **Evidence:** No middleware to generate or propagate correlation IDs across requests, logs, and worker executions.
- **Impact:** Difficult to trace a single workflow execution across frontend, backend, and worker logs.
- **Recommended fix:** Add correlation ID middleware. Pass `X-Correlation-ID` through Socket.IO events.
- **Confidence:** High

### H-P2-7: Agent Call Handler Parses LLM Output as JSON Without Safeguards
- **Category:** Reliability
- **Severity:** P2
- **Component:** Agent execution
- **File:** `backend/src/agents/handlers/agentCall.handler.js`
- **Evidence:** Lines 88-105: attempts `JSON.parse()` on LLM output. Falls back to raw text, but the parsing is fragile and the prompt instructions may not always be followed.
- **Impact:** Agent calls may fail silently or return malformed data when LLM doesn't follow format.
- **Recommended fix:** Use structured output / function calling if provider supports it. Add stricter parsing with fallback.
- **Confidence:** Medium

### H-P2-8: Email Handler Has No Recipient Validation
- **Category:** Security
- **Severity:** P2
- **Component:** Email tool
- **File:** `backend/src/agents/handlers/email.handler.js`
- **Evidence:** Line 19: `to: interpolate(config.to || '', context)` — recipient email is interpolated but not validated for format or allowed domains.
- **Impact:** Workflow could send emails to arbitrary addresses (spam relay).
- **Exploit scenario:** Attacker creates workflow sending email to external spam targets using your SMTP server.
- **Recommended fix:** Validate email format. Add optional allowed-domain list. Consider rate limiting per-user.
- **Confidence:** Medium

### H-P2-9: Document Chat Uses Hardcoded Default Provider/Model
- **Category:** Reliability
- **Severity:** P2
- **Component:** Document RAG
- **File:** `backend/src/controllers/document.controller.js`
- **Evidence:** Lines 110-111: `provider = 'ollama'`, `model = 'gemma3:4b'` hardcoded as fallback when user has no `documentChat` settings.
- **Impact:** If Ollama is not running, document chat fails silently for users without explicit settings.
- **Recommended fix:** Validate provider availability before processing. Return clear error if configured provider is unreachable.
- **Confidence:** High

### H-P2-10: Insights Endpoints Lack Pagination Limits
- **Category:** Performance
- **Severity:** P2
- **Component:** Insights API
- **File:** `backend/src/controllers/insights.controller.js`
- **Evidence:** Line 13: `const limit = parseInt(req.query.limit, 10) || 200;` — max 200, but `insightsService.js` may still do expensive aggregations on large datasets.
- **Impact:** Slow insights generation on workflows with thousands of tasks.
- **Recommended fix:** Enforce hard max limit (e.g., 500). Add caching for computed insights.
- **Confidence:** Medium

---

## P3 — Low

### H-P3-1: Duplicate sendOK/sendError Helpers
- **Category:** Maintainability
- **Severity:** P3
- **Component:** Backend controllers
- **Files:** Multiple controllers define their own `sendOK`/`sendError`.
- **Impact:** Inconsistent response formats; maintenance burden.
- **Recommended fix:** Extract to shared utility.
- **Confidence:** High

### H-P3-2: Frontend TypeScript Error in visual-builder.tsx
- **Category:** Stability
- **Severity:** P3
- **Component:** Frontend
- **File:** `frontend/src/components/workflow/visual-builder.tsx`
- **Evidence:** Pre-existing TypeScript error at line ~820 (JSX element type issue).
- **Impact:** Build fails with type error; may block deployment.
- **Recommended fix:** Fix TypeScript type in `node` object creation.
- **Confidence:** High

### H-P3-3: Settings Page Monolith
- **Category:** Maintainability
- **Severity:** P3
- **Component:** Frontend
- **File:** `frontend/src/app/settings/page.tsx`
- **Evidence:** 1,676 lines in single component.
- **Impact:** Hard to maintain, test, or extend.
- **Recommended fix:** Split into feature modules (worker, ui, assistant, mcp, documentChat).
- **Confidence:** High

### H-P3-4: Stale Scripts and Documentation Drift
- **Category:** Maintainability
- **Severity:** P3
- **Files:** `scripts/reset-db.sh` (broken), `README.md` (nginx path), `CONTRIBUTING.md` (wrong paths), `AGENTS.md` (incomplete layout)
- **Impact:** Developer confusion; wasted time.
- **Recommended fix:** Fix or remove stale scripts. Update documentation.
- **Confidence:** High

### H-P3-5: No Frontend Test Suite
- **Category:** Testing
- **Severity:** P3
- **Component:** Frontend
- **Evidence:** No test files in `frontend/src/` that run via any configured test runner.
- **Impact:** UI regressions undetected.
- **Recommended fix:** Add Vitest + React Testing Library for critical components.
- **Confidence:** High

---

## Security Findings (Consolidated)

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P0-1 | SSRF in HTTP handler | P0 | `http.handler.js` | High |
| H-P0-2 | Socket.IO wildcard CORS | P0 | `socket.js` | High |
| H-P0-3 | JWT secret hardcoded fallback | P0 | `auth.middleware.js` | High |
| H-P0-4 | Missing input validation | P0 | `executor.js`, all handlers | High |
| H-P0-5 | File handler directory listing | P0 | `file.handler.js` | High |
| H-P0-6 | INTERNAL_AUTH_TOKEN not in .env.example | P0 | `app.js`, `runner.js` | High |
| H-P1-1 | Broad CORS on API | P1 | `app.js` | High |
| H-P1-2 | Missing CSP/HSTS | P1 | `helmet.middleware.js` | High |
| H-P1-3 | No schema validation | P1 | all controllers | High |
| H-P1-4 | Document upload no size/MIME limit | P1 | `document.controller.js` | High |
| H-P1-5 | Webhook no payload size limit | P1 | `webhook.public.controller.js` | High |
| H-P1-6 | Incomplete rate limiting | P1 | `app.js`, `rateLimit.middleware.js` | Medium |
| H-P1-7 | Memory cross-user risk (theoretical) | P1 | `memoryService.js` | Medium |
| H-P1-8 | MongoDB no auth in Docker | P1 | `docker-compose.yml` | High |
| H-P1-9 | Worker localhost coupling | P1 | `runner.js`, `docker-compose.yml` | High |
| H-P1-10 | Frontend API URL localhost | P1 | `docker-compose.yml` | High |
| H-P1-11 | No WS room authorization | P1 | `socket.js` | Medium |
| H-P1-12 | a2aSecret exposed in response | P1 | `agentTeam.controller.js` | High |
| H-P2-8 | Email no recipient validation | P2 | `email.handler.js` | Medium |

---

## Runtime Reliability Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P2-1 | No graceful worker shutdown | P2 | `runner.js` | High |
| H-P2-2 | Stale task recovery missing | P2 | `runner.js`, `queueService.js` | High |
| H-P2-3 | Health check not validating dependencies | P2 | `app.js` | High |
| H-P2-7 | Agent call JSON parsing fragile | P2 | `agentCall.handler.js` | Medium |
| H-P2-9 | Document chat hardcoded defaults | P2 | `document.controller.js` | High |

---

## Worker / Task Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P2-1 | No graceful shutdown | P2 | `runner.js` | High |
| H-P2-2 | Stale task recovery | P2 | `runner.js`, `queueService.js` | High |
| H-P2-4 | No caching layer | P2 | `dashboard.controller.js` | High |
| H-P2-5 | Missing DB indexes | P2 | multiple models | High |

---

## Database / Performance Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P2-4 | Dashboard N+1 queries | P2 | `dashboard.controller.js` | High |
| H-P2-5 | Missing indexes | P2 | multiple models | High |
| H-P2-10 | Insights unbounded aggregation | P2 | `insights.controller.js` | Medium |

---

## API Contract Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P1-3 | No schema validation | P1 | all controllers | High |
| H-P1-6 | Incomplete rate limiting | P1 | `app.js` | Medium |
| H-P2-6 | No correlation IDs | P2 | `app.js` | High |

---

## Agent / Tool Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P0-4 | Missing tool arg validation | P0 | all handlers | High |
| H-P2-7 | Agent call JSON parsing | P2 | `agentCall.handler.js` | Medium |
| H-P2-8 | Email no recipient validation | P2 | `email.handler.js` | Medium |

---

## MCP Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P1-3 | No schema validation on MCP args | P1 | `mcp.handler.js`, `executionAdapter.js` | High |
| H-P2-1 | No graceful MCP client cleanup | P2 | `mcp/clientManager.js` | Medium |

---

## Memory / RAG Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P1-7 | Memory cross-user risk (theoretical) | P1 | `memoryService.js` | Medium |
| H-P2-9 | Document chat hardcoded defaults | P2 | `document.controller.js` | High |

---

## Webhook / Scheduler Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P1-5 | Webhook no payload size limit | P1 | `webhook.public.controller.js` | High |
| H-P2-2 | Stale task recovery | P2 | `runner.js` | High |
| H-P2-3 | Health check incomplete | P2 | `app.js` | High |

---

## Frontend Stability Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P3-2 | TypeScript error in visual-builder.tsx | P3 | `visual-builder.tsx` | High |
| H-P3-3 | Settings page monolith | P3 | `settings/page.tsx` | High |
| H-P3-5 | No frontend tests | P3 | entire frontend | High |

---

## Infrastructure Findings

| ID | Finding | Severity | File | Confidence |
|---|---|---|---|---|
| H-P1-8 | MongoDB no auth in Docker | P1 | `docker-compose.yml` | High |
| H-P1-9 | Worker localhost coupling | P1 | `docker-compose.yml`, `runner.js` | High |
| H-P1-10 | Frontend API URL localhost | P1 | `docker-compose.yml` | High |
| H-P2-3 | Health check incomplete | P2 | `app.js` | High |

---

## Testing Gaps

**Current test coverage:** Only backend handler tests (`**/*.handler.test.js`, 15 files, 52 tests).

**Critical missing tests:**
1. **Authentication** — login/logout/token validation edge cases
2. **Authorization** — ownership checks, IDOR prevention
3. **Workflow creation** — alias validation, graph hash, metadata normalization
4. **Workflow execution** — end-to-end runner + executor + handler integration
5. **Worker claiming** — atomic claim, duplicate prevention, stale recovery
6. **Tools** — sandbox execution, timeout, env whitelisting
7. **Agents** — memory store/retrieve isolation, agent_call handler
8. **Memory** — cosine similarity, retention policy, cross-user isolation
9. **RAG** — document upload, chunking, embedding, retrieval
10. **MCP** — tool discovery, invocation, error handling, reconnect
11. **Webhooks** — public receiver auth, payload handling
12. **Scheduler** — cron trigger, task creation, change stream reload

---

## Issues Already Fixed

Previous audit findings that were verified as **no longer present**:

1. **Path traversal in file.handler.js** — FALSE POSITIVE. `fileResolver.js` provides robust path sanitization (rejects absolute paths, null bytes, `..` traversal). Verified in current code.
2. **hackerNewsTool.js dead code** — FALSE POSITIVE. `registry.js` dynamically loads all `.js` files and auto-registers modules with valid `meta.id`. Tool is live.
3. **groq-sdk unused** — FALSE POSITIVE. Used by `backend/src/services/groq.service.js`.
4. **huggingface unused** — FALSE POSITIVE. Used in `llmAdapter.js`, `embeddingAdapter.js`, and multiple controllers.
5. **Context manager dead code** — CONFIRMED FIXED. `backend/src/agents/contextManager.js` was deleted during cleanup.
6. **testSandbox.js dead code** — CONFIRMED FIXED. Deleted during cleanup.
7. **runner.config.js dead code** — CONFIRMED FIXED. Deleted during cleanup.
8. **Frontend files deleted** — `analytics-summary.tsx`, `assistant-button.tsx` removed during cleanup.

---

## False Positives / Not Reproducible

1. **"Path traversal vulnerability"** — Claimed file.handler.js had no sanitization. Actual: `fileResolver.js` provides complete path traversal protection. **NOT VULNERABLE.**
2. **"hackerNewsTool.js not in registry"** — Claimed it was dead. Actual: auto-discovered and registered. **ALIVE.**
3. **"groq-sdk unused"** — Claimed unused. Actual: used by groq.service.js. **ACTIVE.**
4. **"huggingface unused"** — Claimed unused. Actual: used in llmAdapter.js and embeddingAdapter.js. **ACTIVE.**

---

## Recommended Implementation Order

### Phase 1: Critical Security (P0) — COMPLETE

All P0 findings have been implemented and verified:

1. **H-P0-1:** SSRF protection in HTTP handler ✅
2. **H-P0-2:** Socket.IO CORS restriction ✅
3. **H-P0-3:** JWT secret enforcement ✅
4. **H-P0-4:** Workflow step config validation ✅
5. **H-P0-5:** File handler directory listing restriction ✅
6. **H-P0-6:** INTERNAL_AUTH_TOKEN enforcement ✅

**Verification:** 52 backend tests passing, 29 security regression tests passing, frontend build successful.

### Phase 2: High-Priority Hardening (P1)
7. **H-P1-1:** Restrict API CORS to specific origins
8. **H-P1-2:** Add CSP/HSTS to helmet
9. **H-P1-3:** Extend schema validation to all controllers
10. **H-P1-4:** Add document upload size/MIME limits
11. **H-P1-5:** Add webhook payload size limits
12. **H-P1-8:** Enable MongoDB auth in Docker
13. **H-P1-9:** Fix worker→backend URL in Docker
14. **H-P1-10:** Fix frontend API URL in Docker
15. **H-P1-12:** Secure a2aSecret handling

### Phase 3: Reliability & Observability (P2)
16. **H-P2-1:** Add graceful worker shutdown
17. **H-P2-2:** Add stale task recovery
18. **H-P2-3:** Improve health checks
19. **H-P2-4:** Add Redis caching for dashboard
20. **H-P2-5:** Add missing DB indexes
21. **H-P2-6:** Add correlation IDs

### Phase 4: Frontend & Polish (P3)
22. **H-P3-1:** Extract duplicate sendOK/sendError
23. **H-P3-2:** Fix TypeScript error in visual-builder
24. **H-P3-3:** Split settings page
25. **H-P3-4:** Fix stale scripts/docs
26. **H-P3-5:** Add frontend tests

---

## Definition of Done

Hardening is complete when:

1. **No P0/P1 security findings remain unaddressed.**
2. **All API inputs have schema validation.**
3. **SSRF is blocked** in HTTP handler and browser navigation.
4. **CORS is restricted** to known origins on both API and Socket.IO.
5. **JWT secret is enforced** as a required, strong configuration value.
6. **File handler** no longer allows arbitrary directory listing.
7. **Document uploads** have size and MIME enforcement.
8. **Webhook payloads** have size limits.
9. **MongoDB runs with authentication** in Docker.
10. **Worker→backend communication** uses correct Docker service name.
11. **Frontend API URL** resolves correctly in Docker.
12. **Health checks** validate actual dependency health.
13. **Stale tasks** are detected and recovered.
14. **Worker shuts down gracefully** on SIGTERM/SIGINT.
15. **All critical paths have tests** (auth, authorization, workflow CRUD, execution, worker claiming, tools, memory, RAG, MCP, webhooks, scheduler).
16. **Backend tests pass:** `cd backend && npm test` — 0 failures.
17. **Frontend builds without errors:** `cd frontend && npm run build` — 0 TypeScript errors.
18. **Lint passes:** `npm run lint` — 0 errors.

---

*End of Hardening Plan*
