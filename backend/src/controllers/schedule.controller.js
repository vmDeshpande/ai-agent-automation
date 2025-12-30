// src/controllers/schedule.controller.js
const Schedule = require("../models/schedule.model");
const Workflow = require("../models/workflow.model");
const Task = require("../models/task.model");

/**
 * Helpers for responses
 */
function sendOK(res, payload = {}) { return res.json({ ok: true, ...payload }); }
function sendErr(res, code = 500, msg = "server_error") { return res.status(code).json({ ok: false, error: msg }); }

/** Create a schedule */
async function createSchedule(req, res) {
  try {
    const userId = req.user._id;
    const { name, workflowId, cron, timezone, taskInput, taskMetadata, enabled } = req.body;

    if (!name || !workflowId || !cron) return sendErr(res, 400, "missing_fields");

    // verify workflow exists and belongs to user
    const wf = await Workflow.findById(workflowId);
    if (!wf) return sendErr(res, 404, "workflow_not_found");

    const steps = wf.metadata?.steps;
    if (!Array.isArray(steps) || steps.length === 0) {
      return sendErr(res, 400, "workflow_has_no_steps");
    }

    if (wf.userId.toString() !== userId.toString()) return sendErr(res, 403, "forbidden");

    const schedule = await Schedule.create({
      name,
      userId,
      workflowId,
      workflowName : wf.name,
      cron,
      timezone: timezone || "UTC",
      taskInput: taskInput || {},
      taskMetadata: taskMetadata || {},
      enabled: enabled === undefined ? true : !!enabled
    });

    return sendOK(res, { schedule });
  } catch (err) {
    console.error("createSchedule error", err);
    return sendErr(res);
  }
}

/** List schedules for user */
async function listSchedules(req, res) {
  try {
    const userId = req.user._id;
    const schedules = await Schedule.find({ userId }).sort({ createdAt: -1 });
    return sendOK(res, { schedules });
  } catch (err) {
    console.error("listSchedules error", err);
    return sendErr(res);
  }
}

/** Get single schedule */
async function getSchedule(req, res) {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return sendErr(res, 404, "not_found");
    if (schedule.userId.toString() !== req.user._id.toString()) return sendErr(res, 403, "forbidden");
    return sendOK(res, { schedule });
  } catch (err) {
    console.error("getSchedule error", err);
    return sendErr(res);
  }
}

/** Update schedule */
async function updateSchedule(req, res) {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return sendErr(res, 404, "not_found");
    if (schedule.userId.toString() !== req.user._id.toString()) return sendErr(res, 403, "forbidden");

    const updatable = ["name", "cron", "timezone", "taskInput", "taskMetadata", "enabled", "workflowId"];
    for (const k of updatable) {
      if (req.body[k] !== undefined) schedule[k] = req.body[k];
    }

    await schedule.save();
    return sendOK(res, { schedule });
  } catch (err) {
    console.error("updateSchedule error", err);
    return sendErr(res);
  }
}

/** Delete schedule */
async function deleteSchedule(req, res) {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return sendErr(res, 404, "not_found");
    if (schedule.userId.toString() !== req.user._id.toString()) return sendErr(res, 403, "forbidden");

    await schedule.deleteOne();
    return sendOK(res, { message: "schedule_deleted" });
  } catch (err) {
    console.error("deleteSchedule error", err);
    return sendErr(res);
  }
}

module.exports = {
  createSchedule,
  listSchedules,
  getSchedule,
  updateSchedule,
  deleteSchedule
};
