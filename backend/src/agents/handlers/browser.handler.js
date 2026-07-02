const { dispatchTool } = require('../../tools/registry');
const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
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