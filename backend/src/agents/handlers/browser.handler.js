const { dispatchTool } = require('../../tools/registry');
const { createStepResult } = require('../utils/stepResult');
const { validateUrl } = require('../utils/ssrfProtection');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  const rawUrl = config.url || '';

  try {
    await validateUrl(rawUrl);
  } catch (err) {
    return createStepResult({
      stepId: validatedStepId,
      type: 'browser',
      tool: 'browser',
      output: null,
      error: `SSRF blocked: ${err.message}`,
      success: false,
    });
  }

  const toolResult = await dispatchTool('browser', config, context);

  return createStepResult({
    stepId: validatedStepId,
    type: 'browser',
    tool: 'browser',
    output: toolResult,
    error: toolResult?.error,
    success: !toolResult?.error,
  });
}

module.exports = { execute };
