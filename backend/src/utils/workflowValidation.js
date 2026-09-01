const { z } = require('zod');
const { edgeSchema } = require('../workflow/workflowGenerator.schema');

const baseStepSchema = z.object({
  stepId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  alias: z.string().optional(),
  config: z.any().optional(),
});

const fullStepSchema = baseStepSchema.superRefine((step, ctx) => {
  const config = step.config;
  if (!config || typeof config !== 'object') return;

  switch (step.type) {
    case 'delay':
      if (typeof config.seconds !== 'number' || config.seconds < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'delay.seconds must be a positive number',
          path: ['config', 'seconds'],
        });
      }
      break;
    case 'llm':
      if (!config.prompt || typeof config.prompt !== 'string' || !config.prompt.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'llm.prompt is required',
          path: ['config', 'prompt'],
        });
      }
      break;
    case 'http': {
      const method = config.method?.toLowerCase();
      if (!['get', 'post', 'put', 'delete'].includes(method)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'http.method must be GET, POST, PUT, or DELETE',
          path: ['config', 'method'],
        });
      }
      if (!config.url || typeof config.url !== 'string' || !config.url.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'http.url is required',
          path: ['config', 'url'],
        });
      }
      break;
    }
    case 'file':
      if (!['read', 'write', 'append', 'remove', 'list'].includes(config.action)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'file.action must be read, write, append, remove, or list',
          path: ['config', 'action'],
        });
      }
      if (!config.path || typeof config.path !== 'string' || !config.path.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'file.path is required',
          path: ['config', 'path'],
        });
      }
      break;
    case 'email':
      if (!config.to || typeof config.to !== 'string' || !config.to.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'email.to is required',
          path: ['config', 'to'],
        });
      }
      if (!config.subject || typeof config.subject !== 'string' || !config.subject.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'email.subject is required',
          path: ['config', 'subject'],
        });
      }
      break;
    case 'browser':
      if (!['screenshot', 'evaluate'].includes(config.action)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'browser.action must be screenshot or evaluate',
          path: ['config', 'action'],
        });
      }
      if (!config.url || typeof config.url !== 'string' || !config.url.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'browser.url is required',
          path: ['config', 'url'],
        });
      }
      break;
    case 'document_query':
      if (
        !config.documentId ||
        typeof config.documentId !== 'string' ||
        !config.documentId.trim()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'document_query.documentId is required',
          path: ['config', 'documentId'],
        });
      }
      if (!config.query || typeof config.query !== 'string' || !config.query.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'document_query.query is required',
          path: ['config', 'query'],
        });
      }
      break;
    case 'condition':
      if (!['contains', 'boolean'].includes(config.conditionType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'condition.conditionType must be contains or boolean',
          path: ['config', 'conditionType'],
        });
      }
      break;
    case 'mcp':
      if (!config.serverId || typeof config.serverId !== 'string' || !config.serverId.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mcp.serverId is required',
          path: ['config', 'serverId'],
        });
      }
      if (!config.toolName || typeof config.toolName !== 'string' || !config.toolName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mcp.toolName is required',
          path: ['config', 'toolName'],
        });
      }
      break;
    case 'agent_call':
      if (!config.agentId || typeof config.agentId !== 'string' || !config.agentId.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'agent_call.agentId is required',
          path: ['config', 'agentId'],
        });
      }
      break;
    case 'tool':
      if (!config.tool || typeof config.tool !== 'string' || !config.tool.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'tool.tool is required',
          path: ['config', 'tool'],
        });
      }
      break;
  }
});

const workflowStepsSchema = z.object({
  steps: z.array(fullStepSchema).min(1),
  edges: z.array(edgeSchema),
});

function validateWorkflowSteps(steps, edges) {
  const result = workflowStepsSchema.safeParse({ steps, edges });
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid workflow steps: ${issues}`);
  }
  return result.data;
}

module.exports = {
  validateWorkflowSteps,
  fullStepSchema,
};
