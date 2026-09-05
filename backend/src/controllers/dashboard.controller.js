const mongoose = require('mongoose');
const fs = require('fs').promises;
const Workflow = require('../models/workflow.model');
const Task = require('../models/task.model');
const Agent = require('../models/agent.model');
const Schedule = require('../models/schedule.model');
const {
  getCached,
  setCached,
  ensureRedis,
  DASHBOARD_CACHE_TTL_MS,
} = require('../services/cache.service');

async function getDashboardStats(req, res) {
  try {
    const userId = req.user._id;
    const cacheKey = `dashboard:stats:${String(userId)}`;

    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, stats: cached });
    }

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
      activeWorkers,
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
      Agent.countDocuments({
        userId,
        isActive: true,
        updatedAt: { $gte: new Date(Date.now() - 5 * 60000) },
      }),
    ]);

    const dbStatus =
      mongoose.connection.readyState === 1
        ? 'operational'
        : mongoose.connection.readyState === 2
          ? 'degraded'
          : 'offline';

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

    const stats = {
      workflows: workflowCount,
      workflowTrend: recentWorkflows,
      tasks: {
        total: taskCount,
        completed: completedTasks,
        failed: failedTasks,
        running: runningTasks,
        pending: pendingTasks,
      },
      agents: {
        total: totalAgents,
        active: activeAgents,
      },
      schedules: {
        enabled: enabledSchedules,
        disabled: disabledSchedules,
      },
      health: {
        api: 'operational',
        database: dbStatus,
        queue: queueStatus,
        storage: storageStatus,
        workers: activeWorkers > 0 ? 'operational' : 'offline',
      },
    };

    setCached(cacheKey, stats, DASHBOARD_CACHE_TTL_MS).catch(() => {});

    res.json({ ok: true, stats });
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
    const cacheKey = `dashboard:execution-trend:${String(userId)}:${encodeURIComponent(tz)}`;

    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...cached });
    }

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

    const payload = { trend, summary };
    setCached(cacheKey, payload, DASHBOARD_CACHE_TTL_MS).catch(() => {});

    res.json({ ok: true, ...payload });
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

module.exports = { getDashboardStats, getExecutionTrend, getLiveWorkflowStatus };
