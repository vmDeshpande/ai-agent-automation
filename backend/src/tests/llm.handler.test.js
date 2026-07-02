const { execute } = require('../agents/handlers/llm.handler');
const { runLLM } = require('../agents/llmAdapter');

jest.mock('../agents/llmAdapter');

describe('LLM Handler', () => {
  it('should simulate an LLM execution without memory', async () => {
    runLLM.mockResolvedValue({
      text: 'simulated AI response',
      raw: { usage: { tokens: 42 } }
    });

    const step = { config: { prompt: 'Hello AI' } };
    const validatedStepId = 'llm-123';
    const result = await execute(step, {}, null, validatedStepId, 5000);

    expect(runLLM).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.type).toBe('llm');
    expect(result.input).toBe('Hello AI');
    expect(result.output).toBe('simulated AI response');
  });
});