# Postman Collection — AI Agent Automation

This collection covers all major API groups in the platform.

## How to Import

1. Download both files:
   - `ai-agent-automation.postman_collection.json`
   - `ai-agent-automation.postman_environment.json`
2. Open Postman
3. Click **Import** → drag and drop both files
4. Select the **"AI Agent Automation - Local"** environment from the top-right dropdown

## Setup

The environment file pre-fills these variables — just update values as needed:

| Variable        | Description                          | Default                  |
|------------------|---------------------------------------|---------------------------|
| `baseUrl`        | Backend server URL                    | `http://localhost:5000`  |
| `token`          | Auto-set after running Login          | _(empty)_                 |
| `userEmail`      | Test account email                    | `test@example.com`        |
| `userPassword`   | Test account password                 | `password123`             |
| `agentId`        | Agent ID for agent-specific requests  | _(set after creating one)_|
| `workflowId`     | Workflow ID for workflow requests     | _(set after creating one)_|
| `documentId`     | Document ID for RAG requests          | _(set after uploading one)_|
| `webhookSource`  | Webhook source identifier (e.g. github, slack) | `github`         |
| `webhookSecret`  | Secret for public webhook auth        | _(empty)_                 |

## Quick Start

1. Run **Auth → Login** first — token is automatically saved to `{{token}}`
2. Run **Agents → Create Agent** — copy the returned `_id` into the `agentId` environment variable
3. All other requests use the environment variables automatically

## API Groups Covered

| Group          | Endpoints                                      |
|----------------|------------------------------------------------|
| Auth           | Register, Login                                |
| Health         | Health Check                                   |
| Dashboard      | Stats                                          |
| Agents         | CRUD + Run Agent (Playground)                  |
| Workflows      | CRUD + Run                                     |
| Tasks          | List, Get                                      |
| Schedules      | List, Create, Delete                           |
| Webhooks       | List, Create, Trigger (Public)                 |
| Documents/RAG  | List, Upload, Chat, Get, Delete                |
| Memory         | List, List Agents, Delete Entry, Clear Agent   |
| Settings       | Get, Update                                    |
| Logs           | List                                           |
| Telemetry      | Get                                            |
| System         | Get Providers                                  |
| Templates      | List                                           |

## Notes on Webhooks

The public webhook endpoint is `POST /webhook/:source` (not `/webhook/:token`).
Authentication is via either:
- Query param: `?secret=YOUR_SECRET`
- Header: `x-webhook-secret: YOUR_SECRET`

The collection request includes both for reference — only one is required.

## Local Development Setup

Make sure your backend `.env` has:

```env
MONGO_URI=your_mongodb_uri
GROQ_API_KEY=your_groq_key
PORT=5000
JWT_SECRET=your_jwt_secret
```

Start backend:
```bash
cd backend
npm run dev
```

Server runs at `http://localhost:5000`
