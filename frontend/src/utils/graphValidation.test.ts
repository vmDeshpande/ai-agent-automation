import assert from 'node:assert';
import { validateGraph, normalizeStepType } from './graphValidation';
import type { WorkflowNode, WorkflowEdge } from '../types/workflow';

type GraphValidationTestNode = Omit<Partial<WorkflowNode>, 'type'> & {
  id: string;
  type: string;
};

console.log('🧪 Running Graph Validation Tests...');

// Helper to assert that validateGraph passes or fails with specific error keywords
const assertValidationPasses = (
  nodes: GraphValidationTestNode[],
  edges: WorkflowEdge[],
  message: string
) => {
  const result = validateGraph(nodes as WorkflowNode[], edges);
  assert.strictEqual(
    result.isValid,
    true,
    `${message} expected to pass, but failed with: ${result.errors.join(', ')}`
  );
  assert.strictEqual(result.errors.length, 0);
  console.log(`   ✅ Pass: ${message}`);
};

const assertValidationFails = (
  nodes: GraphValidationTestNode[],
  edges: WorkflowEdge[],
  expectedErrorKeyword: string,
  message: string
) => {
  const result = validateGraph(nodes as WorkflowNode[], edges);
  assert.strictEqual(result.isValid, false, `${message} expected to fail, but passed`);
  assert.ok(
    result.errors.some((err) => err.toLowerCase().includes(expectedErrorKeyword.toLowerCase())),
    `Expected error keyword "${expectedErrorKeyword}" not found in errors: ${result.errors.join(', ')}`
  );
  console.log(`   ✅ Fail (Expected): ${message} - Error: "${result.errors[0]}"`);
};

// 1. Test normalizeStepType helper
assert.strictEqual(normalizeStepType('llm'), 'LLM');
assert.strictEqual(normalizeStepType('LLM'), 'LLM');
assert.strictEqual(normalizeStepType('tool'), 'Tool');
assert.strictEqual(normalizeStepType('file'), 'Tool');
assert.strictEqual(normalizeStepType('email'), 'Tool');
assert.strictEqual(normalizeStepType('browser'), 'Tool');
assert.strictEqual(normalizeStepType('condition'), 'Condition');
assert.strictEqual(normalizeStepType('Condition'), 'Condition');
assert.strictEqual(normalizeStepType('switch'), 'Switch');
assert.strictEqual(normalizeStepType('mcp'), 'MCP');
assert.strictEqual(normalizeStepType('document_query'), 'Document');
console.log('✅ Step Type Normalization tests passed.');

// 2. Test LLM validations (prompt required) with mixed case
assertValidationPasses(
  [{ id: '1', type: 'LLM', name: 'llm-node', prompt: 'Hello' }],
  [],
  'LLM node with prompt (uppercase type)'
);

assertValidationPasses(
  [{ id: '1', type: 'llm', name: 'llm-node', prompt: 'Hello' }],
  [],
  'llm node with prompt (lowercase type)'
);

assertValidationFails(
  [{ id: '1', type: 'llm', name: 'llm-node', prompt: '' }],
  [],
  'missing a required prompt',
  'llm node missing prompt (lowercase type)'
);

assertValidationFails(
  [{ id: '1', type: 'LLM', name: 'llm-node', prompt: '   ' }],
  [],
  'missing a required prompt',
  'LLM node whitespace prompt (uppercase type)'
);

// 3. Test Tool validations (tool, target URL, to email, path for file) with mixed case
assertValidationPasses(
  [{ id: '1', type: 'Tool', tool: 'email', to: 'test@example.com' }],
  [],
  'Tool step (email) with to address'
);

assertValidationPasses(
  [{ id: '1', type: 'tool', tool: 'email', to: 'test@example.com' }],
  [],
  'tool step (email) with to address (lowercase type)'
);

assertValidationPasses(
  [{ id: '1', type: 'email', to: 'test@example.com' }],
  [],
  "tool step inferred from type='email' with to address"
);

assertValidationFails(
  [{ id: '1', type: 'email', to: '' }],
  [],
  'missing a recipient address',
  "tool step type='email' missing recipient"
);

assertValidationPasses(
  [{ id: '1', type: 'file', path: '/test/path.txt' }],
  [],
  "tool step inferred from type='file' with path"
);

assertValidationFails(
  [{ id: '1', type: 'file', path: '' }],
  [],
  'missing a file path',
  "tool step type='file' missing path"
);

assertValidationPasses(
  [{ id: '1', type: 'browser', url: 'https://google.com' }],
  [],
  "tool step inferred from type='browser' with URL"
);

assertValidationFails(
  [{ id: '1', type: 'browser', url: '' }],
  [],
  'missing a target URL',
  "tool step type='browser' missing URL"
);

// 4. Test Condition validations with lowercase
assertValidationPasses(
  [
    { id: '1', type: 'condition', name: 'cond' },
    { id: '2', type: 'llm', prompt: 'T' },
    { id: '3', type: 'llm', prompt: 'F' },
  ],
  [
    { id: 'e1', source: '1', target: '2', condition: 'true' },
    { id: 'e2', source: '1', target: '3', condition: 'false' },
  ],
  'condition node with valid true and false branch (lowercase type)'
);

assertValidationFails(
  [
    { id: '1', type: 'condition', name: 'cond' },
    { id: '2', type: 'llm', prompt: 'T' },
  ],
  [{ id: 'e1', source: '1', target: '2', condition: 'true' }],
  "missing a 'true' or 'false' branch connection",
  'condition node missing false branch (lowercase type)'
);

// 5. Test Switch validations with lowercase
assertValidationPasses(
  [
    { id: '1', type: 'switch', name: 'sw' },
    { id: '2', type: 'llm', prompt: 'T' },
  ],
  [{ id: 'e1', source: '1', target: '2', caseValue: 'value1' }],
  'switch node with valid case branch (lowercase type)'
);

assertValidationFails(
  [{ id: '1', type: 'switch', name: 'sw' }],
  [],
  'has no connected case branches',
  'switch node with no connections (lowercase type)'
);

assertValidationFails(
  [
    { id: '1', type: 'switch', name: 'sw' },
    { id: '2', type: 'llm', prompt: 'T' },
  ],
  [
    { id: 'e1', source: '1', target: '2' }, // missing caseValue and label
  ],
  'outgoing connection without a case value',
  'switch node connection missing case value (lowercase type)'
);

console.log('\n🎉 ALL GRAPH VALIDATION TESTS PASSED SUCCESFULLY!');
