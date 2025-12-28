const Webhook = require("../models/webhook.model");
const Workflow = require("../models/workflow.model");
const Task = require("../models/task.model");

/**
 * Public endpoint: POST /webhook/:source
 * Authorization: query param `secret` or header `x-webhook-secret`
 * Body: any JSON from external service (we store in task.input.payload)
 */
async function receiveWebhook(req, res) {
  try {
    const source = req.params.source;
    const secret = req.query.secret || req.headers["x-webhook-secret"];
    if (!secret) return res.status(401).json({ ok:false, error: "missing_secret" });

    // Find matching active webhook config for this source and secret
    const wh = await Webhook.findOne({ source, secret, active: true });
    if (!wh) return res.status(403).json({ ok:false, error: "invalid_secret_or_inactive" });

    // create a task for the linked workflow (if provided) or a stand-alone task
    const payload = req.body || {};
    const task = await Task.create({
      name: `webhook:${source} - ${wh.name}`,
      workflowId: wh.workflowId || null,
      userId: wh.userId,
      input: { payload, headers: req.headers },
      metadata: {
        source,
        webhookId: wh._id,
        originalUrl: req.originalUrl
      },
      status: "pending"
    });

    // Add to workflow.tasks if the webhook links to a workflow
    if (wh.workflowId) {
      const wf = await Workflow.findById(wh.workflowId);
      if (wf) {
        // add at front so newest show up top (or use push depending on your UX)
        wf.tasks.unshift(task._id);
        await wf.save();
      }
    }

    return res.json({ ok:true, taskId: task._id });
  } catch (err) {
    console.error("receiveWebhook error", err);
    return res.status(500).json({ ok:false, error: "server_error" });
  }
}

module.exports = { receiveWebhook };
