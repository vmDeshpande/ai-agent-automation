const axios = require('axios');
const { interpolate } = require('../utils/interpolate');
const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  let parsedBody = null;

  if (config.body) {
    const interpolated = interpolate(config.body, context);
    try {
      parsedBody = JSON.parse(interpolated);
    } catch {
      parsedBody = interpolated;
    }
  }

  const headers = { ...(step.headers || {}) };
  if (context.workflow && context.workflow._id) {
    headers['x-source-workflow-id'] = String(context.workflow._id);
  }
  if (context.workflow && context.workflow.name) {
    headers['x-source-workflow-name'] = String(context.workflow.name);
  }
  if (context.taskId) {
    headers['x-source-task-id'] = String(context.taskId);
  }

  const response = await axios({
    method: (config.method || 'GET').toLowerCase(),
    url: interpolate(config.url || '', context),
    data: parsedBody,
    headers: { ...(config.headers || {}), ...headers },
    timeout: config.timeout || step.timeout || 30000,
    validateStatus: () => true,
  });

  return createStepResult({
    stepId: validatedStepId,
    type: 'http',
    input: interpolate(config.url || '', context),
    output: response.data,
    success: response.status >= 200 && response.status < 300,
  });
}

module.exports = { execute };