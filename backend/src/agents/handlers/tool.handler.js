const { hasTool, dispatchTool } = require('../../tools/registry');
const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  let stepType = String(step.type || '').toLowerCase();
  let resolvedStepType = stepType;
  
  if (stepType === 'tool') {
    const subTool = config.tool || step.tool;
    if (subTool) {
      resolvedStepType = String(subTool).toLowerCase();
    } else {
      if (config.path || (config.action && ['read','write','append','remove','list'].includes(config.action))) {
        resolvedStepType = 'file';
      } else if (config.to || config.subject) {
        resolvedStepType = 'email';
      } else if (config.url || config.action === 'evaluate') {
        resolvedStepType = 'browser';
      }
    }
  }

  if (hasTool(resolvedStepType)) {
    const toolResult = await dispatchTool(resolvedStepType, config, context);

    return createStepResult({
      stepId: validatedStepId,
      type: resolvedStepType,
      tool: resolvedStepType,
      output: toolResult,
      error: toolResult?.error,
      success: !toolResult?.error,
    });
  }

  return createStepResult({
    stepId: validatedStepId,
    type: stepType,
    output: `Unknown step type: ${stepType}`,
    error: `Unknown step type: ${stepType}`,
    success: false,
  });
}

module.exports = { execute };