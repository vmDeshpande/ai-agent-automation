const mongoose = require('mongoose');
const fs = require('fs').promises;
const Workflow = require('../models/workflow.model');
const Task = require('../models/task.model');
const Agent = require('../models/agent.model');
const Schedule = require('../models/schedule.model');

async function getDashboardStats(req, res) {
  try {
    const userId = req.user._id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      workflowCount,
      recentWorkflows,
      taskCount,
      completedTasks,
      failedTasks,
      runningTasks,
      pendingTasks,
      activeAgents,
      totalAgents,
      enabledSchedules,
      disabledSchedules,
      activeWorkers
    ] = await Promise.all([
      Workflow.countDocuments({ userId }),
      Workflow.countDocuments({ userId, createdAt: { $gte: sevenDaysAgo } }),
      Task.countDocuments({ userId }),
      Task.countDocuments({ userId, status: 'completed' }),
      Task.countDocuments({ userId, status: 'failed' }),
      Task.countDocuments({ userId, status: 'running' }),
      Task.countDocuments({ userId, status: 'pending' }),
      Agent.countDocuments({ userId, isActive: true }),
      Agent.countDocuments({ userId }),
      Schedule.countDocuments({ userId, enabled: true }),
      Schedule.countDocuments({ userId, enabled: false }),
      Agent.countDocuments({ userId, isActive: true, updatedAt: { $gte: new Date(Date.now() - 5 * 60000) } })
    ]);

    const dbStatus = mongoose.connection.readyState === 1 ? 'operational' :
                     mongoose.connection.readyState === 2 ? 'degraded' : 'offline';

    let storageStatus = 'operational';
    try {
      await fs.access(__dirname);
    } catch (e) {
      storageStatus = 'offline';
    }

    let queueStatus = 'operational';
    try {
      await Task.findOne().select('_id').lean();
    } catch (e) {
      queueStatus = 'offline';
    }

    res.json({
      ok: true,
      stats: {
        workflows: workflowCount,
        workflowTrend: recentWorkflows,
        tasks: {
          total: taskCount,
          completed: completedTasks,
          failed: failedTasks,
          running: runningTasks,
          pending: pendingTasks
        },
        agents: {
          total: totalAgents,
          active: activeAgents
        },
        schedules: {
          enabled: enabledSchedules,
          disabled: disabledSchedules
        },
        health: {
          api: 'operational',
          database: dbStatus,
          queue: queueStatus,
          storage: storageStatus,
          workers: activeWorkers > 0 ? 'operational' : 'offline'
        }
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

function getLocalStartOfDay(date, tz) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const map = {};
    parts.forEach((p) => {
      map[p.type] = p.value;
    });

    const targetYear = parseInt(map.year, 10);
    const targetMonth = parseInt(map.month, 10) - 1;
    const targetDay = parseInt(map.day, 10);

    const utcMidnight = new Date(Date.UTC(targetYear, targetMonth, targetDay, 0, 0, 0, 0));

    const formattedParts = formatter.formatToParts(utcMidnight);
    const fMap = {};
    formattedParts.forEach((p) => {
      fMap[p.type] = p.value;
    });

    const formattedDateInTZ = new Date(
      Date.UTC(
        parseInt(fMap.year, 10),
        parseInt(fMap.month, 10) - 1,
        parseInt(fMap.day, 10),
        parseInt(fMap.hour, 10),
        parseInt(fMap.minute, 10),
        parseInt(fMap.second, 10)
      )
    );

    const offsetMs = formattedDateInTZ.getTime() - utcMidnight.getTime();
    return new Date(utcMidnight.getTime() - offsetMs);
  } catch (err) {
    const fallback = new Date(date);
    fallback.setUTCHours(0, 0, 0, 0);
    return fallback;
  }
}

async function getExecutionTrend(req, res) {
  try {
    const userId = req.user._id;
    const tz = req.query.tz || 'UTC';

    const now = new Date();
    const localStartToday = getLocalStartOfDay(now, tz);
    const sevenDaysAgo = new Date(localStartToday);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const rows = await Task.aggregate([
      {
        $match: {
          userId,
          startedAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone: tz },
          },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
          },
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
      { $sort: { _id: 1 } },
    ]);

    const byDate = {};
    for (const row of rows) {
      byDate[row._id] = row;
    }

    const trend = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);

      const formatTime = new Date(d.getTime() + 1000 * 60 * 60 * 2);

      const options = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(formatTime);
      const map = {};
      parts.forEach((p) => {
        map[p.type] = p.value;
      });

      const dateKey = `${map.year}-${map.month}-${map.day}`;
      const label = formatTime.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });

      const row = byDate[dateKey];
      const total = row ? row.total : 0;
      const completed = row ? row.completed : 0;
      const failed = row ? row.failed : 0;
      const totalDurationMs = row ? row.totalDurationMs : 0;
      const withDuration = row ? row.withDuration : 0;

      trend.push({
        date: label,
        dateKey,
        executions: total,
        success: completed,
        failed,
        avgDurationMs: withDuration > 0 ? Math.round(totalDurationMs / withDuration) : 0,
      });
    }

    const totalRuns = trend.reduce((s, d) => s + d.executions, 0);
    const totalCompleted = trend.reduce((s, d) => s + d.success, 0);
    const totalDuration = rows.reduce((s, r) => s + r.totalDurationMs, 0);
    const totalWithDuration = rows.reduce((s, r) => s + r.withDuration, 0);

    const summary = {
      total: totalRuns,
      successRate: totalRuns > 0 ? parseFloat(((totalCompleted / totalRuns) * 100).toFixed(1)) : 0,
      avgDurationMs: totalWithDuration > 0 ? Math.round(totalDuration / totalWithDuration) : 0,
    };

    res.json({ ok: true, trend, summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

async function getLiveWorkflowStatus(req, res) {
  try {
    const userId = req.user._id;

    const running = await Task.find({ userId, status: 'running' }).sort({ startedAt: -1 }).limit(5);

    const failed = await Task.find({ userId, status: 'failed' }).sort({ startedAt: -1 }).limit(5);

    res.json({
      ok: true,
      running,
      failed,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

/**
 * Provider display constants for the dashboard's Token Usage card.
 * The order here is the order in `providers[]` — keep it stable so the
 * UI's per-provider column doesn't reshuffle between requests.
 */
const TOKEN_USAGE_PROVIDERS = ['groq', 'openai', 'gemini', 'ollama', 'huggingface'];

/**
 * Time window used to call a provider "Active". Reused by both the
 * aggregate pipeline and the per-row last-call computation so the
 * definition of "Active" is centralised here.
 */
const ACTIVE_PROVIDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/dashboard/token-usage
 *
 * Issue #281 — live AI token usage analytics.
 *
 * Aggregates `stepResults[].metrics.tokenUsage` for the requesting
 * user's tasks into a single dashboard-friendly response:
 *
 *   {
 *     ok: true,
 *     totalTokens: number,
 *     limit: null | number,  // future: per-user usage cap
 *     providers: [
 *       {
 *         provider: 'groq',
 *         totalTokens: number,
 *         promptTokens: number,
 *         completionTokens: number,
 *         calls: number,
 *         status: 'active' | 'inactive' | 'no_usage',
 *         lastCallAt: ISO8601 | null,
 *         models: [{ model: string, tokens: number, calls: number }],
 *       }, ...
 *     ],
 *     lastUpdatedAt: ISO8601  // server-side render time
 *   }
 *
 * The aggregation runs as a single MongoDB pipeline so the request is
 * one roundtrip and the dashboard's 30s polling rate stays cheap as
 * task counts grow.
 *
 * Notes on the provider attribution:
 *   - Each LLM step records `metrics.tokenUsage = { provider, model,
 *     promptTokens, completionTokens, totalTokens }`. When the step
 *     was triggered via an agent's config, the agent-configured
 *     provider/model is recorded as a fallback in case llmAdapter
 *     returned its own provider string (e.g. when env var fallback
 *     rewrote the request).
 *   - Steps without `tokenUsage` (e.g. text/code/file/HTTP steps) are
 *     skipped via an early `$match` so the aggregation doesn't touch
 *     unrelated step records.
 */
async function getTokenUsage(req, res) {
  try {
    const userId = req.user._id;

    // ── 1. Aggregate per-provider totals + per-provider last-call time ──
    // The pipeline $unwinds stepResults, filters down to LLM steps that
    // actually recorded a tokenUsage object, then groups by provider.
    // Per-model breakdowns are computed via a nested `$group` so each
    // provider entry carries a small array of (model, tokens, calls).
    const rows = await Task.aggregate([
      { $match: { userId } },
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
      { $sort: { totalTokens: -1 } },
    ]);

    // ── 2. Per-provider per-model breakdown ──────────────────────────
    // We run a second pass because MongoDB's nested $group adds too
    // much noise to the primary pipeline. With small cardinalities
    // (≤5 providers, ≤~10 models per provider) a separate pipeline is
    // faster and produces cleaner projection shape.
    const modelBreakdowns = await Task.aggregate([
      { $match: { userId } },
      { $unwind: '$stepResults' },
      {
        $match: {
          'stepResults.type': 'llm',
          'stepResults.metrics.tokenUsage': { $ne: null, $type: 'object' },
        },
      },
      {
        $group: {
          _id: {
            provider: '$stepResults.metrics.tokenUsage.provider',
            model: '$stepResults.metrics.tokenUsage.model',
          },
          tokens: { $sum: '$stepResults.metrics.tokenUsage.totalTokens' },
          calls: { $sum: 1 },
          lastCallAt: { $max: '$stepResults.timestamp' },
        },
      },
    ]);

    // Index model rows by provider for O(1) lookup during assembly.
    const modelsByProvider = {};
    for (const row of modelBreakdowns) {
      const prov = row._id.provider || 'unknown';
      if (!modelsByProvider[prov]) modelsByProvider[prov] = [];
      modelsByProvider[prov].push({
        model: row._id.model,
        tokens: row.tokens || 0,
        calls: row.calls,
        lastCallAt: row.lastCallAt,
      });
    }

    // ── 3. Assemble per-provider entries in a stable order ────────────
    // Index DB rows by provider for O(1) lookup.
    const totalsByProvider = {};
    for (const row of rows) {
      totalsByProvider[row._id] = row;
    }

    const now = new Date();
    const providers = TOKEN_USAGE_PROVIDERS.map((providerName) => {
      const agg = totalsByProvider[providerName];
      if (!agg) {
        return {
          provider: providerName,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          calls: 0,
          status: 'no_usage',
          lastCallAt: null,
          models: [],
        };
      }

      const lastCallAt = agg.lastCallAt ? new Date(agg.lastCallAt) : null;
      const activeThreshold = new Date(now.getTime() - ACTIVE_PROVIDER_WINDOW_MS);
      const status = lastCallAt && lastCallAt >= activeThreshold ? 'active' : 'inactive';

      return {
        provider: providerName,
        totalTokens: agg.totalTokens || 0,
        promptTokens: agg.promptTokens || 0,
        completionTokens: agg.completionTokens || 0,
        calls: agg.calls,
        status,
        lastCallAt: lastCallAt ? lastCallAt.toISOString() : null,
        models: (modelsByProvider[providerName] || []).sort((a, b) => b.tokens - a.tokens),
      };
    });

    const totalTokens = providers.reduce((s, p) => s + p.totalTokens, 0);
    const totalCalls = providers.reduce((s, p) => s + p.calls, 0);

    res.json({
      ok: true,
      totalTokens,
      // null until a per-user usage quota is configured in env/config —
      // the frontend treats `null` as "Unlimited" and the progress bar
      // stays inert. When a quota is added, this becomes a number.
      limit: null,
      totalCalls,
      providers,
      lastUpdatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('dashboard token usage error', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

module.exports = { getDashboardStats, getExecutionTrend, getLiveWorkflowStatus, getTokenUsage };
