const { execute } = require('../agents/handlers/email.handler');

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'mock-id-123',
      accepted: ['test@example.com']
    })
  })
}));

describe('Email Handler', () => {
  it('should execute a mocked email dispatch successfully', async () => {
    const step = { config: { to: 'test@example.com', subject: 'Hello' } };
    const validatedStepId = 'email-123';

    const result = await execute(step, {}, null, validatedStepId, 5000);

    expect(result.success).toBe(true);
    expect(result.type).toBe('email');
    expect(result.output.messageId).toBe('mock-id-123');
  });
});