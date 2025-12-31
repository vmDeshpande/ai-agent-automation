const SystemSettings = require("../models/systemSettings.model");
const { bumpWorkerSettingsVersion } = require("./system.controller");

async function getSettings(req, res) {
  try {
    const settings = await SystemSettings.findOne({ userId: req.user._id });
    res.json({ ok: true, settings });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
}

async function updateSettings(req, res) {
  try {
    const settings = await SystemSettings.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          worker: req.body.worker,
          ui: req.body.ui,
        },
      },
      { new: true, upsert: true }
    );

    bumpWorkerSettingsVersion();

    res.json({ ok: true, settings });
  } catch (err) {
    console.error("updateWorkerSettings error", err);
    res.status(500).json({ error: "server_error" });
  }
}

module.exports = { getSettings, updateSettings };
