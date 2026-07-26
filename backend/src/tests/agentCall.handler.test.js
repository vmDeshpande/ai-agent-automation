const { execute } = require('../agents/handlers/agentCall.handler');
const llmAdapter = require('../agents/llmAdapter');

jest.mock('../agents/llmAdapter');

describe('Agent Call Handler (A2A Phase 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should enforce structured JSON messaging and call the LLM', async () => {
    llmAdapter.runLLM.mockResolvedValue({
      text: '{"from": "Specialist Data Bot", "to": "calling_workflow", "type": "agent_result", "content": {"result": "Data analyzed."}}',
      success: true
    });

    const mockStep = {
      id: 'step_1',
      type: 'agent_call',
      config: {
        input: 'Analyze this data'
      }
    };

    const mockContext = { taskId: 'test-task-123' };

    const mockAgent = {
      _id: 'agent_456',
      name: 'Specialist Data Bot',
      role: 'Data Analyst'
    };

    const result = await execute(mockStep, mockContext, mockAgent, 'step_1', 30000);

    expect(llmAdapter.runLLM).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.type).toBe('agent_call');
    expect(typeof result.output).toBe('object');
    expect(result.output.from).toBe('Specialist Data Bot');
    expect(result.output.content.result).toBe('Data analyzed.');
  });

  it('should handle LLM failures gracefully', async () => {
    llmAdapter.runLLM.mockResolvedValue({
      error: 'API Rate Limit Exceeded',
      success: false
    });

    const mockStep = { config: { input: 'Ping' } };
    const result = await execute(mockStep, {}, null, 'step_2', 30000);

    expect(result.success).toBe(false);
    expect(result.output).toBe('API Rate Limit Exceeded');
  });
});