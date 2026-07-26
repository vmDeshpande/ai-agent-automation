# Multi-Agent Workflow Execution (A2A Foundation)

The AI Agent Automation platform supports deterministic multi-agent workflow execution through step-level agent delegation. This enables workflows to assign individual steps to specialized AI agents while preserving deterministic execution, execution traceability, and agent isolation.

> **Note**
>
> This implementation provides the foundation for future Agent-to-Agent (A2A) communication. In the current architecture, the workflow engine remains the orchestrator, and agents do not directly communicate with one another.

---

# Overview

Multi-agent execution is supported through two primary mechanisms:

1. **The `agent_call` Node**

   A dedicated workflow step that delegates execution to a specific agent and returns the result back to the workflow engine.

2. **Step-Level Agent Overrides**

   Standard workflow nodes (such as LLM, HTTP, File, Tool, etc.) can override the workflow's default agent and execute using another agent's configuration.

This approach allows a single workflow to leverage multiple specialized agents without changing the deterministic execution model.

Example:

```
Workflow Engine
      │
      ├── Step 1 → Research Agent
      ├── Step 2 → Writer Agent
      ├── Step 3 → Reviewer Agent
      └── Step 4 → Publisher Agent
```

Each delegated agent executes independently and returns its output to the workflow engine before the next workflow step begins.

---

# Features

## Step-Level Agent Delegation

Each workflow step may execute using a different agent.

Every delegated agent can have its own:

- Provider
- Model
- Temperature
- Role
- Objective
- System Instructions
- Tool Permissions
- Semantic Memory

This enables specialized workflows while keeping orchestration deterministic.

---

## Structured Agent Responses

The `agent_call` node instructs delegated agents to return structured JSON responses.

Example:

```json
{
  "from": "Math Expert Bot",
  "to": "calling_workflow",
  "type": "agent_result",
  "content": {
    "result": "1050. Multiplication of 25 and 42 is performed by repeating the addition of 25 forty-two times..."
  }
}
```

The execution engine automatically strips markdown formatting, validates the response, and falls back safely if the returned output does not match the expected structure.

Although this uses a structured message format, the response is returned to the workflow engine rather than another agent.

---

## Memory Isolation

Each delegated agent operates using its own semantic memory.

Memory retrieval and storage are scoped to the delegated agent's ID (`agent._id`), preventing information from leaking between specialized agents.

For example:

- Research Agent only accesses research memories.
- Writer Agent only accesses writing memories.
- Reviewer Agent only accesses review memories.

This keeps each agent's context independent throughout workflow execution.

---

## Execution Metadata

Each delegated execution records metadata including:

- Executing Agent
- Provider
- Model
- Execution Status

This information is exposed in the execution timeline to improve debugging and observability.

---

## Fallback Protection

If an LLM ignores the structured response format, the execution engine automatically wraps the returned text into the expected response structure, preventing downstream workflow failures.

---

# Using Multi-Agent Execution

## 1. Agent Call Node

The **Agent Task** node delegates a workflow step to another agent.

Configuration options include:

- **Target Agent**
- **Input / Prompt**
- **Wait for Response**
- **Use Target Agent's Memory**

Currently, asynchronous execution is intentionally disabled to preserve deterministic workflow execution.

---

## 2. Step-Level Agent Override

Most workflow nodes support an optional **Step-Level Agent Override**.

When configured, only that workflow step executes using the selected agent while the remainder of the workflow continues using the default workflow agent.

---

## 3. Execution Timeline

The task timeline displays:

- Executing Agent
- Provider
- Model
- Step Output

Example:

```
Math Expert Bot | groq / llama-3.1-8b-instant
```

This makes it easy to determine which agent executed each workflow step.

---

# Current Scope

The current implementation provides:

- ✅ Multi-agent workflow execution
- ✅ Step-level agent delegation
- ✅ Agent-specific configuration
- ✅ Structured execution responses
- ✅ Agent memory isolation
- ✅ Execution metadata
- ✅ Visual workflow builder integration

The following capabilities are **not yet implemented**:

- Direct agent-to-agent communication
- Autonomous conversations between agents
- Agent message routing
- Parallel agent collaboration
- Dynamic agent discovery
- Hierarchical agent orchestration

These capabilities can be built on top of the current architecture in future releases.