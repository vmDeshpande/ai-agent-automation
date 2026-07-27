// src/controllers/workflowOverview.controller.js
//
// Issue #283 — `GET /api/workflows/:id/overview`.
//
// One-stop aggregator for the Workflow Details page. The frontend used
// to wire SuccessRate/AvgDuration/EstCost/Metadata/Variables/Trigger to
// placeholder values; this endpoint returns the real, joined view:
//   - workflow metadata + the owner's display name
//   - execution metrics from `Task.aggregate` (success rate, avg duration, total runs)
//   - token usage from `stepResults[].metrics.tokenUsage` (reuses the
//     #281 instrumentation)
//   - variables on the workflow (secrets masked by the variables controller)
//   - active triggers: schedule entries + webhook entries that point at this workflow
//
// Notes:
//   - Aggregation pipelines are scoped to this workflow's tasks via
//     `workflowId` so multi-workflow accounts don't double-count.
//   - The `trigger` block picks the "primary" channel by precedence:
//     schedule > webhook > manual. The full list (for UI display) is
//     also returned.

const Workflow = require('../models/workflow.model');
const Task = require('../models/task.model');
const User = require('../models/user.model');
const Schedule = require('../models/schedule.model');
const Webhook = require('../models/webhook.model');
const { publicShape: variablePublicShape } = require('./workflowVariables.controller');

function sendOK(res, payload = {}) {
  return res.json({ ok: true, ...payload });
}
function sendErr(res, code = 500, msg = 'server_error') {
  return res.status(code).json({ ok: false, error: msg });
}

async function getWorkflowOverview(req, res) {
  try {
    const userId = req.user._id;
    const workflowId = req.params.id;

    const workflow = await Workflow.findById(workflowId);
    if (!workflow) return sendErr(res, 404, 'not_found');
    if (workflow.userId.toString() !== userId.toString()) {
      return sendErr(res, 403, 'forbidden');
    }

    // ── 1. Owner display name ──
    let creatorName = null;
    try {
      const owner = await User.findById(userId).select('name email').lean();
      if (owner) {
        creatorName = owner.name || owner.email || null;
      }
    } catch {
      creatorName = null;
    }

    // ── 2. Execution metrics from the workflow's tasks ──
    // The pipeline groups by status so we can compute success/failed counts
    // and an average duration in one roundtrip.
    const statusRows = await Task.aggregate([
      { $match: { workflowId: workflow._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDurationMs: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$completedAt', null] }, { $gt: ['$startedAt', null] }] },
                { $subtract: ['$completedAt', '$startedAt'] },
                0,
              ],
            },
          },
          withDuration: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$completedAt', null] }, { $gt: ['$startedAt', null] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    let totalRuns = 0;
    let completedRuns = 0;
    let failedRuns = 0;
    let totalDurationMs = 0;
    let withDuration = 0;
    let lastRunAt = null;
    for (const row of statusRows) {
      totalRuns += row.count;
      if (row._id === 'completed') completedRuns = row.count;
      if (row._id === 'failed') failedRuns = row.count;
      totalDurationMs += row.totalDurationMs || 0;
      withDuration += row.withDuration || 0;
    }

    const successRate =
      completedRuns + failedRuns > 0
        ? parseFloat(((completedRuns / (completedRuns + failedRuns)) * 100).toFixed(1))
        : null;

    const avgDurationMs = withDuration > 0 ? Math.round(totalDurationMs / withDuration) : null;

    // Pull `lastRunAt` from a separate cheap projection — `lastRunAt` on
    // a workflow overview only needs the timestamp of the most recent
    // task, which `aggregate({ workflowId }).sort({ startedAt: -1 })`
    // gets in one roundtrip without scanning every task.
    const lastTask = await Task.findOne({ workflowId: workflow._id })
      .sort({ startedAt: -1 })
      .select('startedAt')
      .lean();
    if (lastTask && lastTask.startedAt) {
      lastRunAt = lastTask.startedAt;
    }

    // ── 3. Token usage (reuses #281 instrumentation) ──
    // We $unwind stepResults so the per-step `metrics.tokenUsage` object
    // can be $grouped by provider. Stages without `tokenUsage` are
    // skipped via an early `$match` so the pipeline doesn't touch
    // unrelated step records.
    const tokenRows = await Task.aggregate([
      { $match: { workflowId: workflow._id } },
      { $unwind: '$stepResults' },
      {
        $match: {
          'stepResults.type': 'llm',
          'stepResults.metrics.tokenUsage': { $ne: null, $type: 'object' },
        },
      },
      {
        $group: {
          _id: '$stepResults.metrics.tokenUsage.provider',
          totalTokens: { $sum: '$stepResults.metrics.tokenUsage.totalTokens' },
          promptTokens: { $sum: '$stepResults.metrics.tokenUsage.promptTokens' },
          completionTokens: { $sum: '$stepResults.metrics.tokenUsage.completionTokens' },
          calls: { $sum: 1 },
          lastCallAt: { $max: '$stepResults.timestamp' },
        },
      },
    ]);

    const tokenUsage = {
      totalTokens: 0,
      totalCalls: 0,
      providers: tokenRows.map((r) => ({
        provider: r._id,
        totalTokens: r.totalTokens || 0,
        promptTokens: r.promptTokens || 0,
        completionTokens: r.completionTokens || 0,
        calls: r.calls,
        lastCallAt: r.lastCallAt ? new Date(r.lastCallAt).toISOString() : null,
      })),
    };
    for (const p of tokenUsage.providers) {
      tokenUsage.totalTokens += p.totalTokens;
      tokenUsage.totalCalls += p.calls;
    }

    // ── 4. Variables (secrets masked) ──
    const variables = Array.isArray(workflow.variables)
      ? workflow.variables.map(variablePublicShape)
      : [];

    // ── 5. Trigger channels ──
    const [schedules, webhooks] = await Promise.all([
      Schedule.find({ workflowId: workflow._id, userId }).sort({ createdAt: -1 }).lean(),
      Webhook.find({ workflowId: workflow._id, userId }).sort({ createdAt: -1 }).lean(),
    ]);

    const triggers = {
      schedules: schedules.map((s) => ({
        _id: s._id,
        name: s.name,
        cron: s.cron,
        timezone: s.timezone || 'UTC',
        enabled: !!s.enabled,
        lastRunAt: s.lastRunAt || null,
        nextRunAt: s.nextRunAt || null,
      })),
      webhooks: webhooks.map((w) => ({
        _id: w._id,
        name: w.name,
        source: w.source,
        active: !!w.active,
        hasSecret: !!w.secret,
        createdAt: w.createdAt,
      })),
    };

    const primary =
      workflow.trigger && workflow.trigger.type
        ? workflow.trigger.type
        : triggers.schedules.length > 0
          ? 'schedule'
          : triggers.webhooks.length > 0
            ? 'webhook'
            : 'manual';

    // ── 6. Assemble response ──
    return sendOK(res, {
      workflow: {
        _id: workflow._id,
        name: workflow.name,
        description: workflow.description || '',
        status: workflow.status,
        agentId: workflow.agentId,
        creatorName,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        workflowId: workflow._id,
      },
      metrics: {
        successRate,
        avgDurationMs,
        totalRuns,
        completedRuns,
        failedRuns,
        lastRunAt,
      },
      tokenUsage,
      variables,
      triggers: {
        primary,
        scheduledCount: triggers.schedules.length,
        webhookCount: triggers.webhooks.length,
        schedules: triggers.schedules,
        webhooks: triggers.webhooks,
      },
      lastUpdatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('getWorkflowOverview error', err);
    return sendErr(res);
  }
}

module.exports = { getWorkflowOverview };
