const { runWorkflowPartial } = require('../controllers/workflow.controller');
const Task = require('../models/task.model');
const Workflow = require('../models/workflow.model');
const { computeGraphHash } = require('../utils/workflowMetadata');
const mongoose = require('mongoose');

jest.mock('../models/task.model');
jest.mock('../models/workflow.model');

describe('Partial Execution Replay', () => {
  let req, res;
  let mockWorkflow, mockParentTask;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWorkflow = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Workflow',
      userId: new mongoose.Types.ObjectId(),
      agentId: null,
      metadata: {
        steps: [
          { stepId: 'step_A', name: 'Step A', type: 'http' },
          { stepId: 'step_B', name: 'Step B', type: 'llm' },
          { stepId: 'step_C', name: 'Step C', type: 'email' },
        ],
        edges: [
          { source: 'step_A', target: 'step_B' },
          { source: 'step_B', target: 'step_C' },
        ],
      },
      tasks: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const hash = computeGraphHash(mockWorkflow.metadata.steps, mockWorkflow.metadata.edges);

    mockParentTask = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Original Run',
      userId: mockWorkflow.userId,
      workflowId: mockWorkflow._id,
      status: 'completed',
      input: { originalInput: 'hello' },
      graphHash: hash,
      stepResults: [
        { stepId: 'step_A', type: 'http', success: true, output: 'result A' },
        { stepId: 'step_B', type: 'llm', success: true, output: 'result B' },
      ],
    };

    req = {
      params: { workflowId: mockWorkflow._id.toString() },
      body: {
        startNodeId: 'step_C',
        parentTaskId: mockParentTask._id.toString(),
      },
      user: { _id: mockWorkflow.userId },
    };

    res = {
      statusCode: 200,
      status: jest.fn().mockImplementation(function (code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn().mockImplementation(function (data) {
        this.body = data;
        return this;
      }),
    };

    Workflow.findById.mockResolvedValue(mockWorkflow);
    Task.findById.mockResolvedValue(mockParentTask);
  });

  it('should successfully create a replay task with pre-populated upstream results', async () => {
    Task.create.mockImplementation((data) => {
      return Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...data,
      });
    });

    await runWorkflowPartial(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.task).toBeDefined();

    expect(Task.create).toHaveBeenCalled();
    const taskArgs = Task.create.mock.calls[0][0];

    expect(taskArgs.executionMode).toBe('partial');
    expect(taskArgs.parentTaskId).toBe(mockParentTask._id.toString());
    expect(taskArgs.input).toEqual({ originalInput: 'hello' });

    // stepResults should be pre-populated for ancestors (A and B)
    expect(taskArgs.stepResults.length).toBe(2);
    expect(taskArgs.stepResults[0].stepId).toBe('step_A');
    expect(taskArgs.stepResults[0].metadata.isReplaySnapshot).toBe(true);
    expect(taskArgs.stepResults[0].metadata.replayedFromTaskId).toBe(mockParentTask._id.toString());
    expect(taskArgs.stepResults[1].stepId).toBe('step_B');
  });

  it('should fail if graphHash does not match parentTask graphHash (schema changed)', async () => {
    // Modify the workflow metadata to alter the hash
    mockWorkflow.metadata.steps.push({ stepId: 'step_D', name: 'Step D', type: 'delay' });

    await runWorkflowPartial(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('workflow_schema_changed');
  });

  it('should fail if starting node does not exist in workflow', async () => {
    req.body.startNodeId = 'non_existent';

    await runWorkflowPartial(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('not found');
  });

  it("should fail if replay is attempted against another user's task", async () => {
    mockParentTask.userId = new mongoose.Types.ObjectId(); // different userId

    await runWorkflowPartial(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('forbidden');
    expect(res.body.message).toContain('ownership mismatch');
  });

  it('should fail if replay is attempted against a task from a different workflow', async () => {
    mockParentTask.workflowId = new mongoose.Types.ObjectId(); // different workflowId

    await runWorkflowPartial(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('workflow_mismatch');
  });

  it('should fail if replay is attempted against an invalid baseline task with no execution history', async () => {
    mockParentTask.status = 'pending';
    mockParentTask.stepResults = []; // empty history

    await runWorkflowPartial(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('invalid_baseline_task');
  });

  it('should fail if replay is attempted against a pending task even if it has step results', async () => {
    mockParentTask.status = 'pending';
    mockParentTask.stepResults = [
      { stepId: 'step_A', type: 'http', success: true, output: 'result A' },
    ];

    await runWorkflowPartial(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('invalid_baseline_task');
  });

  it('should fail if replay is attempted against a running task even if it has step results', async () => {
    mockParentTask.status = 'running';
    mockParentTask.stepResults = [
      { stepId: 'step_A', type: 'http', success: true, output: 'result A' },
    ];

    await runWorkflowPartial(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('invalid_baseline_task');
  });
});
