const { execute } = require('../agents/handlers/file.handler');
const fs = require('fs');


jest.mock('fs');
jest.mock('../agents/utils/fileResolver', () => ({
  resolveWorkflowFilePath: jest.fn((p) => `/mocked/safe/path/${p}`)
}));

describe('File Handler', () => {
  it('should simulate reading a file', async () => {
    fs.readFileSync.mockReturnValue('simulated file content');
    const step = { config: { action: 'read', path: 'dummy.txt' } };
    const validatedStepId = 'file-123';
    const result = await execute(step, {}, null, validatedStepId, 5000);

    expect(result.success).toBe(true);
    expect(result.type).toBe('file');
    expect(result.output).toBe('simulated file content');
  });

  describe('List Action', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should list directory contents when a directory path is provided', async () => {
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.readdirSync.mockReturnValue(['file1.txt', 'file2.js']);

      const step = { config: { action: 'list', path: 'reports-dir' } };
      const result = await execute(step, {}, null, 'step-1', 5000);

      expect(fs.statSync).toHaveBeenCalledWith('/mocked/safe/path/reports-dir');
      expect(fs.readdirSync).toHaveBeenCalledWith('/mocked/safe/path/reports-dir');
      expect(result.success).toBe(true);
      expect(result.output).toEqual(['file1.txt', 'file2.js']);
    });

    it('should list parent directory contents when a file path is provided (ENOTDIR prevention)', async () => {
      fs.statSync.mockReturnValue({ isDirectory: () => false });
      fs.readdirSync.mockReturnValue(['summary.txt', 'other.txt']);

      const step = { config: { action: 'list', path: 'reports-dir/summary.txt' } };
      const result = await execute(step, {}, null, 'step-2', 5000);

      expect(fs.statSync).toHaveBeenCalledWith('/mocked/safe/path/reports-dir/summary.txt');
      expect(fs.readdirSync).toHaveBeenCalledWith('/mocked/safe/path/reports-dir');
      expect(result.success).toBe(true);
      expect(result.output).toEqual(['summary.txt', 'other.txt']);
    });

    it('should fallback to parent directory if statSync throws an error (path does not exist yet)', async () => {
      fs.statSync.mockImplementation(() => { throw new Error('ENOENT: no such file or directory'); });
      fs.readdirSync.mockReturnValue(['existing.txt']);

      const step = { config: { action: 'list', path: 'new-dir/phantom-file.txt' } };
      const result = await execute(step, {}, null, 'step-3', 5000);

      expect(fs.readdirSync).toHaveBeenCalledWith('/mocked/safe/path/new-dir');
      expect(result.success).toBe(true);
    });
  });
});