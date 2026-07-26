const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  
  // By default, the runner.js will pause the execution when requiresApproval is true.
  // The UI displays the approval message to the user.
  
  const interpolate = (str, ctx) => {
    return str.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
      let value = ctx;
      const keys = path.trim().split('.');
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return match;
        }
      }
      return value !== undefined ? value : match;
    });
  };

  const message = config.approvalMessage || config.message
    ? interpolate(config.approvalMessage || config.message, context)
    : 'Approval required before continuing';

  return createStepResult({
    stepId: validatedStepId,
    type: 'approval',
    tool: 'approval',
    input: message,
    output: 'Awaiting human approval',
    requiresApproval: true,
    success: true,
  });
}

module.exports = { execute };
