# 🤖 AI Agent Automation Platform

**AI Agent Automation Platform** is a backend-first, production-oriented system for building, executing, and scheduling intelligent workflows powered by autonomous AI agents.

This project is designed as a *real execution engine*, not a demo or prompt playground. Agents run deterministic workflows, invoke tools, generate logs, persist state, and can be scheduled or triggered automatically.[Run Locally](https://github.com/vmDeshpande/ai-agent-automation#-local-development)

---

## ✨ What This System Does

At its core, the platform lets you:

* Define workflows as **step-based pipelines**
* Execute them using **AI agents**
* Invoke tools like HTTP, email, files, browser automation
* Schedule workflows using cron-like triggers
* Inspect executions, logs, and results in real time

Everything runs through a controlled agent runner with full observability.

---

## 🧠 Core Capabilities

### 🔹 Agent-Based Execution Engine

* Deterministic, step-by-step execution
* Pluggable LLM adapter
* Structured inputs & outputs per step
* Centralized executor with safety guards
* Per-step success / failure tracking

### 🔹 Workflow System

* Workflows defined as ordered steps
* Supported step types:

  * LLM reasoning
  * HTTP requests
  * Email automation
  * File read / write / append
  * Browser automation (sandboxed)
  * Delay & control steps
* Visual workflow pipeline UI

### 🔹 Scheduler (Cron-Based)

* Cron-style schedules for workflows
* Automatic task generation
* Supports recurring and long-running automations

### 🔹 Document Chat (Free & Local)

* Upload PDF documents
* Text extraction and chunking
* Custom vector store (no paid embedding APIs)
* Context-grounded Q&A only
* No hallucinations by design

### 🔹 Observability & Logs

* Task lifecycle tracking
* Step-level execution logs
* Timestamped results
* UI for inspecting workflow runs

### 🔹 Agent Memory (In Progress)

* Persistent memory per agent
* Store facts, preferences, and context
* Enables adaptive and personalized automation

---

## 🏗 System Architecture

```
Frontend (Next.js + React)
        ↓
REST API (Express.js)
        ↓
Workflow Engine
        ├── Agent Runner
        ├── Step Executor
        ├── Tool Registry
        ├── Scheduler
        └── Logger
        ↓
MongoDB (Tasks, Workflows, Logs, Agents)
```

This separation enables:

* Clear execution boundaries
* Horizontal scalability
* Safe tool execution
* Full auditability

---

## 🛠 Tech Stack

### Backend

* Node.js
* Express.js
* MongoDB
* PM2
* Cron Scheduler
* Custom Agent Runner

### Frontend

* Next.js
* React
* Tailwind CSS
* DaisyUI

### AI & Automation

* Pluggable LLM adapters
* Custom executor pipeline
* Tool sandboxing
* Vector store (local)

---

## 🚀 Local Development

### 1️⃣ Clone the repository

```bash
git clone https://github.com/vmdeshpande/ai-agent-automation.git
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
- Copy `backend/.env.example` → `backend/.env`
- Fill required environment variables


Backend runs at: `http://localhost:5000`

### 3️⃣ Frontend

```bash
cd frontend
npm install
npm run dev
```
- Copy `frontend/.env.example` → `frontend/.env.local`
- Set `NEXT_PUBLIC_API_URL` to your backend URL

Frontend runs at: `http://localhost:3000`

---

## 📂 Repository Structure (Simplified)

```
backend/
  ├── agents/
  ├── controllers/
  ├── routes/
  ├── services/
  ├── models/
  ├── tools/
  └── app.js

frontend/
  ├── app/
  ├── components/
  ├── dashboard/
  └── styles/
```

---

## 🎯 Use Cases

* AI-powered workflow automation
* Scheduled reporting agents
* Backend automation engine
* Intelligent document analysis
* Agent experimentation platform
* Internal developer tools

---

## Feature Stability

- ✅ Workflow Engine — Stable
- ✅ Scheduler — Stable
- ⚠️ Browser Automation — Experimental (sandboxed)
- 🚧 Agent Memory — In Progress

---

## 🔒 Security & Safety

* Tool execution is sandboxed
* Browser automation is restricted
* Secrets stored only in environment variables
* No external data sharing by default

---

## 🛣 Roadmap

* OCR support for scanned PDFs
* Public Workflow API
* Agent memory expansion
* Real-time updates (WebSockets)
* Plugin-based tool system
* Role-based access control

---

## 🤝 Contributing

Contributions and discussions are welcome, especially around:

* Agent tooling
* Workflow design
* Execution safety
* Observability and debugging

see the [CONTRIBUTION](./CONTRIBUTING.md) file for details.

---

## 📄 License

Licensed under the **Apache License 2.0**.

See the [LICENSE](./LICENSE) file for details.

---

## 💡 Philosophy

> This is not a prompt playground.
>
> This is an execution engine.
