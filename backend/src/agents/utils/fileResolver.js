const path = require('path');

function resolveWorkflowFilePath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('Invalid file path');
  }

  if (filePath.includes('\0')) {
    throw new Error('Invalid file path');
  }

  if (path.isAbsolute(filePath) || path.win32.isAbsolute(filePath)) {
    throw new Error('Invalid file path: absolute paths are not allowed');
  }

  const workflowBaseDir = path.resolve(process.cwd(), 'runtime', 'workflow-files');
  const resolvedPath = path.resolve(workflowBaseDir, filePath);
  const relativePath = path.relative(workflowBaseDir, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid file path: path escapes workflow directory');
  }

  return resolvedPath;
}

module.exports = { resolveWorkflowFilePath };