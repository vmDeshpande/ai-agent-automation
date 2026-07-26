const { runLLM } = require('../llmAdapter');
const { interpolate } = require('../utils/interpolate');
const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  const prompt = interpolate(config.prompt || '', context);
  let finalPrompt = prompt;
  let memoryMetrics = null;

  let systemBlock = "";
  if (agent) {
    systemBlock = `You are ${agent.name || 'an AI agent'}.`;
    if (agent.role) systemBlock += ` Your role is ${agent.role}.`;
    if (agent.description) systemBlock += `\nDescription: ${agent.description}`;
    if (agent.objective) systemBlock += `\nObjective: ${agent.objective}`;
    if (agent.systemInstructions) systemBlock += `\nStrict Instructions:\n${agent.systemInstructions}`;
  }

  if (config.useMemory && agent) {
    const { retrieveMemory, storeMemory } = require('../../services/memoryService');

    const memories = await retrieveMemory(agent, prompt, config.memoryTopK || 5);

    memoryMetrics = {
      useMemory: true,
      retrievedMemoriesCount: memories.length,
    };

    if (memories.length > 0) {
      const memoryText = memories
        .map((m, i) => {
          try {
            const parsed = JSON.parse(m.content);
            return `Memory ${i + 1}:\nUser: ${parsed.user}\nAssistant: ${parsed.assistant}`;
          } catch {
            return m.content;
          }
        })
        .join('\n\n')
        .slice(0, 4000);

      finalPrompt = `SYSTEM INSTRUCTION:\n${systemBlock || 'You are an AI agent with persistent memory.'}\n\nMEMORY:\n${memoryText}\n\nUSER QUESTION:\n${prompt}\n\nUse the MEMORY section when relevant.`;
    } else if (systemBlock) {
      finalPrompt = `SYSTEM INSTRUCTION:\n${systemBlock}\n\nUSER QUESTION:\n${prompt}`;
    }

    const llmRes = await runLLM(finalPrompt, {
      provider: agent?.config?.provider,
      model: agent?.config?.model,
      temperature: agent?.config?.temperature,
      ...config.options,
    });

    if (llmRes?.text && !llmRes?.error) {
      await storeMemory(
        agent,
        JSON.stringify({
          user: prompt,
          assistant: llmRes.text,
        }),
        {
          taskId: context.taskId,
          workflowId: context.workflow?._id,
          type: 'conversation',
        }
      );
    }

    return createStepResult({
      stepId: validatedStepId,
      type: 'llm',
      input: prompt,
      output: llmRes?.error ? llmRes.error : llmRes?.text,
      raw: llmRes?.raw,
      error: llmRes?.error,
      success: !llmRes?.error,
      metrics: memoryMetrics,
    });
  }

  if (systemBlock) {
    finalPrompt = `SYSTEM INSTRUCTION:\n${systemBlock}\n\nUSER QUESTION:\n${prompt}`;
  }

  const llmRes = await runLLM(finalPrompt, {
    provider: agent?.config?.provider,
    model: agent?.config?.model,
    temperature: agent?.config?.temperature,
    ...config.options,
  });

  return createStepResult({
    stepId: validatedStepId,
    type: 'llm',
    input: prompt,
    output: llmRes?.text || llmRes?.error,
    raw: llmRes?.raw,
    error: llmRes?.error,
    success: !llmRes?.error,
  });
}

module.exports = { execute };