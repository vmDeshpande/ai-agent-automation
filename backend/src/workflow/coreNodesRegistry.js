// backend/src/workflow/coreNodesRegistry.js

const coreNodes = [
  {
    id: "llm",
    name: "LLM Completion",
    version: "1.0.0",
    category: "Core",
    description: "Generate a response using a Large Language Model.",
    fields: [
      { name: "prompt", label: "Prompt", type: "textarea", required: true },
      { name: "useMemory", label: "Use Memory", type: "boolean", default: false },
      { name: "memoryTopK", label: "Memory Top K", type: "number", default: 5 }
    ]
  },
  {
    id: "http",
    name: "HTTP Request",
    version: "1.0.0",
    category: "Core",
    description: "Make an HTTP request.",
    fields: [
      { name: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "DELETE"], default: "GET", required: true },
      { name: "url", label: "URL", type: "text", required: true },
      { name: "body", label: "Body (JSON)", type: "textarea" },
      { name: "maxRetries", label: "Max Retries", type: "number", default: 0 },
      { name: "backoffMultiplier", label: "Backoff Multiplier", type: "number", default: 2 }
    ]
  },
  {
    id: "delay",
    name: "Delay",
    version: "1.0.0",
    category: "Core",
    description: "Pause the workflow execution.",
    fields: [
      { name: "seconds", label: "Delay (Seconds)", type: "number", default: 0, required: true }
    ]
  },
  {
    id: "document_query",
    name: "Document Query",
    version: "1.0.0",
    category: "Core",
    description: "Query a document in the knowledge base.",
    fields: [
      { name: "documentId", label: "Document ID", type: "text", required: true },
      { name: "query", label: "Query", type: "textarea", required: true },
      { name: "topK", label: "Top K Results", type: "number", default: 4 }
    ]
  },
  {
    id: "mcp",
    name: "MCP Tool Call",
    version: "1.0.0",
    category: "Integration",
    description: "Call a tool from an MCP server.",
    fields: [
      { name: "serverId", label: "Server ID", type: "text", required: true },
      { name: "toolName", label: "Tool Name", type: "text", required: true },
      { name: "arguments", label: "Arguments (JSON)", type: "textarea" },
      { name: "timeoutMs", label: "Timeout (ms)", type: "number", default: 30000 },
      { name: "maxRetries", label: "Max Retries", type: "number", default: 0 },
      { name: "backoffMultiplier", label: "Backoff Multiplier", type: "number", default: 2 }
    ]
  },
  {
    id: "condition",
    name: "Condition",
    version: "1.0.0",
    category: "Logic",
    description: "Branch execution based on a condition.",
    fields: [
      { name: "conditionType", label: "Condition Type", type: "text" },
      { name: "operator", label: "Operator", type: "select", options: ["==", "!=", ">", "<", ">=", "<=", "contains", "startsWith"] },
      { name: "value", label: "Value", type: "text" }
    ]
  },
  {
    id: "switch",
    name: "Switch",
    version: "1.0.0",
    category: "Logic",
    description: "Switch execution based on multiple cases.",
    fields: []
  },
  {
    id: "parallel",
    name: "Parallel",
    version: "1.0.0",
    category: "Logic",
    description: "Execute multiple branches in parallel.",
    fields: [
      { name: "failureStrategy", label: "Failure Strategy", type: "select", options: ["fail-fast", "continue-on-error"], default: "fail-fast" }
    ]
  },
  {
    id: "join",
    name: "Join",
    version: "1.0.0",
    category: "Logic",
    description: "Join parallel branches.",
    fields: []
  },
  {
    id: "approval",
    name: "Human Approval",
    version: "1.0.0",
    category: "Logic",
    description: "Pause the workflow and wait for human approval before proceeding.",
    fields: [
      { name: "approvalMessage", label: "Approval Message", type: "textarea", required: true, default: "Please approve this step" }
    ]
  },
  {
    id: "agent_call",
    name: "Agent Call",
    version: "1.0.0",
    category: "Integration",
    description: "Delegate execution to a specialized AI agent.",
    fields: [
      { name: "agentId", label: "Target Agent", type: "text", required: true },
      { name: "input", label: "Input Payload (JSON/Text)", type: "textarea", required: true },
      { name: "waitForResponse", label: "Wait For Response", type: "boolean", default: true }
    ]
  }
];

module.exports = { coreNodes };
