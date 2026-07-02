# Automation Tools

The Workflow Engine supports a diverse registry of tools, allowing agents and pipelines to interact with internal systems, external services, and local environments.

## LLM
The core reasoning engine of the platform. This step routes prompts and contextual data to the configured multi-provider foundation model (e.g., OpenAI, Gemini, Groq, or local models) to generate intelligent text-based responses, structured data, or routing decisions.

## HTTP
Enables workflows to interact with external REST APIs and webhooks. Users can configure methods (GET, POST, PUT, DELETE), headers, authentication tokens, and dynamic request bodies using execution context variables.

## Delay
A time-based control mechanism that pauses workflow execution for a specified duration. Useful for rate-limiting, awaiting external state changes, or creating scheduled intervals between automated actions.

## File
Provides local file system operations. Workflows can read, write, append, or parse standard files, enabling agents to ingest local data or output generated reports directly to disk securely within the sandboxed environment.

## Email
Allows the automation platform to dispatch automated emails. This tool can be configured to send execution alerts, generated summaries, or workflow failure notifications to specified recipients.

## Browser
Enables web automation capabilities. Agents can interact with target URLs, extract text or specific page elements, and retrieve dynamic web content to feed into the execution pipeline.

## Document Query
Interfaces directly with the platform's Retrieval-Augmented Generation (RAG) system. This tool performs vector similarity searches against uploaded document chunks, retrieving specific factual context to ground subsequent agent prompts.