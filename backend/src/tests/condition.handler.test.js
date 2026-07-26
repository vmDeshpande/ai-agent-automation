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

  it('should evaluate true with punctuation correctly', async () => {
    runLLM.mockResolvedValue({ text: 'true.' });
    const step = { config: { conditionType: 'boolean' } };
    const context = { last: { output: 'Is the sky blue?' } };

    const result = await execute(step, context, {}, 'cond-125', 5000);
    expect(result.success).toBe(true);
    expect(result.output).toBe(true);
    expect(result.branch).toBe('true');
  });

  it('should evaluate false response as false', async () => {
    runLLM.mockResolvedValue({ text: 'false' });
    const step = { config: { conditionType: 'boolean' } };
    const context = { last: { output: 'Is the sky green?' } };

    const result = await execute(step, context, {}, 'cond-126', 5000);
    expect(result.success).toBe(true);
    expect(result.output).toBe(false);
    expect(result.branch).toBe('false');
  });

  it('should evaluate negations (e.g. not true) as false', async () => {
    runLLM.mockResolvedValue({ text: 'not true' });
    const step = { config: { conditionType: 'boolean' } };
    const context = { last: { output: 'Is the sky green?' } };

    const result = await execute(step, context, {}, 'cond-127', 5000);
    expect(result.success).toBe(true);
    expect(result.output).toBe(false);
    expect(result.branch).toBe('false');
  });

  it('should evaluate mixed true/false responses like "false. Not true." as false', async () => {
    runLLM.mockResolvedValue({ text: 'false. Not true.' });
    const step = { config: { conditionType: 'boolean' } };
    const context = { last: { output: 'Is the sky green?' } };

    const result = await execute(step, context, {}, 'cond-128', 5000);
    expect(result.success).toBe(true);
    expect(result.output).toBe(false);
    expect(result.branch).toBe('false');
  });
});