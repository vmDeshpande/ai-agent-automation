const { runLLM } = require('../llmAdapter');
const { interpolate } = require('../utils/interpolate');
const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  const { queryDocument } = require('../../services/documentService');

  const query = interpolate(config.query || '', context);

  const chunks = await queryDocument(
    agent,
    context.userId,
    config.documentId,
    query,
    config.topK || 3
  );

  const contextText = chunks
    .map((c) => c.content)
    .join('\n\n')
    .slice(0, 3000);

  const llmRes = await runLLM(`DOCUMENT CONTEXT:\n${contextText}\n\nQUESTION:\n${query}`, {
    provider: agent?.config?.provider,
    model: agent?.config?.model,
    temperature: agent?.config?.temperature,
  });

  return createStepResult({
    stepId: validatedStepId,
    type: 'document_query',
    tool: 'document',
    input: query,
    output: llmRes?.error ? llmRes.error : llmRes?.text,
    error: llmRes?.error,
    success: !llmRes?.error,
  });
}

module.exports = { execute };