const Log = require("../models/log.model");

/** 
 * GET /api/logs?limit=100
 */
async function listLogs(req, res) {
  try {
    const limit = Number(req.query.limit) || 200;

    const logs = await Log.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ ok: true, logs });
  } catch (err) {
    console.error("listLogs error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

module.exports = { listLogs };
