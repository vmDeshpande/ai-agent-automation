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
    const aiResult = await runLLM(
      `Answer only true or false. Output exactly one word: true or false.\n${output}`,
      {
        provider: agent?.config?.provider,
        model: agent?.config?.model,
        temperature: 0,
        // Best-effort: keep the model output as short as possible.
        maxTokens: 1,
      }
    );

    // Strict parsing: accept only a direct true response.
    // Ambiguous or negated text must not become truthy through substring matching.
    const text = String(aiResult.text || '')
      .toLowerCase()
      .trim();

    evaluation = /^true[\s.!?]*$/.test(text);
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
