# Contributing to AI Agent Automation

Thanks for your interest in contributing to **AI Agent Automation**.
This project aims to be a **clear, deterministic, and production-oriented AI workflow engine**. Contributions that respect these goals are very welcome.

---

## 🧠 Project Philosophy

* **Explicit over magic** — workflows should be easy to read and reason about
* **Deterministic execution** — no hidden agent behavior
* **Secure by default** — no secret leakage, sandboxed execution
* **Composable systems** — small tools, powerful pipelines

---

## 🏗 Codebase Architecture Overview

The repository is structured as a monorepo containing distinct services that communicate over REST and MongoDB:

* **`backend/`**: Node.js/Express service housing the core Workflow Engine, Agent Runner, and API routes.
* **`frontend/`**: Next.js application providing the visual dashboard, workflow builder, and memory management UI.
* **`infra/`**: Docker Compose configurations to spin up the entire stack locally.
* **`scripts/`**: Utility scripts for database migrations, telemetry testing, and environment setup.
* **`workflows/`**: Seed data and example JSON definitions for testing the execution engine.

---

## 🚀 Running Locally

### Prerequisites

* Node.js 18+
* MongoDB (local or Atlas)
* npm or pnpm

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Worker (required for execution)

```bash
npm run worker
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Docker Workflow

```bash
cd infra
cp .env.example .env
docker compose up --build
```

---

## 🔄 Common Development Workflows

* **Testing a New Tool:** Add tool logic in `backend/tools/`, register it in the Tool Registry, and create a test workflow in `workflows/` to execute it locally.
* **UI Component Development:** Start only the `frontend/` process and mock API responses, or run the full Docker stack to interact with live agent executions.
* **Agent Prompt Tuning:** Modify system prompts in `backend/agents/` and use the UI to trigger standard benchmark workflows.

---

## 🔐 Environment Variables

* Never commit `.env` files
* Always update `.env.example` when adding new variables
* All secrets must come from environment variables

---

## 🧪 Feature Stability

| Feature         | Status         |
| --------------- | -------------- |
| Workflow Engine | ✅ Stable       |
| Scheduler       | ✅ Stable       |
| UI Dashboard    | ✅ Stable       |
| Agent Memory    | 🚧 In Progress |

---

## 🧩 Contribution Guidelines

### ✅ Good Contributions

* Bug fixes with clear reasoning
* Performance improvements
* New agent tools (sandboxed)
* UI/UX improvements
* Documentation improvements

### ➕ Adding New Features

To add a new custom tool to the platform, follow the step-by-step guide:
👉 [How to Add a Custom Tool](docs/how-to-add-custom-tool.md)

### ❌ Please Avoid

* Breaking API contracts without discussion
* Adding paid APIs without local / free fallback
* Committing secrets or credentials
* Large refactors without an issue first

---

## 🧵 Commit Style

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via **Husky + commitlint**. Invalid messages are rejected at commit time.

### Structure

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

- **type** — required, lowercase
- **scope** — optional, lowercase, describes affected area
- **subject** — required, lowercase, no trailing period, max 100 chars total

### Allowed Types

| Type       | When to use                                      |
|------------|--------------------------------------------------|
| `feat`     | New feature                                      |
| `fix`      | Bug fix                                          |
| `docs`     | Documentation only                               |
| `style`    | Formatting, missing semicolons (no logic change) |
| `refactor` | Code change that is neither feat nor fix         |
| `perf`     | Performance improvement                          |
| `test`     | Adding or updating tests                         |
| `build`    | Build system or external dependency changes      |
| `ci`       | CI/CD configuration                              |
| `chore`    | Maintenance tasks (e.g. husky, lint config)      |
| `revert`   | Reverts a previous commit                        |

### ✅ Good Examples

```
feat(agent): add retry logic for failed tool calls
fix(scheduler): prevent double execution on cron overlap
docs: improve workflow step examples
refactor(executor): split step runner into separate modules
chore: update husky to v9
perf(memory): reduce embedding lookup latency
```

### ❌ Bad Examples

```
# Missing type
Updated the agent tool

# Type not lowercase
Fix: resolve crash on startup

# Subject starts with capital letter
feat: Add http agent tool

# Subject ends with period
fix(scheduler): prevent double execution.

# Vague subject
fix: stuff

# Type not in allowed list
update: refresh dependencies
```

### Breaking Changes

Add `!` after the type/scope:

```
feat(api)!: remove deprecated /v1/workflows endpoint
```

---

## 🔍 Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make focused changes
4. Open a PR explaining:

   * What changed
   * Why it matters
   * Any trade-offs

---

## 🛡 Security

If you discover a security issue:

* **Do not open a public issue**
* Contact the maintainer directly

---

## 💬 Questions & Ideas

Feel free to open an issue for:

* Design discussions
* Architecture questions
* Feature proposals

Thoughtful discussion is encouraged.

---

Thanks for helping improve this project 🚀
