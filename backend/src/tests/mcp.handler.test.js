const { execute } = require('../agents/handlers/mcp.handler');
const { invokeTool } = require('../mcp/executionAdapter');

jest.mock('../mcp/executionAdapter', () => ({
  invokeTool: jest.fn()
}));

describe('MCP Handler', () => {
  it('should invoke the MCP execution adapter', async () => {
    invokeTool.mockResolvedValue({ result: 'Mocked MCP result' });

    const step = { config: { serverId: 'server1', toolName: 'testTool' } };
    const context = { userId: 'user1' };
    const validatedStepId = 'mcp-123';

    const result = await execute(step, context, null, validatedStepId, 5000);

    expect(invokeTool).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.type).toBe('mcp');
    expect(result.output).toBe('Mocked MCP result');
  });
});