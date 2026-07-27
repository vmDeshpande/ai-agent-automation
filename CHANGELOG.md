# Changelog

All notable changes to this project will be documented in this file.

## v0.11.0

### Added
- Agent Teams with visual team builder, war room chat, session logs, capability discovery, and A2A webhook support.
- Workflow API endpoints with per-user API key management, optional bearer authentication, custom endpoint names, and synchronous or asynchronous invocation.
- AI workflow generation from natural language with schema normalization and graph validation.
- Schema-driven workflow node definitions and dynamic builder fields for core, logic, integration, and tool nodes.
- Parallel, join, approval, and agent call workflow nodes.
- Partial workflow execution, rerun-from-failed-step, resumable task execution, and human approval controls.
- Agent playground for testing agents directly from the UI.
- Multi-document document chat with selectable documents, source attribution, grouped sources, and source-aware retrieval.
- Workflow Insights UI with global and per-workflow analytics views.
- Live dashboard status, execution trend charts, real workflow KPIs, and system health indicators.
- Postman collection and environment files for API testing.

### Improved
- Refactored workflow execution into isolated step handlers with shared result, interpolation, error, and file-resolution utilities.
- Added structured workflow context for step output mapping and workflow variables.
- Added retry policies, exponential backoff, trace IDs, step-level telemetry, and cleaner runner lifecycle logging.
- Added MongoDB-backed distributed locks and semaphores for safer parallel and join-node execution across workers.
- Added pluggable document retrieval strategy infrastructure with hybrid retrieval, document analysis metadata, manual strategy override, and bounded chunk scoring.
- Improved document upload progress, processing fail-safes, scalable RAG retrieval, and multi-provider playground execution.
- Reworked the application shell, sidebar navigation, shared layout primitives, status badges, skeleton states, and empty states.
- Improved workflow details with execution history, timeline, step logs, variables, metadata, replay, and API settings panels.
- Improved tasks, schedules, documents, memory, logs, agents, and settings pages for responsiveness, accessibility, and error states.
- Registered GitHub, Slack, Discord, browser, email, file, Hacker News, and sandboxed tools through the dynamic tool registry contract.

### Fixed
- Fixed generated workflow step normalization so AI-generated workflows match builder and executor expectations.
- Fixed template import warnings, visual builder template compatibility, missing builder state, and deterministic node placement.
- Fixed failed-step replay to preserve successful step results and resume from the correct failed step.
- Fixed condition boolean evaluation to avoid unsafe substring matching.
- Fixed HTTP request handling so GET and HEAD requests do not send a request body.
- Fixed sandbox worker argument handling and interpolation for sandboxed file tool execution.
- Fixed file tool action handling to avoid silent overwrites and support file path listing more gracefully.
- Fixed document chat hydration, document upload endpoint handling, logs fetch failures, and memory page network failures.
- Fixed dashboard polling, live workflow status loading states, client-timezone trend grouping, and pending workflow status filtering.
- Fixed environment variable inconsistencies for email handlers and sandboxed tools.

### Security
- Added Helmet middleware for HTTP security headers.
- Added rate limiting for expensive workflow generation, workflow execution, dashboard, and public API paths.
- Added stronger workflow, webhook, replay, task, and insights ownership checks.
- Added bcrypt-hashed API keys that are only revealed once at creation.
- Added auth input validation for registration and login.
- Added CodeQL static analysis workflow.

### Documentation
- Added A2A protocol documentation.
- Added workflow variables documentation.
- Added privacy documentation and an in-app privacy page.
- Added Postman API documentation.
- Added repository agent instructions and local skill documentation for accessibility, Core Web Vitals, Docker, Vercel deployment, and GitHub Actions.

### Developer Experience
- Added broad backend handler, retrieval, lock manager, workflow API, replay, and workflow generation tests.
- Added Next.js documentation installation helper for repo-local docs.
- Added root lint and format scripts with frontend/backend scoped variants, Husky, lint-staged, Prettier, ESLint, and commitlint configuration.

## v0.10.0 - Workflow Intelligence, Stability & Developer Experience

### Added
- Added real-time workflow search for faster filtering across large workflow collections.
- Added dashboard workflow status filters for quickly separating active and inactive workflows.
- Added inline workflow name editing from the dashboard.
- Added workflow export as JSON for backups, migration, sharing, and version control.
- Added documentation for custom tool development.

### Improved
- Introduced stronger TypeScript workflow models for better workflow builder type safety.
- Improved workflow builder responsiveness, spacing, overflow handling, and mobile interactions.
- Improved documentation for architecture changes, workflow capabilities, development practices, and contribution guidance.

### Fixed
- Fixed execution logs so active workflow runs refresh more reliably.
- Fixed touch-device drag and drop for workflow step reordering.
- Fixed workflow dashboard loading failures caused by missing components, invalid dropdown markup, and inconsistent loading states.
- Fixed node connection rendering overlap on smaller screens.

### Security
- Hardened task creation authorization so tasks cannot be associated with workflows owned by other users.
- Fixed document retrieval authorization issues to improve user isolation.

### Developer Experience
- Integrated ESLint and Prettier for more consistent formatting and contributor workflows.

## v0.9.1 - Security Update

### Security
- Fixed workflow file path traversal in file workflow steps.
- Fixed memory API authorization so users cannot access other users' memory data.

### Credits
- Credited `@chaitanyagarware` for responsible disclosure and patch contributions.

## v0.9.0 - Platform Maturity & Integrations

### Added
- Added native workflow integration templates for GitHub, Slack, and Discord.
- Added one-click workflow ID copy actions on workflow cards.
- Added production-ready Docker Compose deployment for self-hosting.
- Introduced optional privacy-focused telemetry with anonymous usage metrics.

### Improved
- Improved onboarding for common automation workflows.
- Added consistent dashboard empty states and clearer guidance for new users.
- Improved workflow graph stability and node management in the builder.

### Fixed
- Fixed duplicate workflow node ID generation issues that could cause graph conflicts.

## v0.8.0 - Privacy-Preserving Telemetry & Platform Stability Update

### Added
- Added an optional anonymous telemetry system for instance activity and version adoption.
- Added an isolated telemetry collector service for anonymous heartbeat ingestion, active instance tracking, version metrics, and feature usage statistics.
- Added local anonymous instance tracking with lightweight platform, OS, enabled-feature, and heartbeat metadata.
- Added environment controls to disable telemetry with `TELEMETRY_ENABLED=false` or `DISABLE_ALL_ANALYTICS=true`.
- Added local analytics visibility for workflow execution counts, step type usage, heartbeat timestamps, and telemetry state stored in MongoDB.

### Improved
- Established privacy guarantees that telemetry does not collect prompts, workflow definitions, memories, uploaded documents, API keys, execution logs, or user identities.
- Improved telemetry configuration handling, settings persistence, frontend telemetry UI, environment variable handling, backend cleanup, and deployment compatibility.

## v0.7.0 - Intelligent Workflow Branching

### Added
- Added switch nodes for routing workflows based on step output values.
- Added condition nodes for true/false, sentiment-based, and content-based branching.
- Added edge-driven branching so connections define execution paths and support multi-step, multi-outcome flows.

### Improved
- Improved visual builder branch clarity with live edge-based case visualization and better node previews.
- Refactored execution around executor and runner separation.
- Removed legacy `step.cases` routing in favor of edge-driven execution.
- Improved normalization for more reliable case matching.

### Fixed
- Fixed switch nodes not executing the correct branch.
- Fixed routing inconsistencies and improved execution-flow stability.

## v0.6.0 - Visual Workflow Builder & Template System

### Added
- Added the first node-based visual workflow builder.
- Added draggable workflow step nodes, visual step connections, node deletion, connection removal, and graph-based ordering.
- Added workflow template import and export.
- Added starter templates for common automation tasks.

### Improved
- Improved visual builder UI, node styling, settings-panel layout, and connection handling.
- Kept graph builder state synchronized with the standard workflow builder.
- Updated node labels dynamically when step settings change.

### Fixed
- Fixed workflow ordering inconsistencies after reconnecting nodes.
- Prevented duplicate step connections.
- Improved edge deletion behavior.

## v0.5.1 - Memory Management UI

### Added
- Added a Memory page for viewing stored agent memories.
- Added memory search, delete actions, and memory inspection.
- Added conversation previews for stored memory interactions.
- Added metadata views for agent, workflow, task, memory type, and creation timestamp.
- Added embedding details for provider, model, and vector size.
- Added raw JSON memory object viewing for debugging.

### Improved
- Improved observability and debugging for the semantic memory system introduced in `v0.4.0`.
- Improved the UI for inspecting embeddings and memory metadata.

### Notes
- This release did not change memory storage or retrieval behavior.

## v0.5.0 - Document Intelligence System

### Added
- Added document uploads for PDF, TXT, Markdown, CSV, and JSON files.
- Added RAG-based document chat with vector retrieval and configurable LLM providers.
- Added a ChatGPT-style document chat interface with Markdown rendering.
- Added document chat settings for provider, model override, Top-K retrieval, and temperature.
- Added document listing, deletion, metadata tracking, and chunk indexing.

### Improved
- Improved system settings architecture for document chat configuration.
- Improved RAG reliability, prompt structure for document extraction, and UI consistency across pages.

### Technical
- Added vector-based document retrieval, chunking, embeddings, multi-provider LLM support, and dynamic model configuration through settings.

## v0.4.0 - Agent Semantic Memory Engine

### Added
- Added persistent embedding-based semantic memory for agents.
- Added agent-scoped memory stored in MongoDB and retrieved with cosine similarity.
- Added opt-in memory controls per LLM workflow step with configurable `useMemory` and `memoryTopK`.
- Added vendor-agnostic embedding routing across OpenAI, Gemini, Hugging Face, and Ollama, with fallback behavior when the LLM provider does not support embeddings.

### Improved
- Added structured memory storage for user and assistant interactions.
- Added similarity thresholds, prompt grounding, memory caps, oldest-entry pruning, and character limits for injected memory.
- Separated LLM execution from the embedding layer.

## v0.3.0 - Full Tool Integration & Workflow Engine Improvements

### Added
- Added full workflow tool support for email, file operations, and browser automation.
- Added end-to-end tool configuration, persistence, worker execution, and step-history result storage.

### Improved
- Improved browser evaluate execution by wrapping user code before running it.
- Improved file writing by serializing objects correctly during interpolation.
- Improved `{{last}}` chaining, structured execution context preservation, and runtime data propagation between steps.
- Improved frontend and backend alignment for workflow step types and persisted tool configuration.

### Fixed
- Fixed browser evaluate `Illegal return statement` failures.
- Fixed `[object Object]` output in file writes.
- Fixed builder and executor step type mismatches.
- Fixed workflow builder reload behavior for browser, file, and email tool steps.

## v0.2.0 - Multi-Provider Agent Execution

### Added
- Added strict workflow execution with each assigned agent's configured provider and model.
- Added support for local models using Ollama via `OLLAMA_HOST`.
- Added runtime logging to verify the provider and model used during execution.

### Improved
- Improved environment configuration documentation.
- Cleaned up the multi-provider architecture.
- Improved execution visibility in logs.
- Improved consistency between workflow, agent, and task execution.

### Fixed
- Fixed workflows defaulting to the wrong provider.
- Fixed incorrect model routing during LLM execution.
- Fixed Assistant disabled-by-default behavior that could keep the frontend offline.
- Fixed step name resolution to use `metadata.steps` instead of falling back to raw step IDs.
