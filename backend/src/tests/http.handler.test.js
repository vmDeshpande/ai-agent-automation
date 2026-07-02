const { execute } = require('../agents/handlers/http.handler');
const axios = require('axios');

jest.mock('axios');

describe('HTTP Handler', () => {
  it('should execute a mocked HTTP GET request successfully', async () => {
    axios.mockResolvedValue({
      status: 200,
      data: { message: 'mock_api_success' }
    });

    const step = { config: { method: 'GET', url: 'https://api.example.com/data' } };
    const validatedStepId = 'http-123';
    const result = await execute(step, {}, null, validatedStepId, 5000);

    expect(axios).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.type).toBe('http');
    expect(result.output.message).toBe('mock_api_success');
  });
});