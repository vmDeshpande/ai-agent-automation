// backend/src/tests/resumeTask.handler.test.js
const { resumeTask } = require('../controllers/task.controller');
const Task = require('../models/task.model');
const Workflow = require('../models/workflow.model');

jest.mock('../models/task.model');
jest.mock('../models/workflow.model');

describe('resumeTask controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: 'user123' },
      params: { id: 'task123' },
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  it('should return 404 if task not found', async () => {
    Task.findById.mockResolvedValue(null);

    await resumeTask(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'not_found' }));
  });

  it('should return 403 if task does not belong to the user', async () => {
    const mockTask = {
      _id: 'task123',
      userId: 'otherUser',
      status: 'failed'
    };
    Task.findById.mockResolvedValue(mockTask);

    await resumeTask(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'forbidden' }));
  });

  it('should return 400 if task is already completed', async () => {
    const mockTask = {
      _id: 'task123',
      userId: 'user123',
      status: 'completed'
    };
    Task.findById.mockResolvedValue(mockTask);

    await resumeTask(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'task_already_completed' }));
  });

  it('should return 400 if task is currently running', async () => {
    const mockTask = {
      _id: 'task123',
      userId: 'user123',
      status: 'running'
    };
    Task.findById.mockResolvedValue(mockTask);

    await resumeTask(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'task_currently_running' }));
  });

  it('should resume failed task and reset attempts and failed stepResults', async () => {
    const mockTask = {
      _id: 'task123',
      userId: 'user123',
      status: 'failed',
      stepResults: [
        { stepId: 'step1', success: true, output: 'res1' },
        { stepId: 'step2', success: false, error: 'failed' }
      ]
    };
    Task.findById.mockResolvedValue(mockTask);
    Task.findByIdAndUpdate.mockResolvedValue({});

    await resumeTask(req, res);

    expect(Task.findByIdAndUpdate).toHaveBeenCalledWith('task123', {
      $set: {
        status: 'pending',
        startedAt: null,
        completedAt: null,
        attempts: 0,
        stepResults: [
          { stepId: 'step1', success: true, output: 'res1' }
        ],
        pausedAtStepId: null,
        "approval.decision": undefined,
        "approval.decidedAt": undefined,
        "approval.decidedBy": undefined,
        "approval.feedback": undefined
      }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, message: 'resumed' }));
  });

  it('should resume from a specific step and discard succeeding results', async () => {
    const mockTask = {
      _id: 'task123',
      userId: 'user123',
      status: 'failed',
      stepResults: [
        { stepId: 'step1', success: true, output: 'res1' },
        { stepId: 'step2', success: true, output: 'res2' },
        { stepId: 'step3', success: false, error: 'failed' }
      ]
    };
    Task.findById.mockResolvedValue(mockTask);
    req.body.resumeStepId = 'step2';

    await resumeTask(req, res);

    expect(Task.findByIdAndUpdate).toHaveBeenCalledWith('task123', {
      $set: {
        status: 'pending',
        startedAt: null,
        completedAt: null,
        attempts: 0,
        stepResults: [
          { stepId: 'step1', success: true, output: 'res1' }
        ],
        pausedAtStepId: null,
        "approval.decision": undefined,
        "approval.decidedAt": undefined,
        "approval.decidedBy": undefined,
        "approval.feedback": undefined
      }
    });
  });

  it('should block resume if workflow configuration has been mutated', async () => {
    const mockTask = {
      _id: 'task123',
      userId: 'user123',
      status: 'failed',
      workflowId: 'workflow123',
      steps: [
        { stepId: 'step1', type: 'llm', config: { prompt: 'original prompt' } }
      ],
      stepResults: [
        { stepId: 'step1', success: true, output: 'res1' }
      ]
    };
    const mockWorkflow = {
      _id: 'workflow123',
      metadata: {
        steps: [
          { stepId: 'step1', type: 'llm', config: { prompt: 'mutated prompt' } }
        ]
      }
    };
    Task.findById.mockResolvedValue(mockTask);
    Workflow.findById.mockResolvedValue(mockWorkflow);

    await resumeTask(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'workflow_mutated' }));
  });
});
