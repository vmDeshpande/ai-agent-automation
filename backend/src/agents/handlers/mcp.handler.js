const { invokeTool: invokeMcpTool } = require('../../mcp/executionAdapter');
const { interpolate } = require('../utils/interpolate');
const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;

  const execution = await invokeMcpTool({
    userId: context.userId,
    serverId: config.serverId,
    toolName: config.toolName,
    argumentsInput: config.arguments,
    context,
    interpolate,
    timeoutMs,
  });

  return createStepResult({
    stepId: validatedStepId,
    type: 'mcp',
    output: execution?.result || execution?.error,
    error: execution?.error,
    success: !execution?.error,
  });
}

module.exports = { execute };