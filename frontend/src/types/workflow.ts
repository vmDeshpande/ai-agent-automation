// src/types/workflow.ts

export interface NodeField {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select";
  options?: string[];
  default?: any;
  required?: boolean;
}

export interface NodeDefinition {
  id: string;
  name: string;
  version: string;
  category: string;
  description: string;
  fields: NodeField[];
}
export type StepType =
  | 'LLM'
  | 'HTTP'
  | 'Delay'
  | 'Tool'
  | 'MCP'
  | 'Document'
  | 'Condition'
  | 'Switch'
  | 'GitHub'
  | 'Slack'
  | 'Discord'
  | 'Parallel'
  | 'Join'
  | 'Approval'
  | 'agent_call';

export type ToolType = 'email' | 'file' | 'browser';

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  position?: {
    x: number;
    y: number;
  };
  config?: Record<string, any>;
  [key: string]: any;
}

export interface BackendStep {
  stepId: string;
  name: string;
  type: string;
  position?: {
    x: number;
    y: number;
  };
  config?: Record<string, any>;
  [key: string]: any;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: 'true' | 'false';
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

export interface WorkflowApiSettings {
  enabled: boolean;
  endpointName: string;
  authentication: boolean;
  rateLimit: boolean;
  responseStepId?: string;
}

export interface WorkflowPayload {
  _id: string;
  name: string;
  description?: string;
  status: string;
  agentId?: string;
  tasks?: (string | { _id: string })[];
  metadata?: WorkflowMetadata;
  apiSettings?: WorkflowApiSettings;
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
