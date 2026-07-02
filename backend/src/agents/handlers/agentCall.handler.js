const { createStepResult } = require('../utils/stepResult');
const { interpolate } = require('../utils/interpolate');
const { runLLM } = require('../llmAdapter');
const { retrieveMemory, storeMemory } = require('../../services/memoryService');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  const inputPayload = interpolate(config.input || '', context);
  const waitForResponse = config.waitForResponse !== false;

  let systemBlock = `You are ${agent?.name || 'a specialized AI agent'}.`;
  if (agent?.role) systemBlock += ` Your role is ${agent.role}.`;
  if (agent?.objective) systemBlock += `\nObjective: ${agent.objective}`;
  if (agent?.systemInstructions) systemBlock += `\nStrict Instructions:\n${agent.systemInstructions}`;

  systemBlock += `\n\nCOMMUNICATION PROTOCOL:
You must respond ONLY with a valid JSON object matching this exact schema:
{
  "from": "${agent?.name || 'agent'}",
  "to": "calling_workflow",
  "type": "agent_result",
  "content": {
    "result": "your detailed response here"
  }
}
Do not include markdown formatting like \`\`\`json.`;

  let finalPrompt = `SYSTEM INSTRUCTION:\n${systemBlock}\n\n`;
  let memoryMetrics = null;

  if (config.useMemory && agent) {
    const memories = await retrieveMemory(agent, inputPayload, config.memoryTopK || 5);
    
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

      finalPrompt += `MEMORY:\n${memoryText}\n\n`;
    }
  }

  finalPrompt += `USER REQUEST:\n${inputPayload}`;

  if (!waitForResponse) {
    return createStepResult({
      stepId: validatedStepId,
      type: 'agent_call',
      input: inputPayload,
      output: 'Asynchronous agent delegation is not currently supported.',
      success: false,
      executedBy: {
        agentId: agent?._id,
        agentName: agent?.name,
        provider: agent?.config?.provider,
        model: agent?.config?.model
      }
    });
  }

  const llmRes = await runLLM(finalPrompt, {
    provider: agent?.config?.provider,
    model: agent?.config?.model,
    temperature: agent?.config?.temperature,
    ...config.options,
  });

    if (llmRes?.error) {
    return createStepResult({
      stepId: validatedStepId,
      type: 'agent_call',
      input: inputPayload,
      output: llmRes.error,
      error: llmRes.error,
      success: false,
      metrics: memoryMetrics,
      executedBy: {
        agentId: agent?._id,
        agentName: agent?.name,
        provider: agent?.config?.provider,
        model: agent?.config?.model
      }
    });
  }

  let parsedOutput;
  try {
    let rawText = llmRes.text.trim();
    rawText = rawText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(rawText.trim());
    
    if (typeof parsed?.content?.result === 'string') {
      parsedOutput = parsed;
    } else {
      throw new Error("Invalid schema");
    }
  } catch (e) {
    parsedOutput = {
      from: agent?.name || 'agent',
      to: 'calling_workflow',
      type: 'agent_result',
      content: { result: llmRes.text }
    };
  }

  if (config.useMemory && agent && !llmRes.error) {
    await storeMemory(
      agent,
      JSON.stringify({
        user: inputPayload,
        assistant: JSON.stringify(parsedOutput.content)
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
    type: 'agent_call',
    input: inputPayload,
    output: parsedOutput.content.result,
    fullResponse: parsedOutput,
    raw: llmRes?.raw,
    success: true,
    metrics: memoryMetrics,
    executedBy: {
      agentId: agent?._id,
      agentName: agent?.name,
      provider: agent?.config?.provider,
      model: agent?.config?.model
    }
  });
}

module.exports = { execute };