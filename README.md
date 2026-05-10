<h1 align="center">⚡ AI Agent Automation</h1>

<p align="center">
  <strong>Open-source, local-first workflow execution engine for AI agents</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-green.svg" /></a>
  <img src="https://img.shields.io/badge/status-active-success" />
  <img src="https://img.shields.io/badge/execution-deterministic-blue" />
  <img src="https://img.shields.io/badge/local--first-yes-important" /> <br />
  <img src="https://img.shields.io/github/last-commit/vmDeshpande/ai-agent-automation" />
<img src="https://img.shields.io/github/commit-activity/m/vmDeshpande/ai-agent-automation" />
<img src="https://img.shields.io/github/stars/vmDeshpande/ai-agent-automation?style=social" />
</p>

<p align="center">
  <a href="https://vmdeshpande.github.io/ai-automation-platform-website/docs">Documentation</a> ·
  <a href="https://vmdeshpande.github.io/ai-automation-platform-website/features/">Features</a> ·
  <a href="https://vmdeshpande.github.io/ai-automation-platform-website/architecture/">Architecture</a> ·
  <a href="https://github.com/vmDeshpande/ai-agent-automation/issues">Issues</a><br><br>
</p>

---

> [!TIP]
> ⭐ Starring this repo helps more developers discover **AI Agent Automation**
>
> ![AI Agent Automation Demo](repo.gif)

---

## Star History

<a href="https://www.star-history.com/?repos=vmdeshpande%2Fai-agent-automation&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=vmdeshpande/ai-agent-automation&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=vmdeshpande/ai-agent-automation&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=vmdeshpande/ai-agent-automation&type=date&legend=top-left" />
 </picture>
</a>

---

## ⚙️ How It Works

1. You create a **Workflow** made of ordered steps (**LLM**, **HTTP**, **Tool**, **Delay**)
2. Running a workflow creates a **Task** (manual or scheduled)
3. An **Agent** executes each step **deterministically**
4. Every step produces:
   - input
   - output
   - success / failure

5. You inspect, debug, re-run, and automate with **full visibility**

---

## 🧠 What This Project Is

**AI Agent Automation Platform** is a **developer-first execution engine** for AI-driven workflows.

This is **not**:

- A prompt playground
- A chatbot UI demo
- A SaaS-locked automation tool

This **is**:

- A real workflow engine
- Deterministic, step-by-step execution
- Agent-driven automation
- Fully local & self-hosted

If you like tools such as **n8n**, **Zapier**, or **Temporal** — but want something **AI-native**, **local**, and **inspectable**, this project is for you.

---

## 👤 Who This Is For

✔ Developers building AI-driven automation
✔ Teams needing inspectable, debuggable execution
✔ Privacy-conscious & self-hosted setups

❌ Chatbot-only demos
❌ Prompt-only experiments
❌ No-code SaaS users

---

## ✨ Core Capabilities

### 🤖 Agent-Driven Execution

- Autonomous AI agents execute workflows
- Pluggable LLM support (OpenAI, Gemini, Groq, local models)
- Deterministic execution model
- Explicit inputs & outputs per step
- Step-level success / failure tracking

---

### 🔗 Workflow Automation

- Visual workflow builder
- Ordered, sequential steps
- Supported step types:
  - **LLM** — reasoning & generation
  - **HTTP** — API calls
  - **Tool** — internal actions
  - **Delay** — time-based control

Each workflow run becomes a **Task** with full traceability.

---

### ⏱ Scheduling (Cron Automation)

- Cron-based schedules
- Automatic task creation
- Ideal for:
  - Monitoring
  - Reports
  - Background automation
  - Periodic data sync

---

### 📊 Observability & Debugging

- Task execution timeline
- Step-level outputs & errors
- Real-time system logs
- Clear failure attribution
- Built for **root-cause analysis**, not guesswork

---

### 🧠 Agent Semantic Memory

- Persistent, agent-scoped semantic memory
- Embedding-based retrieval using cosine similarity
- Similarity threshold filtering to prevent noise
- Retention cap per agent
- Token-safe prompt injection
- Fully vendor-agnostic (no external vector DB required)

Enables agents to recall relevant past interactions across workflow executions.

---

## 🏗 High-Level Architecture (Simplified)

```
Frontend (Next.js)
      ↓
REST API (Express)
      ↓
Workflow Engine
  ├─ Agent Runner
  ├─ Step Executor
  ├─ Tool Registry
  ├─ Scheduler
  └─ Logger
      ↓
MongoDB (Workflows, Tasks, Agents, Logs)
```

> 📘 Detailed architecture, execution model, and internals:
> [https://vmdeshpande.github.io/ai-automation-platform-website/](https://vmdeshpande.github.io/ai-automation-platform-website/)

---

## 🛠 Tech Stack

**Backend**

- Node.js + Express
- MongoDB
- Cron Scheduler
- Custom Agent Runtime

**Frontend**

- Next.js
- React
- Tailwind CSS

**AI & Automation**

- Pluggable LLM adapters
- Tool sandboxing
- Local-first execution

---

## 🧪 Common Use Cases

- AI workflow automation
- Scheduled backend jobs
- Monitoring & alerting agents
- Document processing pipelines
- Internal developer tools
- Secure AI experimentation

---

## 🔐 Security & Privacy

- Fully self-hosted
- No data leaves your system by default
- Secrets via environment variables only
- No vendor lock-in
- No hidden SaaS dependencies
- Memory stored locally in MongoDB
- No external vector database required

---

## 🚀 Local Development

### 1️⃣ Clone

```bash
git clone https://github.com/vmDeshpande/ai-agent-automation.git
cd ai-agent-automation
```

### 2️⃣ Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
npm run worker
```

Backend → `http://localhost:5000`

### 3️⃣ Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend → `http://localhost:3000`

---

## 🐳 Docker Deployment

Run the entire platform (MongoDB, backend API, worker, and frontend) using Docker.

---

### Prerequisites

- Docker Desktop: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
- Docker Compose (included with Docker Desktop)

Verify installation:

```bash
docker --version
docker compose version
```

---

### 🚀 Quick Start

```bash
cd infra

# Copy environment configuration
cp .env.example .env

# Edit .env (at minimum set JWT_SECRET)
# Port overrides are optional; safe defaults are already provided

# Build and start all services
docker compose up --build
```

After startup open:

```
http://localhost:3000
```

If `3000`, `5000`, or `27017` are already in use on your machine, change `FRONTEND_PORT`, `BACKEND_PORT`, or `MONGO_PORT` in `infra/.env` before starting.

---

### 🧩 Services

| Service     | URL                                            | Description            |
| ----------- | ---------------------------------------------- | ---------------------- |
| Frontend    | [http://localhost:3000](http://localhost:3000) | Next.js web interface (default, configurable) |
| Backend API | [http://localhost:5000](http://localhost:5000) | Express API server (default, configurable) |
| MongoDB     | localhost:27017                                | Database (default, configurable) |
| Worker      | internal                                       | Executes workflow jobs |

Startup order:

```
MongoDB
↓
Mongo Replica Init
↓
Backend API
↓
Worker
↓
Frontend
```

MongoDB replica sets are initialized automatically during startup.

---

### ⚙ Configuration

Edit the environment file:

```
infra/.env
```

Example configuration:

```bash
MONGO_URI=mongodb://mongo:27017/ai-agent
JWT_SECRET=your-secure-random-string

# LLM Providers
GROQ_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
HF_API_KEY=

# Optional local models
OLLAMA_HOST=http://host.docker.internal:11434

# Optional host port overrides (defaults shown)
MONGO_PORT=27017
BACKEND_PORT=5000
FRONTEND_PORT=3000
```

These port variables are optional. If you leave them unchanged, Docker Compose uses the default ports shown above. The frontend API URL is derived automatically from `BACKEND_PORT`.

You do not need to set `NEXT_PUBLIC_API_URL` in `infra/.env` for Docker deployments.

---

### 🛠 Common Commands

### Start services

```bash
docker compose up -d
```

### View logs

```bash
docker compose logs -f
```

### Stop services

```bash
docker compose down
```

### Rebuild after code changes

```bash
docker compose up --build
```

### Stop and remove containers + volumes

```bash
docker compose down -v
```

---

### Troubleshooting

If a default port is already in use:

```bash
# infra/.env
MONGO_PORT=27018
BACKEND_PORT=5001
FRONTEND_PORT=3001
```

The frontend API URL is derived automatically from `BACKEND_PORT`, so you do not need to set `NEXT_PUBLIC_API_URL` for Docker deployments.

If Docker reports the backend as unhealthy right after startup:

```bash
docker compose logs -f backend mongo mongo-init-replica
```

If MongoDB was previously started with an old replica set configuration, do a clean local reset:

```bash
docker compose down -v
docker compose up -d --build
```

This removes the local Mongo volume and recreates the replica set from scratch.

If you want to confirm the stack is healthy after startup:

```bash
docker compose ps
docker compose logs --tail 50 backend worker
```

---

### 🌐 Using With Existing Nginx

If you already run an nginx reverse proxy:

```
/api  → http://localhost:5000
/     → http://localhost:3000
```

If you override `BACKEND_PORT` or `FRONTEND_PORT` in `infra/.env`, update these proxy targets to match.

---

### 💡 Tip

For development you usually only need:

```bash
docker compose up
```

Docker will automatically build images and start all services.

## 📂 Repository Structure

```
backend/
  ├─ agents/
  ├─ models/
  ├─ routes/
  ├─ services/
  ├─ tools/
  └─ workers/

frontend/
  ├─ app/
  ├─ components/
  ├─ context/
  └─ styles/
```

---

## 🛣 Roadmap

Planned features and long-term vision live on the project website:

👉 [https://vmdeshpande.github.io/ai-automation-platform-website/](https://vmdeshpande.github.io/ai-automation-platform-website/)

---

## 🤝 Contributing

Contributions are welcome.

If you enjoy:

- AI agents
- Backend systems
- Automation engines
- Developer tooling

You’ll feel at home here.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📄 License

Apache License 2.0

---

> **Not a prompt playground.** > **A real AI execution engine.**
## ❓ Frequently Asked Questions (FAQ)

### General

**Q: What is AI Agent Automation?**

A: AI Agent Automation is a developer-first, local-first workflow execution engine for AI agents. It provides deterministic, step-by-step execution with full visibility and debuggability. Unlike prompt playgrounds or chatbot demos, this is a real workflow engine built for production AI automation.

**Q: How does this differ from n8n, Zapier, or Temporal?**

A: AI Agent Automation is AI-native and local-first. While n8n/Zapier are general automation platforms (often SaaS-locked), and Temporal is a workflow orchestration engine, AI Agent Automation focuses specifically on AI agent-driven workflows with deterministic execution, step-level observability, and no external dependencies.

**Q: Who is this project for?**

A: This project is designed for:
- Developers building AI-driven automation
- Teams needing inspectable, debuggable execution
- Privacy-conscious and self-hosted setups

It's **not** for chatbot-only demos, prompt-only experiments, or no-code SaaS users.

### Installation & Setup

**Q: What are the prerequisites?**

A: You need:
- Node.js (v18+)
- MongoDB
- Docker Desktop (for containerized deployment)
- LLM API keys (optional: OpenAI, Gemini, Groq, or local Ollama)

**Q: How do I run it locally?**

A: For local development:
```bash
# Backend
cd backend && npm install && npm run dev && npm run worker

# Frontend
cd frontend && npm install && npm run dev
```

For Docker deployment:
```bash
cd infra
cp .env.example .env
docker compose up --build
```

**Q: What ports does the platform use?**

A: Default ports:
- Frontend: `3000`
- Backend API: `5000`
- MongoDB: `27017`

You can override these in `infra/.env` if they conflict with existing services.

### LLM Providers

**Q: Which LLM providers are supported?**

A: Supported providers:
- OpenAI
- Gemini
- Groq
- Hugging Face
- Ollama (local models)

Configure API keys in `infra/.env` or backend `.env`.

**Q: Can I use local models?**

A: Yes! Set `OLLAMA_HOST=http://host.docker.internal:11434` (or your Ollama endpoint) to use local models. No external API calls required.

### Workflows & Tasks

**Q: What is a Workflow?**

A: A Workflow is a sequence of ordered steps. Supported step types:
- **LLM** — reasoning and generation
- **HTTP** — API calls
- **Tool** — internal actions
- **Delay** — time-based control

Each workflow run creates a **Task** with full traceability.

**Q: What is a Task?**

A: A Task is a single execution of a Workflow. Tasks can be:
- Manual (triggered by user)
- Scheduled (via cron)
- Automatically created by the scheduler

Each Task shows step-level inputs, outputs, and success/failure status.

**Q: How does scheduling work?**

A: Use cron-based schedules for:
- Monitoring
- Reports
- Background automation
- Periodic data sync

The scheduler automatically creates Tasks based on your cron configuration.

### Memory & Observability

**Q: What is Agent Semantic Memory?**

A: Agents have persistent, agent-scoped semantic memory:
- Embedding-based retrieval using cosine similarity
- Similarity threshold filtering to prevent noise
- Retention cap per agent
- Token-safe prompt injection
- No external vector DB required (stored in MongoDB)

**Q: How do I debug a failed Task?**

A: Check the observability features:
- Task execution timeline
- Step-level outputs and errors
- Real-time system logs
- Clear failure attribution

Built for root-cause analysis, not guesswork.

### Deployment & Security

**Q: Is this self-hosted?**

A: Yes! Fully self-hosted with:
- No data leaving your system by default
- Secrets via environment variables only
- No vendor lock-in
- No hidden SaaS dependencies
- Local MongoDB storage

**Q: Can I deploy behind nginx?**

A: Yes. Configure nginx to proxy:
```
/api  → http://localhost:5000
/     → http://localhost:3000
```

Adjust ports if you override `BACKEND_PORT` or `FRONTEND_PORT`.

### Troubleshooting

**Q: Port already in use?**

A: Override in `infra/.env`:
```bash
MONGO_PORT=27018
BACKEND_PORT=5001
FRONTEND_PORT=3001
```

**Q: Backend unhealthy after startup?**

A: Check logs:
```bash
docker compose logs -f backend mongo mongo-init-replica
```

If MongoDB has old replica set config, reset:
```bash
docker compose down -v
docker compose up -d --build
```

**Q: Where can I get help?**

A: Resources:
- [Documentation](https://vmdeshpande.github.io/ai-automation-platform-website/docs)
- [Architecture Guide](https://vmdeshpande.github.io/ai-automation-platform-website/architecture/)
- [GitHub Issues](https://github.com/vmDeshpande/ai-agent-automation/issues)