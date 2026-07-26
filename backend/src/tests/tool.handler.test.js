const { execute } = require('../agents/handlers/tool.handler');
const { hasTool, dispatchTool } = require('../tools/registry');

jest.mock('../tools/registry', () => ({
  hasTool: jest.fn(),
  dispatchTool: jest.fn()
}));

describe('Tool Handler', () => {
  it('should successfully dispatch a registered legacy tool', async () => {
    hasTool.mockReturnValue(true);
    dispatchTool.mockResolvedValue('Mocked legacy tool result');

    const step = { type: 'tool', config: { tool: 'custom_integration' } };
    const validatedStepId = 'tool-123';

    const result = await execute(step, {}, null, validatedStepId, 5000);

    expect(hasTool).toHaveBeenCalledWith('custom_integration');
    expect(dispatchTool).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.type).toBe('custom_integration');
    expect(result.output).toBe('Mocked legacy tool result');
  });

  it('should fail gracefully if the tool is not found', async () => {
    hasTool.mockReturnValue(false);

    const step = { type: 'tool', config: { tool: 'missing_tool' } };
    const validatedStepId = 'tool-124';

    const result = await execute(step, {}, null, validatedStepId, 5000);

    expect(result.success).toBe(false);
    expect(result.output).toContain('Unknown step type');
  });
});