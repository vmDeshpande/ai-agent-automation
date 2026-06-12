# Agent System

## Agent Configuration

Agents act as autonomous execution units within workflows. Each agent requires a specific configuration defining its behavior, available tools, and access permissions. Configuration includes setting the system prompt, selecting the foundation model, and defining the bounds of its operational context.

## Provider Selection

The system supports multi-provider execution, allowing agents to be backed by different LLM providers based on task requirements. Supported providers include:
* OpenAI
* Gemini
* Groq
* Local models

## Model Routing

Model routing dictates that workflows are executed using the specific provider and model explicitly configured on the assigned agent. This ensures predictable execution, allowing users to strictly control which foundation model is responsible for a given workflow based on their agent setup.

## Memory-Enabled Workflows

Agents can be equipped with persistent semantic memory. When a memory-enabled agent executes a workflow step, it automatically retrieves relevant past interactions and context, appending this data to its internal prompt before execution. This ensures continuity across disjointed workflow runs.