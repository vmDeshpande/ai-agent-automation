const fs = require('fs');
const path = require('path');
const { resolveWorkflowFilePath } = require('../utils/fileResolver');
const { interpolate } = require('../utils/interpolate');
const { createStepResult } = require('../utils/stepResult');

async function execute(step, context, agent, validatedStepId, timeoutMs) {
  const config = step.config || step;
  const filePath = resolveWorkflowFilePath(config.path);

  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });

const content = interpolate(config.content || context.last?.output || '', context);

  switch (config.action) {
    case 'read':
      return createStepResult({
        stepId: validatedStepId,
        type: 'file',
        success: true,
        output: fs.readFileSync(filePath, 'utf8')
      });
    case 'append':
      fs.appendFileSync(filePath, content);
      break;
    case 'write':
      fs.writeFileSync(filePath, content);
      break;
    case 'remove':
      fs.rmSync(filePath, { force: true });
      break;
    case 'list': {
      let targetDir = filePath;
      try {
        if (!fs.statSync(filePath).isDirectory()) {
          targetDir = path.dirname(filePath);
        }
      } catch (error) {
        targetDir = path.dirname(filePath);
      }

      return createStepResult({
        stepId: validatedStepId,
        type: 'file',
        success: true,
        output: fs.readdirSync(targetDir)
      });
    }
    default:
      return createStepResult({
        stepId: validatedStepId,
        type: 'file',
        success: false,
        output: `Unsupported action: ${config.action}`
      });
  }

  return createStepResult({
    stepId: validatedStepId,
    type: 'file',
    output: filePath,
    success: true,
  });
}

module.exports = { execute };