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
    const update = {};

    if (req.body.worker) update.worker = req.body.worker;
    if (req.body.ui) update.ui = req.body.ui;
    if (req.body.scheduler) update.scheduler = req.body.scheduler;
    if (req.body.assistant) update.assistant = req.body.assistant;

    const settings = await SystemSettings.findOneAndUpdate(
      { userId: req.user._id },
      { $set: update },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    bumpWorkerSettingsVersion();

    res.json({ ok: true, settings });
  } catch (err) {
    console.error("updateSettings error", err);
    res.status(500).json({ error: "server_error" });
  }
}


module.exports = { getSettings, updateSettings };
