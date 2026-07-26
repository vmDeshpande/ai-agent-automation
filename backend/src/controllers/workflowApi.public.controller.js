const Workflow = require('../models/workflow.model');
const Task = require('../models/task.model');
const ApiKey = require('../models/apiKey.model');
const { getWorkflowGraph } = require('../utils/workflowMetadata');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

/**
 * Helper: Polls database until task completes, fails, or times out
 */
async function waitForTaskCompletion(taskId, timeoutMs = 60000) {
  const startTime = Date.now();
  const pollInterval = 250; // ms (increased frequency for local-first responsiveness)

  while (Date.now() - startTime < timeoutMs) {
    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found');

    if (task.status === 'completed' || task.status === 'failed') {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
  throw new Error('Workflow execution timed out');
}

/**
 * Public endpoint handler: POST /api/workflows/public/:idOrSlug
 */
async function receivePublicWorkflowCall(req, res) {
  try {
    const { idOrSlug } = req.params;

    // 1. Resolve workflow by ID or endpointName slug
    let workflow = null;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      workflow = await Workflow.findById(idOrSlug);
    }

    if (!workflow) {
      workflow = await Workflow.findOne({ 'apiSettings.endpointName': idOrSlug });
    }

    if (!workflow) {
      return res.status(404).json({ ok: false, error: 'workflow_not_found' });
    }

    // 2. Assert API endpoint is enabled
    if (!workflow.apiSettings || !workflow.apiSettings.enabled) {
      return res.status(400).json({ ok: false, error: 'api_endpoint_disabled' });
    }

    // 3. Optional Authentication Check
    if (workflow.apiSettings.authentication) {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, error: 'missing_bearer_token' });
      }

      const token = authHeader.split(' ')[1];

      // Fetch all active keys for the workflow owner to compare
      const keys = await ApiKey.find({ userId: workflow.userId, status: 'active' });
      let authenticated = false;

      for (const key of keys) {
        const match = await bcrypt.compare(token, key.keyHash);
        if (match) {
          authenticated = true;
          break;
        }
      }

      if (!authenticated) {
        return res.status(401).json({ ok: false, error: 'invalid_api_key' });
      }
    }

    // 4. Resolve Graph steps and edges
    const { steps, edges } = getWorkflowGraph(workflow);
    if (steps.length === 0) {
      return res.status(400).json({ ok: false, error: 'workflow_has_no_steps' });
    }

    // 5. Gather Tracing Metadata
    const trackingMetadata = {
      trigger: 'workflow_api',
      source: 'workflow_invocation',
    };

    if (req.headers['x-source-workflow-id']) {
      trackingMetadata.sourceWorkflowId = req.headers['x-source-workflow-id'];
    }
    if (req.headers['x-source-workflow-name']) {
      trackingMetadata.sourceWorkflowName = req.headers['x-source-workflow-name'];
    }
    if (req.headers['x-source-task-id']) {
      trackingMetadata.sourceTaskId = req.headers['x-source-task-id'];
    }

    // 6. Create Task
    const task = await Task.create({
      name: `API Run - ${workflow.name}`,
      workflowId: workflow._id,
      agentId: workflow.agentId || null,
      userId: workflow.userId,
      input: req.body || {},
      steps,
      currentStep: 0,
      metadata: {
        steps,
        edges,
        ...trackingMetadata,
      },
      status: 'pending',
    });

    // Link task back to workflow
    workflow.tasks.push(task._id);
    await workflow.save();

    // 7. Check if asynchronous execution requested
    if (req.query.async === 'true') {
      return res.status(202).json({ ok: true, taskId: task._id, status: 'pending' });
    }

    // 8. Synchronous Blocking Execution
    try {
      const completedTask = await waitForTaskCompletion(task._id, 60000); // 60s timeout

      if (completedTask.status === 'completed') {
        const stepResults = completedTask.stepResults || [];

        let output = {};
        let stepFound = false;

        // Primary: check if responseStepId is configured
        if (workflow.apiSettings.responseStepId) {
          const targetResult = stepResults.find(
            (r) => r.stepId === workflow.apiSettings.responseStepId
          );
          if (targetResult) {
            output = targetResult.output;
            stepFound = true;
          }
        }

        // Fallback Cascade: return output of final leaf step
        if (!stepFound && stepResults.length > 0) {
          output = stepResults[stepResults.length - 1].output;
        }

        // Output normalization to ensure valid JSON response
        if (output === null || output === undefined) {
          output = {};
        } else if (typeof output === 'string') {
          try {
            output = JSON.parse(output);
          } catch {
            output = { output };
          }
        } else if (typeof output !== 'object') {
          output = { output };
        }

        return res.json(output);
      } else {
        // Find error details
        const lastRetry =
          completedTask.retryHistory && completedTask.retryHistory.length > 0
            ? completedTask.retryHistory[completedTask.retryHistory.length - 1]
            : null;
        const errorMsg = lastRetry ? lastRetry.error : 'Workflow execution failed';
        return res.status(500).json({ ok: false, error: 'execution_failed', details: errorMsg });
      }
    } catch (err) {
      return res.status(504).json({ ok: false, error: 'execution_timeout', message: err.message });
    }
  } catch (err) {
    console.error('receivePublicWorkflowCall error', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

module.exports = {
  receivePublicWorkflowCall,
};
