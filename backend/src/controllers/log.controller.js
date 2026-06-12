const Log = require("../models/log.model");

/**
 * GET /api/logs
 * Query params: level, workflowId, taskId, search, startDate, endDate, page, limit
 */
async function listLogs(req, res) {
  try {
    const {
      level,
      workflowId,
      taskId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 200,
    } = req.query;

    const filter = {};

    if (level) filter.level = level;
    if (workflowId) filter.workflowId = workflowId;
    if (taskId) filter.taskId = taskId;

    if (search) {
      filter.message = { $regex: search, $options: "i" };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(500, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      Log.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Log.countDocuments(filter),
    ]);

    res.json({
      ok: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("listLogs error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

module.exports = { listLogs };
