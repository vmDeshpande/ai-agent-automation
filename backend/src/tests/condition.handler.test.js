const { execute } = require('../agents/handlers/condition.handler');
const { runLLM } = require('../agents/llmAdapter');

jest.mock('../agents/llmAdapter', () => ({
  runLLM: jest.fn()
}));

describe('Condition Handler', () => {
  it('should evaluate a contains condition correctly', async () => {
    const step = { config: { conditionType: 'contains', value: 'success' } };
    const context = { last: { output: 'The operation was a success.' } };
    
    const result = await execute(step, context, null, 'cond-123', 5000);

    expect(result.success).toBe(true);
    expect(result.output).toBe(true);
    expect(result.branch).toBe('true');
  });

  it('should evaluate a boolean LLM condition correctly', async () => {
    runLLM.mockResolvedValue({ text: 'true' });
    const step = { config: { conditionType: 'boolean' } };
    const context = { last: { output: 'Is the sky blue?' } };

    const result = await execute(step, context, {}, 'cond-124', 5000);

    expect(runLLM).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.output).toBe(true);
  });
});