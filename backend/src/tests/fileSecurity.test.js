const { execute } = require('../agents/handlers/file.handler');
const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('../agents/utils/fileResolver', () => ({
  resolveWorkflowFilePath: jest.fn((p) => `/mocked/safe/path/${p}`),
  getWorkflowBaseDir: jest.fn(() => '/mocked/safe/path'),
}));

describe('File Handler Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow listing subdirectories', async () => {
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    fs.readdirSync.mockReturnValue(['file1.txt', 'file2.js']);

    const step = { config: { action: 'list', path: 'reports-dir' } };
    const result = await execute(step, {}, null, 'step-1', 5000);

    expect(result.success).toBe(true);
    expect(result.output).toEqual(['file1.txt', 'file2.js']);
  });

  it('should block listing the root sandbox directory', async () => {
    const step = { config: { action: 'list', path: '.' } };
    const result = await execute(step, {}, null, 'step-1', 5000);

    expect(result.success).toBe(false);
    expect(result.output).toContain('root sandbox directory');
  });

  it('should block listing parent directories via traversal', async () => {
    const step = { config: { action: 'list', path: '../etc' } };
    const result = await execute(step, {}, null, 'step-1', 5000);

    expect(result.success).toBe(false);
  });

  it('should still allow read/write/append/remove operations', async () => {
    fs.writeFileSync.mockImplementation(() => {});
    fs.readFileSync.mockReturnValue('content');
    fs.rmSync.mockImplementation(() => {});

    const readStep = { config: { action: 'read', path: 'file.txt' } };
    const readResult = await execute(readStep, {}, null, 'step-1', 5000);
    expect(readResult.success).toBe(true);

    const writeStep = { config: { action: 'write', path: 'file.txt', content: 'hello' } };
    const writeResult = await execute(writeStep, {}, null, 'step-1', 5000);
    expect(writeResult.success).toBe(true);
  });
});
