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

---

## Remaining Hardening Work

P0 completion does not mean the platform is fully production-hardened. Remaining work is tracked in `hardening_plan.md` and is organized as follows:

### P1 — High Priority (12 items)

- Broad CORS on API (partially addressed by P0-2; API CORS now restricted)
- Missing CSP/HSTS in Helmet
- No schema validation on all API inputs
- Document upload lacks size/MIME enforcement
- Webhook public endpoint lacks payload size limit
- Incomplete rate limiting
- Agent memory cross-user risk
- Docker MongoDB runs without authentication
- Worker → Backend localhost coupling in Docker
- Frontend API URL hardcoded to localhost in Docker
- No WebSocket room authorization
- a2aSecret exposed in team creation response

### P2 — Medium Priority (10 items)

- No graceful worker shutdown
- Stale task recovery missing
- Health check endpoint validation incomplete
- Dashboard queries hit MongoDB directly
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
