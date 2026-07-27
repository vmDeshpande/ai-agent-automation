// src/types/workflow.ts

export interface NodeField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select';
  options?: string[];
  default?: any;
  required?: boolean;
}

export interface NodeDefinition {
  type: string;
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

// ============================================================
// Issue #283 — workflow overview aggregated response
// ============================================================

export type WorkflowOverviewVariable = {
  name: string;
  isSecret: boolean;
  value: string | null;
  updatedAt: string;
};

export type WorkflowOverviewTriggerSchedule = {
  _id: string;
  name: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

export type WorkflowOverviewTriggerWebhook = {
  _id: string;
  name: string;
  source: string;
  active: boolean;
  hasSecret: boolean;
  createdAt: string;
};

export type WorkflowOverviewTokenUsage = {
  totalTokens: number;
  totalCalls: number;
  providers: {
    provider: string;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    calls: number;
    lastCallAt: string | null;
  }[];
};

export type WorkflowOverviewMetrics = {
  successRate: number | null;
  avgDurationMs: number | null;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  lastRunAt: string | null;
};

export type WorkflowOverviewPayload = {
  _id: string;
  name: string;
  description: string;
  status: string;
  agentId: string | null;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
  workflowId: string;
};

export type WorkflowOverviewResponse = {
  ok: boolean;
  workflow: WorkflowOverviewPayload;
  metrics: WorkflowOverviewMetrics;
  tokenUsage: WorkflowOverviewTokenUsage;
  variables: WorkflowOverviewVariable[];
  triggers: {
    primary: 'schedule' | 'webhook' | 'manual';
    scheduledCount: number;
    webhookCount: number;
    schedules: WorkflowOverviewTriggerSchedule[];
    webhooks: WorkflowOverviewTriggerWebhook[];
  };
  lastUpdatedAt: string;
};

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
