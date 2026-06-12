// src/types/workflow.ts

export type StepType =
  | "LLM"
  | "HTTP"
  | "Delay"
  | "Tool"
  | "MCP"
  | "Document"
  | "Condition"
  | "Switch"
  | "GitHub"
  | "Slack"
  | "Discord";

export type ToolType = "email" | "file" | "browser";

export interface WorkflowNode {
  id: string;
  type: StepType;
  name: string;
  position?: {
    x: number;
    y: number;
  };

  // LLM
  useMemory?: boolean;
  memoryTopK?: number;
  prompt?: string;

  // HTTP
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;

  // Delay
  delay?: number;

  // Tool
  tool?: ToolType;

  // Email
  to?: string;
  subject?: string;
  text?: string;
  html?: string;

  // File
  action?: string;
  path?: string;
  content?: string;

  // Browser
  code?: string;

  // MCP
  serverId?: string;
  toolName?: string;
  arguments?: string;
  timeoutMs?: number;

  // Document RAG
  documentId?: string;
  query?: string;
  topK?: number;

  // Condition
  conditionType?: "boolean" | "sentiment" | "contains" | string;
  operator?: string;
  value?: string;
  trueTarget?: string;
  falseTarget?: string;

  // GitHub
  owner?: string;
  repo?: string;
  issue_number?: string;
  comment?: string;
  title?: string;

  // Switch
  cases?: {
    value: string;
    target: string;
  }[];
  defaultTarget?: string;
}

export interface BackendStep {
  stepId: string;
  name: string;
  type:
    | "LLM"
    | "HTTP"
    | "Delay"
    | "Tool"
    | "llm"
    | "http"
    | "delay"
    | "mcp"
    | "condition"
    | "switch"
    | "document_query"
    | "file"
    | "email"
    | "browser"
    | "github"
    | "slack"
    | "discord";

  position?: {
    x: number;
    y: number;
  };
  useMemory?: boolean;
  memoryTopK?: number;
  prompt?: string;
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | string;
  body?: string;
  seconds?: number;
  delay?: number;
  tool?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  action?: string;
  path?: string;
  content?: string;
  code?: string;
  serverId?: string;
  toolName?: string;
  arguments?: any;
  timeoutMs?: number;
  documentId?: string;
  query?: string;
  topK?: number;
  conditionType?: string;
  operator?: string;
  value?: string;
  trueTarget?: string;
  falseTarget?: string;
  owner?: string;
  repo?: string;
  issue_number?: string;
  comment?: string;
  title?: string;
  cases?: {
    value: string;
    target: string;
  }[];
  defaultTarget?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: "true" | "false";
  caseValue?: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, any>;
  labelStyle?: Record<string, any>;
  labelBgStyle?: Record<string, any>;
  labelBgPadding?: [number, number];
  labelBgBorderRadius?: number;
}

export interface WorkflowMetadata {
  steps?: BackendStep[];
  edges?: WorkflowEdge[];
}

export interface WorkflowPayload {
  _id: string;
  name: string;
  description?: string;
  status: string;
  agentId?: string;
  tasks?: (string | { _id: string })[];
  metadata?: WorkflowMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowApiResponse {
  ok: boolean;
  workflow?: WorkflowPayload;
  workflows?: WorkflowPayload[];
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  invalidNodeIds: string[];
}

export interface WorkflowDocument {
  _id: string;
  title?: string;
  name?: string;
}

export interface McpTool {
  id: string;
  name: string;
  serverId: string;
  serverName?: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface WorkflowAgent {
  _id: string;
  name: string;
  config?: {
    model?: string;
  };
}

export interface CreateWorkflowPayload {
  name: string;
  description?: string;
}

export interface UpdateWorkflowPayload {
  name?: string;
  description?: string;
  agentId?: string;
}

export interface UpdateWorkflowStepsPayload {
  steps: BackendStep[];
  edges: WorkflowEdge[];
}

export interface AssignAgentPayload {
  agentId: string;
}
