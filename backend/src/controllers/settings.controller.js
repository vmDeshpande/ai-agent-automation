const SystemSettings = require("../models/systemSettings.model");
const { bumpWorkerSettingsVersion } = require("./system.controller");

async function getSettings(req, res) {
  try {
    let settings = await SystemSettings.findOne({
      userId: req.user._id,
    });

    // If user has no settings yet, create defaults
    if (!settings) {
      settings = await SystemSettings.create({
        userId: req.user._id,
      });
    }

    const settingsObj = settings.toObject();

    // 🔥 Detect which providers are actually configured in environment
    const availableProviders = {
      ollama: !!process.env.OLLAMA_HOST,
      groq: !!process.env.GROQ_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      huggingface: !!process.env.HF_API_KEY,
    };

    const mcpRuntime = {
      envEnabled: process.env.MCP_ENABLED !== "false",
      configPath: process.env.MCP_CONFIG_PATH || null,
      hasConfigJson: Boolean(process.env.MCP_CONFIG_JSON),
      hasServerUrl: Boolean(process.env.MCP_SERVER_URL),
    };

    res.json({
      ok: true,
      settings: settingsObj,          // stored user settings (no override)
      availableProviders,             // runtime availability for UI
      mcpRuntime,
    });
  } catch (err) {
    console.error("getSettings error", err);
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
    if (req.body.documentChat) update.documentChat = req.body.documentChat;
    if (req.body.mcp) update.mcp = req.body.mcp;

    if (req.body.assistant?.provider) {
      const provider = req.body.assistant.provider;

      const availabilityMap = {
        ollama: !!process.env.OLLAMA_HOST,
        groq: !!process.env.GROQ_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        gemini: !!process.env.GEMINI_API_KEY,
        huggingface: !!process.env.HF_API_KEY,
      };

      if (!availabilityMap[provider]) {
        return res.status(400).json({
          error: "Selected provider is not configured in environment",
        });
      }
    }

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
