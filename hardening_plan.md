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
| H-P1-6 | No Rate Limiting on All API Routes | COMPLETED | Backend API | Single API-wide baseline rate limiter applied at /api mount. Per-route duplicates removed to prevent double application. | Verified: 8 security tests passing |
| H-P1-7 | Agent Memory Search Potentially Cross-User | COMPLETED | Memory retrieval | Added explicit ownership check at memoryService boundary | Verified: 10 security tests passing |
| H-P1-8 | Docker MongoDB Runs Without Authentication | COMPLETED | Infrastructure | Added MongoDB root and application user authentication in Docker. Least-privilege app user created by init container. | Verified Docker auth configuration; backend MONGO_URI supports authenticated connection |
| H-P1-9 | Worker → Backend localhost Coupling in Docker | COMPLETED | Worker runtime | Worker now uses BACKEND_INTERNAL_URL with Docker service hostname. Fallback port corrected from 5001 to 5000. URL resolution extracted to a standalone, unit-tested module. | Verified: 13 new tests passing, 75/75 full suite |
| H-P1-10 | Frontend API URL Hardcoded to localhost in Docker Build | COMPLETED | Frontend Docker | Same-origin routing via Next.js rewrites. Browser never references Docker-internal hostnames. | Verified: 8 new tests passing, 83/83 full suite |
| H-P1-11 | No WebSocket Room Authorization | COMPLETED | Socket.IO | Server-side ownership verification for workflow/team war rooms. Token-required, Mongoose-based authorization with explicit forbidden response. | Verified: 8 security tests passing |
| H-P1-12 | a2aSecret Exposed in Team Creation Response | COMPLETED | Agent teams | Secret no longer returned or stored in plaintext. SHA-256 hash stored, timing-safe verification, legacy migration. | Verified: 8 security tests passing, backend tests passing |
| H-P1-13 | Frontend CSP Not Configured | NOT STARTED | Next.js frontend | Express API CSP does not protect frontend HTML/JS. Next.js app needs CSP configured at application layer. | Configure CSP in Next.js/document-serving layer |

### P2 — Medium Priority (NOT STARTED)

| ID | Finding | Status | Affected Area | Description | Recommended Next Phase |
|---|---|---|---|---|---|
| H-P2-1 | No Graceful Worker Shutdown | COMPLETED | Worker runtime | Graceful SIGTERM/SIGINT handling. Shutdown flag stops new claims; current task finishes with a hard cap. Idempotent handlers. | Verified: 11 new tests passing, 94/94 full suite |
| H-P2-2 | Stale Task Recovery Missing | COMPLETED | Worker / Task system | Race-safe atomic per-task recovery. Requeues tasks with attempts < maxAttempts; marks exhausted tasks as failed. Opportunistic sweep inside claimNextTask. | Verified: 18 new tests passing, 112/112 full suite |
| H-P2-3 | No Health Check Endpoint Validation | COMPLETED | Backend | Added /ready dependency check (MongoDB). /health preserved as lightweight liveness. | Verified: 11 new tests passing, 123/123 full suite |
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
- **Status:** ✅ COMPLETED
- **Implementation:** `app.use('/api', globalLimiter)` is now applied once, before all `/api/*` route mounts in `app.js`. The per-route `globalLimiter` applications in `app.js` were removed to prevent double-counting. All `/api/*` routes now inherit the baseline 15-minute / 100-request limit automatically.
- **Tests:** `backend/src/tests/rateLimit.security.test.js` (8 tests)
- **Verification:** 8 security tests passing; existing backend tests remain passing (52 passed, 15 suites).
- **Compatibility:** `authLimiter`, `dashboardLimiter`, `expensiveLimiter`, and `webhookLimiter` continue to apply where intentionally stricter. The internal `/api/internal/broadcast` endpoint continues to be protected by `INTERNAL_AUTH_TOKEN`. `trust proxy` is set to `1`, so `express-rate-limit` uses the first proxy hop for IP detection — correct for the documented reverse-proxy deployment.

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
- **Status:** ✅ COMPLETED
- **Implementation:**
  - `backend/src/services/memoryService.js`: Refactored `retrieveMemory(agent, queryText, userId, topK, minScore)` to require an explicit `userId`. Added `assertAgentOwnership(agent, userId)` which (1) validates that agent and userId are present, (2) compares `agent.userId.toString()` to the request user, and (3) re-verifies ownership with `Agent.findOne({ _id, userId })` so a forged in-memory agent cannot bypass the check. Throws `AGENT_REQUIRED`, `USER_CONTEXT_REQUIRED`, or `FORBIDDEN` to fail closed. Legacy `(agent, query, topK)` call shape is detected (numeric third arg) and rejected as `USER_CONTEXT_REQUIRED`.
  - `backend/src/controllers/agent.controller.js`: `runAgent` now passes `req.user._id` to `retrieveMemory`.
  - `backend/src/agents/handlers/llm.handler.js`: LLM step passes `context?.userId` to `retrieveMemory`.
  - `backend/src/agents/handlers/agentCall.handler.js`: agent_call step passes `context?.userId` to `retrieveMemory`.
  - `backend/src/agents/executor.js`: **unchanged** — existing executor ownership validation remains the first line of defense.
- **Tests:** Added `backend/src/tests/memoryService.handler.test.js` with 10 focused security regression tests covering: legitimate user, cross-user denial, forged-userId denial, nonexistent agent, missing userId, legacy call shape, missing agent, mismatched userId representations, behavior preservation, and write-path independence. Mocks `Agent`, `AgentMemory`, and the embedding adapter.
- **Verification:** New test suite passes 10/10. Full backend suite passes 62/62 (16 suites). No lint errors in changed files. `git diff --check` clean.
- **Remaining risk:** `storeMemory` still relies on the caller having pre-validated the agent. This is acceptable because store is invoked by authenticated internal flows (LLM handler / agent_call handler) that already have ownership context, and storing into a foreign agent would not leak existing data — it would only create new memory. Defending store would require threading userId through every call site with no security benefit (no existing memory to read). If store is ever exposed via a new public endpoint, the same `assertAgentOwnership` helper is available for reuse.

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
- **Status:** ✅ COMPLETED
- **Implementation:**
  - `backend/src/agents/backendHost.js` (new): standalone module exporting `resolveBackendHost(env)` — prefers `BACKEND_INTERNAL_URL`, strips trailing slashes, falls back to `http://localhost:${PORT||5000}`. Keeping it isolated avoids booting Mongo/telemetry/queue when unit-testing the resolution logic.
  - `backend/src/agents/runner.js`: extracted URL resolution to `backendHost.js`; corrected the legacy fallback port from `5001` to `5000` (matching the backend's documented default and the `PORT: 5000` value used by the `backend` service in `docker-compose.yml`).
  - `backend/src/config/env.js`: added `BACKEND_INTERNAL_URL` to the zod schema as optional, with an http(s) format check so a typo cannot silently break broadcasts.
  - `infra/docker-compose.yml`: worker service `environment` block now sets `BACKEND_INTERNAL_URL: http://backend:5000`, so a fresh deploy works without any host-side `.env` configuration.
  - `infra/.env.example`: documented `BACKEND_INTERNAL_URL` with the recommended Docker and local values and a comment explaining why `localhost` is wrong inside the worker container.
  - `backend/.env.example`: documented `BACKEND_INTERNAL_URL` for local-dev users.
- **Tests:** Added `backend/src/tests/runner.handler.test.js` with 13 tests covering: BACKEND_INTERNAL_URL precedence, trailing-slash stripping, whitespace-only fallback, localhost:5000 default, custom PORT, override beats PORT, URL path composition, 5001-regression (asserts the legacy wrong port is no longer used), Docker `backend:5000` resolution, and the env schema's accept/reject behavior for the new variable.
- **Verification:** 13/13 new tests pass. Full backend suite: 17 suites, 75/75 pass. Lint clean for all changed files. `git diff --check` clean (only informational LF/CRLF warnings on the pre-existing mixed-EOL repo).
- **Remaining risk:** If a future contributor overrides `BACKEND_INTERNAL_URL` in the host `.env` to a non-routable value, broadcasts will fail. The runner already logs `❌ Runner socket broadcast error` on failure, but the silent nature of the failure mode (war-room UI not updating) makes monitoring important. The docker-compose `environment:` block is authoritative for the in-Docker worker, so the host `.env` can only break the deployment if someone explicitly sets a bad value.

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
- **Status:** ✅ COMPLETED
- **Architecture decision:** The original recommendation (`NEXT_PUBLIC_API_URL=http://backend:5000`) is unsafe because `NEXT_PUBLIC_*` variables are bundled into browser JavaScript; a remote browser cannot resolve the Docker-internal `backend` hostname. The fix uses **same-origin API routing** instead: the Next.js server (running in the `frontend` container) proxies `/api/*` and `/socket.io/*` to the backend using a server-only `BACKEND_INTERNAL_URL`. The browser only sees relative paths, so it works on any host (Docker Desktop, native Linux, behind nginx, behind a reverse proxy, on a public domain) with no rebuild and no Docker-internal hostname leakage.
- **Implementation:**
  - `frontend/next.config.js`: added a `rewrites()` function that maps `/api/:path*` → `${BACKEND_INTERNAL_URL}/api/:path*` and `/socket.io/:path*` → `${BACKEND_INTERNAL_URL}/socket.io/:path*`. `BACKEND_INTERNAL_URL` is read from `process.env` (server-only) and falls back to `http://localhost:5000` in local dev.
  - `frontend/src/lib/api.ts`: `API_BASE` now defaults to the relative path `/api` when `NEXT_PUBLIC_API_URL` is unset, so the browser hits the Next.js rewrite. Setting `NEXT_PUBLIC_API_URL` to an absolute URL still works for cross-origin deployments with CORS already configured.
  - `frontend/src/app/agent-teams/[id]/chat/page.tsx`: Socket.IO client now connects to `window.location.origin` with `path: '/socket.io'`, so the WebSocket upgrade also flows through the Next.js rewrite.
  - `infra/docker-compose.yml`: removed the `NEXT_PUBLIC_API_URL` build arg from the frontend service. Added `BACKEND_INTERNAL_URL: http://backend:5000` to the frontend service `environment:` block (server-only, never exposed to the browser).
  - `infra/Dockerfile`: replaced the `ARG/ENV NEXT_PUBLIC_API_URL` block with `ARG/ENV BACKEND_INTERNAL_URL` (default `http://backend:5000`). The previous `NEXT_PUBLIC_API_URL` is preserved as a commented-out escape hatch for cross-origin deployments.
  - `infra/.env.example`: documented the same-origin approach, the `BACKEND_INTERNAL_URL` server-only variable, and the optional `NEXT_PUBLIC_API_URL` build-arg escape hatch.
- **Tests:** Added `backend/src/tests/frontendConfig.handler.test.js` with 8 tests that load `frontend/next.config.js` in a sandboxed VM (to avoid module-cache and global-mutation issues) and verify the rewrite contract: Docker `backend:5000` proxy, `/socket.io/*` proxy, localhost fallback, custom override. A second suite exercises the `API_BASE` derivation logic and asserts that the browser-facing URL never contains `backend:5000` or `localhost:5000` by default — the central security/correctness claim.
- **Verification:** 8/8 new tests pass. Full backend suite: 18 suites, 83/83 pass. Lint clean for all changed files. `git diff --check` clean. `next.config.js`, `api.ts`, and the chat page compile cleanly under `next build` (the build error reported in `visual-builder.tsx:820` is **pre-existing on `main`** and unrelated to this change).
- **Remaining risk:** The optional `NEXT_PUBLIC_API_URL` escape hatch, if used, will leak whatever URL the operator sets into the browser bundle. This is documented in `infra/.env.example` and is the same risk profile any cross-origin fetch has. The default Docker path does not use it.

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
- **Status:** ✅ COMPLETED
- **Implementation:**
  - `backend/src/agents/runner.js`: added a shutdown state machine alongside `runWorkerLoop`. Module-level `isShuttingDown` flag (idempotent: `requestShutdown()` returns `true` on first call, `false` thereafter). The flag is checked at the top of every loop iteration so a new task is never claimed once shutdown begins. The current iteration is wrapped in an IIFE whose promise is tracked via `setCurrentTask()`. `waitForCurrentTask()` races that promise against a hard cap (`WORKER_SHUTDOWN_FORCE_EXIT_MS`, default 60 s) and resolves with `true` (clean) or `false` (cap hit). `registerSignalHandlers()` installs `SIGTERM` and `SIGINT` listeners; idempotent via a `signalHandlersRegistered` guard so the API server's accidental co-import of the runner does not cause duplicate handlers. `start()` calls `registerSignalHandlers()` before `runWorkerLoop()` so a signal received during startup is still handled. After the current task finishes (or the cap elapses), the process exits after a 250 ms flush delay.
  - **Interaction with H-P2-2 (out of scope here):** If the current task cannot finish before the hard cap, it is left in `status: 'running'`. The existing `claimNextTask()` stuck-task recovery (15-minute threshold on `startedAt`) will eventually reset it to `pending` for re-claim. Stale-task detection with a shorter threshold, retry semantics, and explicit re-queue on shutdown are tracked separately as **H-P2-2 and are NOT implemented in this change**.
  - **No re-queue on shutdown was added** because the existing `Task` model and `queueService` do not expose a safe "release without completing" operation; introducing one here would expand the scope into H-P2-2 and risk inconsistent state.
- **Tests:** `backend/src/tests/runner.shutdown.handler.test.js` (11 tests):
  1. `isShutdownRequested` defaults to `false`.
  2. `requestShutdown` flips the flag and returns `true` on first call.
  3. `requestShutdown` is idempotent (second/third calls return `false`).
  4. `waitForCurrentTask` resolves immediately when no task is in flight.
  5. `waitForCurrentTask` awaits an in-flight task and resolves when it finishes.
  6. `waitForCurrentTask` applies a hard cap when a task never finishes.
  7. `runWorkerLoop` exits cleanly when shutdown is requested before any claim (no `claimNextTask` call).
  8. `runWorkerLoop` does not claim a new task after shutdown begins.
  9. `registerSignalHandlers` is idempotent (multiple calls do not double-register).
  10. `registerSignalHandlers` installs listeners that call `requestShutdown` when emitted.
  11. The new shutdown helpers are exported.
- **Verification:** 11/11 new tests pass. Full backend suite: 19 suites, 94/94 pass. Lint clean for all changed files. `git diff --check` clean (only the standard LF/CRLF informational warnings on the pre-existing mixed-EOL repo).
- **Operational notes:**
  - `WORKER_SHUTDOWN_GRACE_MS` (currently unused but reserved) and `WORKER_SHUTDOWN_FORCE_EXIT_MS` (default 60 000) are configurable via env.
  - The Docker `worker` service in `infra/docker-compose.yml` already has `restart: unless-stopped`, so a worker that exits cleanly after SIGTERM will be restarted by the orchestrator.
  - The worker Dockerfile does not need a `STOPSIGNAL` directive — Docker's default `SIGTERM` is the correct signal and is now handled.

### H-P2-2: Stale Task Recovery Missing
- **Category:** Reliability
- **Severity:** P2
- **Component:** Worker / Task system
- **File:** `backend/src/agents/runner.js`, `backend/src/agents/queueService.js`
- **Evidence:** `claimNextTask()` claims tasks but there's no mechanism to detect and recover tasks stuck in `running` state (e.g., worker crashed).
- **Impact:** Tasks remain `running` forever after worker crash; never retried.
- **Recommended fix:** Add stale-task detection based on `startedAt` timestamp. Re-queue or fail tasks running longer than threshold.
- **Confidence:** High
- **Status:** ✅ COMPLETED
- **Implementation:**
  - `backend/src/agents/queueService.js`:
    - Removed the previous blanket `updateMany` that reset any `running` task older than 15 minutes to `pending` without regard to attempts or recovery semantics.
    - Added `recoverOneStaleTask(now)`: a two-step atomic recovery primitive. **Step 1** uses `findOneAndUpdate({ status: 'running', startedAt: { $lt: threshold } }, { $set: { metadata.staleSweepAt, metadata.staleSweepStatus: 'in_progress' } }, { sort: { startedAt: 1 }, returnDocument: 'after' }).lean()` to atomically claim a single stale task. **Step 2** uses `findOneAndUpdate({ _id, startedAt: <stale.startedAt> }, ...)` to finalize. The `_id + startedAt` guard in Step 2 means a concurrent recoverer that already finalized the task (and changed `startedAt`) will see `null` returned and abort — this is the race-safety guarantee.
    - If `attempts < maxAttempts`, the task is set to `status: 'pending'`, `startedAt: null`, with a `retryHistory` entry `kind: 'stale_recovery', action: 'requeued'`.
    - If `attempts >= maxAttempts`, the task is set to `status: 'failed'`, `completedAt: now`, `metadata.failureReason: 'stale_recovery_exhausted'`, with a `retryHistory` entry `action: 'failed', reason: 'max_attempts_exhausted'`. No infinite retry loop.
    - Added `recoverStaleTasks({ maxSweep = 25, now })`: bounded sweep that calls `recoverOneStaleTask` repeatedly. Default `maxSweep` is 25 to prevent a backlog after a long outage from creating a thundering herd. Per-iteration try/catch so a transient DB error on one task does not abort the sweep.
    - `claimNextTask` now calls `recoverStaleTasks({ maxSweep: 25 })` before claiming, wrapped in its own try/catch so a recovery failure does not block normal claiming. The next `claimNextTask` call retries the sweep.
    - Configurable via `WORKER_STALE_TASK_TIMEOUT_MS` (default 900 000 ms = 15 min, matching the previous inline value). `WORKER_MAX_ATTEMPTS` continues to control retry semantics.
    - Exported: `recoverStaleTasks`, `recoverOneStaleTask`, `STALE_TASK_TIMEOUT_MS`.
  - `backend/src/agents/runner.js`: **unchanged** — `claimNextTask` is the only call site, and the existing loop already invokes it every poll cycle. H-P2-1 graceful shutdown semantics are preserved unchanged.
- **Race-safety explanation:** each recovery is a two-step atomic update against the same `_id`. Step 1 atomically marks the doc with `metadata.staleSweepAt` so a concurrent recoverer can see it has been picked up. Step 2's `findOneAndUpdate({ _id, startedAt: <captured from step 1> })` is the second atomic gate — if a different process already finalized the task (changing `startedAt`), the filter does not match, `null` is returned, and the late recoverer aborts cleanly. Multiple workers running the sweep concurrently cannot double-recover the same task.
- **Retry / attempt behavior:** preserved from the existing `completeTask` semantics. A stale task with `attempts < maxAttempts` becomes `pending` and the next `claimNextTask` will pick it up; `attempts` is incremented on claim, so a task that has already been re-queued and failed multiple times will eventually be marked `failed` permanently by either the recovery sweep (if it goes stale again) or by `completeTask` (if it fails normally).
- **Tests:** `backend/src/tests/queueService.staleRecovery.handler.test.js` (18 tests):
  1. `recoverOneStaleTask` returns null when no stale running task exists.
  2. A fresh running task (startedAt within threshold) is NOT recovered.
  3. A task with no `startedAt` is NEVER treated as stale.
  4. A stale running task with `attempts < maxAttempts` is requeued to `pending`.
  5. A stale running task with `attempts == maxAttempts` is marked `failed` (exhausted).
  6. A stale running task with `attempts > maxAttempts` is also marked `failed`.
  7. Only the oldest stale task is recovered per call (FIFO via `sort: { startedAt: 1 }`).
  8. `recoverStaleTasks` recovers up to `maxSweep` tasks per call.
  9. `recoverStaleTasks` returns 0 when no stale tasks exist.
  10. `recoverStaleTasks` stops after exhausting the backlog.
  11. Two concurrent `recoverOneStaleTask` calls cannot recover the same task twice (race-safety).
  12. A worker whose task is currently running (fresh `startedAt`) is never re-claimed by another recovery.
  13. `claimNextTask` runs a recovery sweep before claiming a normal pending task.
  14. A recovery sweep error does NOT block normal `claimNextTask` (resilience).
  15. Normal pending claim still works when no stale tasks exist.
  16. Normal retrying claim still works.
  17. An exhausted task (`attempts >= maxAttempts`) is not claimed.
  18. Importing `queueService` does not regress the H-P2-1 runner shutdown state machine.
- **Verification:** 18/18 new tests pass. Full backend suite: 20 suites, 112/112 pass. Lint clean for all changed files. `git diff --check` clean (only the standard LF/CRLF informational warnings on the pre-existing mixed-EOL repo).
- **Remaining risks:**
  - The opportunistic sweep runs on every `claimNextTask` call, so a long backlog after a worker outage takes `Math.ceil(backlog / 25)` poll cycles to drain. The `maxSweep: 25` cap is intentional to bound the work per claim, but operators with very large backlogs may want a separate dedicated recovery cron.
  - `recoverStaleTasks` runs a `for` loop with `await` inside. A pathological DB latency spike (e.g. a primary step-down) could make one `claimNextTask` call take seconds. This is bounded by `maxSweep: 25` and the per-iteration try/catch; the next `claimNextTask` will continue the sweep.
  - The default `WORKER_STALE_TASK_TIMEOUT_MS` of 15 minutes matches the previous inline behavior. For workflows with legitimately long-running steps (e.g. multi-hour batch processing), operators must set this higher. There is no per-task override.
  - H-P2-2 does NOT add a dedicated "stale-task recovery" cron. The recovery is opportunistic (runs when a worker tries to claim). If all workers are down for a long time, no recovery runs — but this is fine because no work is being done anyway, and the moment a worker starts up, the first `claimNextTask` triggers a sweep.

### H-P2-3: No Health Check Endpoint Validation
- **Category:** Reliability
- **Severity:** P2
- **Component:** Backend
- **File:** `backend/src/app.js`, `backend/src/controllers/health.controller.js`
- **Evidence:** `/health` returns `{ ok: true, ts: Date.now() }` without checking MongoDB or any other dependency. Docker healthcheck reports healthy even when MongoDB is down.
- **Impact:** Orchestrators (Docker, Kubernetes) cannot distinguish a running-but-broken backend from a fully-healthy one.
- **Recommended fix:** Split into `/health` (liveness) and `/ready` (readiness with dependency checks).
- **Confidence:** High
- **Status:** ✅ COMPLETED
- **Implementation:**
  - `backend/src/controllers/health.controller.js` (new): two handlers.
    - `getHealth(req, res)`: preserved exact legacy shape `{ ok: true, ts: Date.now() }`. Mounted at `/health`. No dependency checks — suitable as a lightweight liveness probe.
    - `getReady(req, res)`: mounted at `/ready`. Checks `mongoose.connection.readyState`; if connected (1), performs a lightweight `db.admin().ping()` with a 3-second timeout via `Promise.race`. Returns 200 + `{ ok: true, status: 'ready', checks: { database: { status: 'healthy', readyState: 1 } }, timestamp }` when healthy, or 503 + `{ ok: false, status: 'not_ready', checks: { database: { status: 'unhealthy', readyState, message } }, timestamp }` when not.
    - **Worker health is intentionally NOT included in `/ready`**: the current architecture has no worker registration or heartbeat mechanism. The worker is an optional background processor; the backend can serve API traffic without it. Local development often runs the backend without a worker. Adding a worker check here would cause false negatives. If a worker heartbeat is introduced in the future, `/ready` can be extended.
    - **Replica-set validation is NOT performed**: the Docker deployment uses a single-node replica set (`rs0` with one member) for oplog support (document intelligence RAG). A standalone MongoDB would fail replica-set checks but is valid for local development. The readiness check only verifies that the DB is reachable and responding, not its topology.
    - No credentials, connection strings, stack traces, or internal topology details are exposed in responses.
  - `backend/src/app.js`: `/health` and `/ready` are mounted BEFORE the rate limiter and before other routes, so infrastructure probes are never rate-limited and are always accessible without authentication.
  - Docker compose: **unchanged** — the existing backend `healthcheck` already uses `http://localhost:5000/health`, which is the correct liveness probe. A Kubernetes `readinessProbe` can be added separately pointing to `/ready` by operators; it is not hardcoded into compose to avoid changing the existing deployment contract.
- **Tests:** `backend/src/tests/health.handler.test.js` (11 tests):
  1. `/health` returns 200 with `{ ok: true, ts: ... }`.
  2. `/health` does not depend on MongoDB state (disconnected).
  3. `/health` response shape is stable (`ok` + `ts`).
  4. `/ready` returns 200 when MongoDB is connected and pingable.
  5. `/ready` returns 503 when MongoDB is disconnected.
  6. `/ready` returns 503 when MongoDB is connecting.
  7. `/ready` returns 503 when MongoDB ping fails.
  8. `/ready` does not leak raw error messages or stack traces.
  9. `/ready` does not hang indefinitely when ping times out (bounded by 3s timeout).
  10. Worker is intentionally not part of readiness checks.
  11. `/ready` includes timestamp for both ready and not_ready states.
- **Verification:** 11/11 new tests pass. Full backend suite: 21 suites, 123/123 pass. Lint clean for all changed files. `git diff --check` clean (only the standard LF/CRLF informational warnings on the pre-existing mixed-EOL repo).
- **Operational notes:**
  - `/health` is suitable for Docker ` HEALTHCHECK` and Kubernetes `livenessProbe`.
  - `/ready` is suitable for Kubernetes `readinessProbe` (returns 200 only when DB is reachable).
  - The 3-second ping timeout prevents `/ready` from hanging if MongoDB is slow or partitioned.
  - `HEALTH_CHECK_TIMEOUT_MS` is hardcoded to 3000 ms; it is not configurable via env because health checks should be fast and bounded by the caller's own timeout.

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
