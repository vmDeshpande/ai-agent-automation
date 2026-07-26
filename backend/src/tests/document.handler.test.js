const { execute } = require('../agents/handlers/document.handler');
const { queryDocument } = require('../services/documentService');
const { runLLM } = require('../agents/llmAdapter');

jest.mock('../services/documentService', () => ({
  queryDocument: jest.fn()
}));

jest.mock('../agents/llmAdapter', () => ({
  runLLM: jest.fn()
}));

describe('Document Query Handler', () => {
  it('should retrieve documents and query the LLM', async () => {
    queryDocument.mockResolvedValue([{ content: 'Mocked doc content' }]);
    runLLM.mockResolvedValue({ text: 'Mocked RAG answer' });

    const step = { config: { query: 'What is X?' } };
    const validatedStepId = 'doc-123';

    const result = await execute(step, { userId: 'user1' }, {}, validatedStepId, 5000);

    expect(queryDocument).toHaveBeenCalled();
    expect(runLLM).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.type).toBe('document_query');
    expect(result.output).toBe('Mocked RAG answer');
  });
});