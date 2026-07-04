const { z } = require('zod');

const llmConfig = z.object({
  prompt: z.string().min(1),
  useMemory: z.boolean().optional(),
  memoryTopK: z.number().optional(),
});

const httpConfig = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  url: z.string().min(1),
  body: z.string().optional(),
  maxRetries: z.number().optional(),
  backoffMultiplier: z.number().optional(),
});

const fileConfig = z.object({
  action: z.enum(['read', 'write', 'append', 'remove', 'list']),
  path: z.string().min(1),
  content: z.string().optional(),
});

const emailConfig = z.object({
  to: z.string().min(1),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
});

const browserConfig = z.object({
  action: z.enum(['screenshot', 'evaluate']),
  url: z.string().min(1),
  code: z.string().optional(),
});

const documentQueryConfig = z.object({
  documentId: z.string().min(1),
  query: z.string().min(1),
  topK: z.number().optional(),
});

const conditionConfig = z.object({
  conditionType: z.enum(['contains', 'boolean']),
  operator: z.enum(["==", "!=", ">", "<", ">=", "<=", "contains", "startsWith"]).optional(),
  value: z.string().optional(),
});

const switchConfig = z.object({}).optional();

const delayConfig = z.object({
  seconds: z.number().min(1),
});

const stepSchema = z.discriminatedUnion('type', [
  z.object({ stepId: z.string().min(1), name: z.string().min(1), type: z.literal('delay'), alias: z.string().optional(), config: delayConfig }),
  z.object({ stepId: z.string().min(1), name: z.string().min(1), type: z.literal('llm'), alias: z.string().optional(), config: llmConfig }),
  z.object({ stepId: z.string().min(1), name: z.string().min(1), type: z.literal('http'), alias: z.string().optional(), config: httpConfig }),
  z.object({ stepId: z.string().min(1), name: z.string().min(1), type: z.literal('file'), alias: z.string().optional(), config: fileConfig }),
  z.object({ stepId: z.string().min(1), name: z.string().min(1), type: z.literal('email'), alias: z.string().optional(), config: emailConfig }),
  z.object({ stepId: z.string().min(1), name: z.string().min(1), type: z.literal('browser'), alias: z.string().optional(), config: browserConfig }),
  z.object({ stepId: z.string().min(1), name: z.string().min(1), type: z.literal('document_query'), alias: z.string().optional(), config: documentQueryConfig }),
  z.object({ stepId: z.string().min(1), name: z.string().min(1), type: z.literal('condition'), alias: z.string().optional(), config: conditionConfig }),
  z.object({ stepId: z.string().min(1), name: z.string().min(1), type: z.literal('switch'), alias: z.string().optional(), config: switchConfig }),
]);

const edgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  condition: z.enum(['true', 'false']).optional(),
  caseValue: z.string().optional(),
});

const generatedWorkflowSchema = z.object({
  steps: z.array(stepSchema).min(1),
  edges: z.array(edgeSchema),
});

module.exports = {
  stepSchema,
  edgeSchema,
  generatedWorkflowSchema,
};