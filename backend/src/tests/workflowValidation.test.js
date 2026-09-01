const { validateWorkflowSteps } = require('../utils/workflowValidation');

describe('Workflow Validation', () => {
  it('should accept valid workflow steps', () => {
    const steps = [
      {
        stepId: 's1',
        name: 'Fetch',
        type: 'http',
        config: { method: 'GET', url: 'https://api.example.com' },
      },
      { stepId: 's2', name: 'Process', type: 'llm', config: { prompt: 'Summarize' } },
    ];
    const edges = [{ source: 's1', target: 's2' }];

    expect(() => validateWorkflowSteps(steps, edges)).not.toThrow();
  });

  it('should reject missing stepId', () => {
    const steps = [
      { name: 'Fetch', type: 'http', config: { method: 'GET', url: 'https://api.example.com' } },
    ];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('stepId');
  });

  it('should reject missing name', () => {
    const steps = [
      { stepId: 's1', type: 'http', config: { method: 'GET', url: 'https://api.example.com' } },
    ];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('name');
  });

  it('should reject invalid HTTP method', () => {
    const steps = [
      {
        stepId: 's1',
        name: 'Fetch',
        type: 'http',
        config: { method: 'PATCH', url: 'https://api.example.com' },
      },
    ];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('http.method');
  });

  it('should reject missing HTTP url', () => {
    const steps = [{ stepId: 's1', name: 'Fetch', type: 'http', config: { method: 'GET' } }];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('http.url');
  });

  it('should reject invalid file action', () => {
    const steps = [
      { stepId: 's1', name: 'Write', type: 'file', config: { action: 'chmod', path: 'file.txt' } },
    ];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('file.action');
  });

  it('should reject missing file path', () => {
    const steps = [{ stepId: 's1', name: 'Write', type: 'file', config: { action: 'write' } }];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('file.path');
  });

  it('should reject missing email to', () => {
    const steps = [{ stepId: 's1', name: 'Send', type: 'email', config: { subject: 'Hello' } }];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('email.to');
  });

  it('should reject missing email subject', () => {
    const steps = [
      { stepId: 's1', name: 'Send', type: 'email', config: { to: 'test@example.com' } },
    ];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('email.subject');
  });

  it('should reject missing browser url', () => {
    const steps = [
      { stepId: 's1', name: 'Screenshot', type: 'browser', config: { action: 'screenshot' } },
    ];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('browser.url');
  });

  it('should reject missing llm prompt', () => {
    const steps = [{ stepId: 's1', name: 'Ask', type: 'llm', config: {} }];

    expect(() => validateWorkflowSteps(steps, [])).toThrow('llm.prompt');
  });

  it('should allow steps without config', () => {
    const steps = [{ stepId: 's1', name: 'Fetch', type: 'http' }];

    expect(() => validateWorkflowSteps(steps, [])).not.toThrow();
  });
});
