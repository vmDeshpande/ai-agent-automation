const { execute } = require('../agents/handlers/delay.handler');

describe('Delay Handler', () => {
  it('should wait for the specified seconds and return a standardized success result', async () => {
    const step = { config: { seconds: 0.1 } };
    const context = {};
    const validatedStepId = 'delay-123';
    const startTime = Date.now();
    const result = await execute(step, context, null, validatedStepId, 5000);
    const elapsedTime = Date.now() - startTime;
    

    expect(elapsedTime).toBeGreaterThanOrEqual(90);
    expect(result.success).toBe(true);
    expect(result.stepId).toBe('delay-123');
    expect(result.type).toBe('delay');
    expect(result.output).toBe('Slept for 0.1 seconds');
  });
});