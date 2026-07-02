const { runLLM } = require('../llmAdapter');
const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  const output = String(context.last?.output || '');

  let evaluation = false;

  if (config.conditionType === 'contains') {
    evaluation = output.toLowerCase().includes(
      String(config.value || '')
        .toLowerCase()
        .trim()
    );
  } else if (config.conditionType === 'boolean') {
    const aiResult = await runLLM(`Answer only true or false:\n${output}`, {
      provider: agent?.config?.provider,
      model: agent?.config?.model,
      temperature: 0,
    });

    evaluation = aiResult.text.toLowerCase().includes('true');
  }

  return createStepResult({
    stepId: validatedStepId,
    type: 'condition',
    output: evaluation,
    branch: evaluation ? 'true' : 'false',
    success: true,
  });
}

module.exports = { execute };