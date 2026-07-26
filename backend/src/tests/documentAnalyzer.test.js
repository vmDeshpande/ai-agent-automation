const documentAnalyzer = require('../retrieval/analyzers/DocumentAnalyzer');

describe('DocumentAnalyzer', () => {
  test('counts words correctly', () => {
    const result = documentAnalyzer.analyze(
      { fileType: 'txt' },
      'Hello world this is a simple document',
      ['Hello world this is a simple document']
    );

    expect(result.estimatedWordCount).toBe(7);
  });

  test('calculates average chunk length', () => {
    const chunks = ['Hello', 'Hello World'];

    const result = documentAnalyzer.analyze({ fileType: 'txt' }, chunks.join(' '), chunks);

    expect(result.averageChunkLength).toBe(8);
  });

  test('detects markdown headings', () => {
    const text = `
# Introduction

Some text

## Installation

More text
`;

    const result = documentAnalyzer.analyze({ fileType: 'md' }, text, [text]);

    expect(result.hasHeadings).toBe(true);
    expect(result.headingCount).toBeGreaterThan(0);
  });

  test('detects markdown tables', () => {
    const text = `
| Name | Age |
|------|-----|
| John | 30 |
`;

    const result = documentAnalyzer.analyze({ fileType: 'md' }, text, [text]);

    expect(result.hasTables).toBe(true);
  });

  test('returns low complexity for small documents', () => {
    const text = 'small document';

    const result = documentAnalyzer.analyze({ fileType: 'txt' }, text, [text]);

    expect(result.estimatedComplexity).toBe('low');
  });

  test('returns medium complexity', () => {
    const chunks = new Array(40).fill('Lorem ipsum dolor sit amet');

    const result = documentAnalyzer.analyze({ fileType: 'txt' }, chunks.join(' '), chunks);

    expect(result.estimatedComplexity).toBe('medium');
  });

  test('returns high complexity', () => {
    const chunks = new Array(150).fill('Lorem ipsum dolor sit amet consectetur adipiscing elit');

    const result = documentAnalyzer.analyze({ fileType: 'pdf' }, chunks.join(' '), chunks);

    expect(result.estimatedComplexity).toBe('high');
  });
});
