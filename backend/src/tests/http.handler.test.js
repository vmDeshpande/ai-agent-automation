const { execute } = require('../agents/handlers/http.handler');
const axios = require('axios');

jest.mock('axios');

describe('HTTP Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute a mocked HTTP GET request successfully and not send data even if body is provided', async () => {
    axios.mockResolvedValue({
      status: 200,
      data: { message: 'mock_api_success' }
    });

    const step = {
      config: {
        method: 'GET',
        url: 'https://api.example.com/data',
        body: '{"foo": "bar"}'
      }
    };
    const validatedStepId = 'http-123';
    const result = await execute(step, {}, null, validatedStepId, 5000);

    expect(axios).toHaveBeenCalled();
    const calledConfig = axios.mock.calls[0][0];
    expect(calledConfig.method).toBe('get');
    expect(calledConfig.data).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.type).toBe('http');
    expect(result.output.message).toBe('mock_api_success');
  });

  it('should execute a mocked HTTP POST request and send data/body', async () => {
    axios.mockResolvedValue({
      status: 201,
      data: { success: true }
    });

    const step = {
      config: {
        method: 'POST',
        url: 'https://api.example.com/data',
        body: '{"foo": "bar"}'
      }
    };
    const validatedStepId = 'http-124';
    const result = await execute(step, {}, null, validatedStepId, 5000);

    expect(axios).toHaveBeenCalled();
    const calledConfig = axios.mock.calls[0][0];
    expect(calledConfig.method).toBe('post');
    expect(calledConfig.data).toEqual({ foo: 'bar' });
    expect(result.success).toBe(true);
  });
});