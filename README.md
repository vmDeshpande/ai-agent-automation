# ⚡ AI Agent Automation

**Open-source, local-first workflow engine for AI agents**

Build, run, schedule, and debug multi-step AI agent workflows  
with **full observability** and **zero vendor lock-in**.


---

> [!TIP]
> ⭐ Starring this repo helps more developers discover **AI Agent Automation**
>
> ![AI Agent Automation Demo](repo.gif)

---

## 🧠 What This Project Is

**AI Agent Automation Platform** is a **production-oriented execution engine** for AI-driven workflows.

This is **not**:

* A prompt playground
* A chat UI demo
* A SaaS-locked automation tool

This **is**:

* A real workflow engine
* Deterministic step execution
* Agent-driven automation
* Fully local & self-hosted

If you like tools such as **n8n**, **Zapier**, or **Temporal** — but want **AI-native, local, and inspectable execution**, this project is for you.

---

## ✨ Core Capabilities

### 🤖 Agent-Driven Execution

* Autonomous AI agents execute workflows
* Pluggable LLM support (OpenAI, Gemini, Groq, local models)
* Deterministic, step-by-step execution
* Explicit inputs & outputs per step
* Step-level success / failure tracking

---

### 🔗 Workflow Automation

* Visual workflow builder
* Ordered, sequential steps
* Supported step types:

  * **LLM** (reasoning & generation)
  * **HTTP** (API calls)
  * **Tool** (internal actions)
  * **Delay** (time-based control)

Each workflow execution becomes a **Task** with full traceability.

---

### ⏱ Schedules (Cron Automation)

* Cron-based scheduling
* Automatic task creation
* Ideal for:

  * Monitoring
  * Reports
  * Background automation
  * Periodic data sync

---

### 📊 Observability & Debugging

* Task execution timeline
* Step-level outputs & errors
* Real-time system logs
* Clear failure attribution
* Designed for **root-cause analysis**, not guesswork

---

### 🧠 Agent Memory *(In Progress)*

* Persistent memory per agent
* Store learned facts & system knowledge
* Enables adaptive workflows over time

---

## 🏗 High-Level Architecture

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

**Design goals:**

* Clear execution boundaries
* Full auditability
* Safe tool execution
* Easy extension

---

## 🛠 Tech Stack

**Backend**

* Node.js + Express
* MongoDB
* Cron Scheduler
* Custom Agent Runtime

**Frontend**

* Next.js
* React
* Tailwind CSS

**AI & Automation**

* Pluggable LLM adapters
* Tool sandboxing
* Local-first execution

---

## 🧪 Common Use Cases

* AI workflow automation
* Scheduled backend jobs
* Monitoring & alerting agents
* Document processing pipelines
* Internal developer tools
* Secure AI experimentation

---

## 🔐 Security & Privacy

* Fully self-hosted
* No data leaves your system by default
* Secrets via environment variables only
* No vendor lock-in
* No hidden SaaS dependencies

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

## 🛣 Roadmap (Short-Term)

* WebSocket-based live updates
* Plugin-based tool system
* Advanced agent memory
* Public workflow API
* Role-based access control

---

## 🤝 Contributing

Contributions are welcome.

If you enjoy:

* AI agents
* Backend systems
* Automation engines
* Developer tooling

You’ll feel at home here.

See **CONTRIBUTING.md** for details.

---

## 📄 License

Apache License 2.0

---

> **Not a prompt playground.**
> **A real AI execution engine.**
