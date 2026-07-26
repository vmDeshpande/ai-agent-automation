const { execute } = require('../agents/handlers/switch.handler');

describe('Switch Handler', () => {
  it('should extract, lowercase, and trim the last output for the case value', async () => {
    const step = {};
    const context = { last: { output: '  BRANCH_A  ' } }; 
    const validatedStepId = 'switch-123';
    const result = await execute(step, context, null, validatedStepId, 5000);
    

    expect(result.success).toBe(true);
    expect(result.stepId).toBe('switch-123');
    expect(result.type).toBe('switch');
    expect(result.caseValue).toBe('branch_a'); 
  });
});