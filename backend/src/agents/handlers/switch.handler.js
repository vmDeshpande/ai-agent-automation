const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const value = String(context.last?.output || '')
    .toLowerCase()
    .trim();

  return createStepResult({
    stepId: validatedStepId,
    type: 'switch',
    output: value,
    caseValue: value,
    success: true,
  });
}

module.exports = { execute };