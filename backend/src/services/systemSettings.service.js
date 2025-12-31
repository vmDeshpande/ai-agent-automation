const SystemSettings = require("../models/systemSettings.model");

async function ensureSystemSettingsForUser(userId) {
  if (!userId) return null;

  const existing = await SystemSettings.findOne({ userId });
  if (existing) return existing;

  const settings = await SystemSettings.create({
    userId,
    // defaults are auto-applied by schema
  });

  return settings;
}

module.exports = { ensureSystemSettingsForUser };
