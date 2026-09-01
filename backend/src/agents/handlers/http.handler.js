const axios = require('axios');
const { interpolate } = require('../utils/interpolate');
const { createStepResult } = require('../utils/stepResult');
const { validateUrl } = require('../utils/ssrfProtection');

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

  const method = (config.method || 'GET').toLowerCase();
  const hasBody = !['get', 'head'].includes(method);

  const rawUrl = interpolate(config.url || '', context);
  const sanitizedUrl = await validateUrl(rawUrl);

  const requestConfig = {
    method,
    url: sanitizedUrl,
    headers: { ...(config.headers || {}), ...headers },
    timeout: config.timeout || step.timeout || 30000,
    validateStatus: () => true,
    maxRedirects: 0,
  };

  if (hasBody && parsedBody !== null) {
    requestConfig.data = parsedBody;
  }

  const response = await axios(requestConfig);

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.location;
    if (location) {
      try {
        const redirectUrl = new URL(location, sanitizedUrl);
        await validateUrl(redirectUrl.toString());
      } catch (err) {
        return createStepResult({
          stepId: validatedStepId,
          type: 'http',
          input: rawUrl,
          output: null,
          error: `SSRF blocked: redirect to private address denied (${err.message})`,
          success: false,
        });
      }
    }
  }

  return createStepResult({
    stepId: validatedStepId,
    type: 'http',
    input: rawUrl,
    output: response.data,
    success: response.status >= 200 && response.status < 300,
  });
}

module.exports = { execute };
