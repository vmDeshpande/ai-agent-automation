# AI Agent Automation Platform – Open-Source Workflow Automation Engine

**AI Agent Automation Platform** is an open-source, backend-first **AI workflow automation system** for building, running, and scheduling intelligent agent-driven pipelines — fully local, secure, and production-oriented.

This project is designed as a **real execution engine**, not a demo or prompt playground. It enables developers to orchestrate autonomous AI agents, automate backend workflows, run tasks on schedules, and inspect executions with full observability.
[Run Locally](https://github.com/vmDeshpande/ai-agent-automation#-local-development)


---

## 🔍 What Is AI Agent Automation Platform?

AI Agent Automation Platform is a **self-hosted alternative to tools like n8n or Zapier**, purpose-built for AI-driven automation. Everything runs locally or on your own infrastructure, ensuring **data privacy, security, and full control**.

Key ideas:

* Autonomous AI agents
* Deterministic workflow execution
* Secure local data processing
* Developer-friendly architecture

---

## 🚀 Key Features

### 🤖 Agent-Based Workflow Execution

* Step-by-step deterministic execution
* Pluggable LLM adapter (OpenAI, Gemini, Groq, HuggingFace, etc.)
* Structured inputs & outputs per step
* Centralized executor with safety guards
* Step-level success and failure tracking

### 🔁 Workflow Automation Engine

* Visual workflow pipeline UI
* Workflows defined as ordered steps
* Supported step types:

  * LLM reasoning
  * HTTP requests
  * Email automation
  * File read / write / append
  * Browser automation (sandboxed)
  * Delay & control steps

### ⏱ Scheduler (Cron-Based Automation)

* Cron-style scheduling
* Automatic task generation
* Supports recurring and long-running workflows
* Ideal for monitoring, reporting, and background automation

### 📄 Document Chat (Local & Free)

* Upload PDF documents
* Text extraction and semantic chunking
* Custom local vector store (no paid embedding APIs)
* Context-grounded answers only
* No hallucinations by design

### 📊 Observability & Logs

* Task lifecycle tracking
* Step-level execution logs
* Timestamped results
* Real-time log viewer UI

### 🧠 Agent Memory (In Progress)

* Persistent memory per agent
* Store facts, preferences, and prior context
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

This architecture enables:

* Clear execution boundaries
* Horizontal scalability
* Secure tool execution
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
* Custom execution pipeline
* Tool sandboxing
* Local vector store

---

## 🧪 Use Cases

* AI-powered workflow automation
* Scheduled reporting agents
* Backend task automation
* Intelligent document analysis
* Internal developer tools
* Secure AI experimentation platform

---

## 🔒 Security & Privacy

* Fully self-hosted (local or private cloud)
* No data leaves your system by default
* Secrets stored only in environment variables
* Sandboxed tool execution
* No vendor lock-in

---

## 🏁 Local Development

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/vmdeshpande/ai-agent-automation.git
cd ai-agent-automation
```

### 2️⃣ Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
npm run worker
```

Backend runs at: `http://localhost:5000`

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## 📂 Repository Structure

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

## 🛣 Roadmap

* OCR support for scanned PDFs
* Public REST API for workflows
* Agent memory expansion
* Real-time updates (WebSockets)
* Plugin-based tool system
* Role-based access control

---

## 🤝 Contributing

Contributions are welcome!

If you’re interested in AI agents, workflow automation, backend systems, or developer tooling, feel free to contribute.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📄 License

Licensed under the **Apache License 2.0**.

See the [LICENSE](./LICENSE) file for details.

---

## 💡 Philosophy

> This is not a prompt playground.
>
> This is a production-grade AI execution engine.
