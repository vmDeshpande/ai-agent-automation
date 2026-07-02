const { execute } = require('../agents/handlers/browser.handler');
const { dispatchTool } = require('../tools/registry');

jest.mock('../tools/registry', () => ({
  dispatchTool: jest.fn()
}));

describe('Browser Handler', () => {
  it('should wrap and dispatch the browser tool', async () => {
    dispatchTool.mockResolvedValue('Mocked browser result');

    const step = { config: { action: 'evaluate' } };
    const validatedStepId = 'browser-123';

    const result = await execute(step, {}, null, validatedStepId, 5000);

    expect(dispatchTool).toHaveBeenCalledWith('browser', step.config, {});
    expect(result.success).toBe(true);
    expect(result.type).toBe('browser');
    expect(result.output).toBe('Mocked browser result');
  });
});