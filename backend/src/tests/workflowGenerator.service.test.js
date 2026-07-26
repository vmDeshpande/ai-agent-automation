const { generateWorkflowGraph, extractJsonPayload, assignPositions, buildUserPrompt } = require('../services/workflowGenerator.service');
const { runLLM } = require('../agents/llmAdapter');

jest.mock('../agents/llmAdapter');

describe('extractJsonPayload', () => {
  it('parses raw JSON', () => {
    const result = extractJsonPayload('{"steps":[],"edges":[]}');
    expect(result).toEqual({ steps: [], edges: [] });
  });

  it('strips markdown fences', () => {
    const result = extractJsonPayload('```json\n{"steps":[],"edges":[]}\n```');
    expect(result).toEqual({ steps: [], edges: [] });
  });

  it('throws on non-JSON text', () => {
    expect(() => extractJsonPayload('sorry, I cannot help with that')).toThrow();
  });
});

describe('buildUserPrompt', () => {
  it('builds a fresh-generation prompt when no existing graph', () => {
    const prompt = buildUserPrompt('summarize PDFs', undefined);
    expect(prompt).toContain('Build a workflow for this request');
    expect(prompt).toContain('summarize PDFs');
  });

  it('includes existing graph for regeneration', () => {
    const existing = { steps: [{ stepId: 'a', name: 'A', type: 'llm', config: {} }], edges: [] };
    const prompt = buildUserPrompt('add sentiment analysis', existing);
    expect(prompt).toContain('current workflow graph');
    expect(prompt).toContain('"stepId": "a"');
    expect(prompt).toContain('add sentiment analysis');
  });
});

describe('assignPositions', () => {
  it('assigns increasing y per depth and spreads branches on x', () => {
    const steps = [
      { stepId: 'a' }, { stepId: 'b' }, { stepId: 'c' }, { stepId: 'd' },
    ];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c', condition: 'true' },
      { source: 'b', target: 'd', condition: 'false' },
    ];
    const positioned = assignPositions(steps, edges);
    const byId = Object.fromEntries(positioned.map((s) => [s.stepId, s.position]));
    expect(byId.a.y).toBe(0);
    expect(byId.b.y).toBe(180);
    expect(byId.c.y).toBe(360);
    expect(byId.d.y).toBe(360);
    expect(byId.c.x).not.toBe(byId.d.x);
  });
});

describe('generateWorkflowGraph', () => {
  beforeEach(() => jest.clearAllMocks());

  it('produces DB-ready steps and edges from a valid LLM response', async () => {
    runLLM.mockResolvedValue({
      text: JSON.stringify({
        steps: [
          { stepId: 'fetch', name: 'Fetch', type: 'document_query', config: { documentId: 'auto', query: 'q' } },
          { stepId: 'sum', name: 'Summarize', type: 'llm', config: { prompt: '{{steps.fetch.output}}' } },
        ],
        edges: [{ source: 'fetch', target: 'sum' }],
      }),
      success: true,
    });

    const result = await generateWorkflowGraph({ description: 'summarize a doc' });

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toMatchObject({ stepId: 'fetch', type: 'document_query' });
    expect(result.steps[0].position).toEqual({ x: 0, y: 0 });
    expect(result.edges[0]).toMatchObject({ source: 'fetch', target: 'sum', animated: true });
  });

  it('rejects when description is missing', async () => {
    await expect(generateWorkflowGraph({})).rejects.toThrow('description is required');
  });

  it('rejects invalid step type from the LLM', async () => {
    runLLM.mockResolvedValue({
      text: JSON.stringify({
        steps: [{ stepId: 'x', name: 'X', type: 'sms', config: {} }],
        edges: [],
      }),
      success: true,
    });
    await expect(generateWorkflowGraph({ description: 'test' })).rejects.toThrow(
      'Generated workflow failed schema validation'
    );
  });

  it('rejects duplicate stepIds', async () => {
    runLLM.mockResolvedValue({
      text: JSON.stringify({
        steps: [
          { stepId: 'a', name: 'A', type: 'llm', config: { prompt: 'p' } },
          { stepId: 'a', name: 'A2', type: 'llm', config: { prompt: 'p2' } },
        ],
        edges: [],
      }),
      success: true,
    });
    await expect(generateWorkflowGraph({ description: 'test' })).rejects.toThrow('Duplicate stepIds');
  });

  it('rejects edges referencing unknown steps', async () => {
    runLLM.mockResolvedValue({
      text: JSON.stringify({
        steps: [{ stepId: 'a', name: 'A', type: 'llm', config: { prompt: 'p' } }],
        edges: [{ source: 'a', target: 'ghost' }],
      }),
      success: true,
    });
    await expect(generateWorkflowGraph({ description: 'test' })).rejects.toThrow(
      'edges referencing unknown steps'
    );
  });

  it('handles condition branching with true/false edges', async () => {
    runLLM.mockResolvedValue({
      text: JSON.stringify({
        steps: [
          { stepId: 'chk', name: 'Check', type: 'condition', config: { conditionType: 'boolean' } },
          { stepId: 'yes', name: 'Yes', type: 'llm', config: { prompt: 'p' } },
          { stepId: 'no', name: 'No', type: 'llm', config: { prompt: 'p' } },
        ],
        edges: [
          { source: 'chk', target: 'yes', condition: 'true' },
          { source: 'chk', target: 'no', condition: 'false' },
        ],
      }),
      success: true,
    });
    const result = await generateWorkflowGraph({ description: 'branch test' });
    const trueEdge = result.edges.find((e) => e.condition === 'true');
    const falseEdge = result.edges.find((e) => e.condition === 'false');
    expect(trueEdge.target).toBe('yes');
    expect(falseEdge.target).toBe('no');
  });
});