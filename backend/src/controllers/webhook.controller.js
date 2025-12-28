const Webhook = require("../models/webhook.model");
const Workflow = require("../models/workflow.model");
const Task = require("../models/task.model");
const crypto = require("crypto");

// Create webhook config (private/admin)
async function createWebhook(req, res) {
  try {
    const { name, source, workflowId, metadata } = req.body;
    if (!name || !source) return res.status(400).json({ ok:false, error: "name_and_source_required" });

    const secret = crypto.randomBytes(16).toString("hex");
    const webhook = await Webhook.create({
      name, source, secret,
      userId: req.user._id,
      workflowId: workflowId || null,
      metadata: metadata || {}
    });
    res.status(201).json({ ok: true, webhook });
  } catch (err) {
    console.error("createWebhook error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

async function listWebhooks(req, res) {
  try {
    const webhooks = await Webhook.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ ok:true, webhooks });
  } catch (err) {
    console.error("listWebhooks error", err);
    res.status(500).json({ ok:false, error: "server_error" });
  }
}

async function deleteWebhook(req, res) {
  try {
    const wh = await Webhook.findById(req.params.id);
    if (!wh) return res.status(404).json({ ok:false, error: "not_found" });
    if (wh.userId.toString() !== req.user._id.toString()) return res.status(403).json({ ok:false, error: "forbidden" });
    await wh.deleteOne();
    res.json({ ok:true, message: "webhook_deleted" });
  } catch (err) {
    console.error("deleteWebhook error", err);
    res.status(500).json({ ok:false, error: "server_error" });
  }
}

module.exports = { createWebhook, listWebhooks, deleteWebhook };
