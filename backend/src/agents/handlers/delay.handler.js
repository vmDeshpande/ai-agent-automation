const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  const sec = Number(config.seconds ?? config.delay ?? 0);

  await new Promise((resolve) => setTimeout(resolve, sec * 1000));

  return createStepResult({
    stepId: validatedStepId,
    type: 'delay',
    input: sec,
    output: `Slept for ${sec} seconds`,
    success: true,
  });
}

module.exports = { execute };