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

## 🏗 Project Structure

```text
backend/     → API, agents, workflow engine, scheduler
frontend/    → Next.js dashboard UI
infra/       → Docker / infra configs
scripts/     → Dev & utility scripts
workflows/   → Example workflow definitions
```

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

### ❌ Please Avoid

* Breaking API contracts without discussion
* Adding paid APIs without local / free fallback
* Committing secrets or credentials
* Large refactors without an issue first

---

## 🧵 Commit Style

Use clear, intentional commits:

```text
feat: add http agent tool
fix: prevent scheduler double execution
docs: improve workflow examples
refactor: split executor logic
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
