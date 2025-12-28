# Contributing to AI Agent Automation

First of all — thank you for your interest in contributing!
This project is an experimental but production-grade **AI workflow automation system** designed for extensibility, clarity, and safety.

We welcome thoughtful contributions.

---

## 🧠 Project Philosophy

* **Explicit over magic** — workflows should be readable
* **Deterministic execution** — no hidden agent behavior
* **Secure by default** — no secret leakage, no unsafe execution
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

### Worker (Required for execution)

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

* Never commit `.env`
* Always update `.env.example` when adding new variables
* All secrets must be injected via environment variables

---

## 🧪 Feature Stability

| Feature            | Status          |
| ------------------ | --------------- |
| Workflow Engine    | ✅ Stable        |
| Scheduler          | ✅ Stable        |
| Document Chat      | ✅ Stable        |
| Browser Automation | ⚠️ Experimental |
| Agent Memory       | 🚧 In Progress  |

---

## 🧩 Contribution Guidelines

### ✅ Good Contributions

* Bug fixes with clear reasoning
* Performance improvements
* New agent tools (sandboxed)
* UI/UX improvements
* Documentation improvements

### ❌ Avoid

* Breaking API contracts without discussion
* Adding paid APIs without fallback
* Committing secrets or credentials
* Large refactors without an issue first

---

## 🧵 Commit Style

Use clear, intentional commits:

```text
feat: add http agent tool
fix: prevent scheduler double execution
refactor: split executor logic
docs: improve workflow examples
```

---

## 🔍 Pull Requests

1. Fork the repo
2. Create a feature branch
3. Make focused changes
4. Open a PR with:

   * What changed
   * Why it matters
   * Any trade-offs

---

## 🛡 Security

If you discover a security issue:

* **Do not open a public issue**
* Contact me directly

---

## 💬 Questions & Ideas

Feel free to open an issue for:

* Design discussions
* Architecture questions
* Feature proposals

Thoughtful discussion is welcome.

---

Thanks for helping improve this system 🚀
