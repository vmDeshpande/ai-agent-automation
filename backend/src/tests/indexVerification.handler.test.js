/* H-P2-5 — Database Index Verification.
 *
 * Verifies that the Task and Workflow models define the indexes
 * required for common query patterns:
 *   - Task: { workflowId }, { startedAt }, { userId, status, createdAt }
 *   - Workflow: { status }, { agentId }, { userId, status }
 *
 * Mongoose models are loaded without a real database connection.
 * The test inspects schema.indexes() to confirm index definitions. */

const Task = require('../models/task.model');
const Workflow = require('../models/workflow.model');

describe('model index definitions (H-P2-5)', () => {
  test('Task schema defines workflowId index', () => {
    const indexes = Task.schema.indexes();
    const keys = indexes.map((i) => JSON.stringify(i[0]));
    expect(keys).toContain(JSON.stringify({ workflowId: 1 }));
  });

  test('Task schema defines startedAt index', () => {
    const indexes = Task.schema.indexes();
    const keys = indexes.map((i) => JSON.stringify(i[0]));
    expect(keys).toContain(JSON.stringify({ startedAt: 1 }));
  });

  test('Task schema defines compound index on userId + status + createdAt', () => {
    const indexes = Task.schema.indexes();
    const keys = indexes.map((i) => JSON.stringify(i[0]));
    expect(keys).toContain(JSON.stringify({ userId: 1, status: 1, createdAt: -1 }));
  });

  test('Workflow schema defines status index', () => {
    const indexes = Workflow.schema.indexes();
    const keys = indexes.map((i) => JSON.stringify(i[0]));
    expect(keys).toContain(JSON.stringify({ status: 1 }));
  });

  test('Workflow schema defines agentId index', () => {
    const indexes = Workflow.schema.indexes();
    const keys = indexes.map((i) => JSON.stringify(i[0]));
    expect(keys).toContain(JSON.stringify({ agentId: 1 }));
  });

  test('Workflow schema defines compound index on userId + status', () => {
    const indexes = Workflow.schema.indexes();
    const keys = indexes.map((i) => JSON.stringify(i[0]));
    expect(keys).toContain(JSON.stringify({ userId: 1, status: 1 }));
  });
});
