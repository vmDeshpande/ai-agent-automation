// src/services/schedulerService.js
const cron = require("node-cron");
const Schedule = require("../models/schedule.model");
const Workflow = require("../models/workflow.model");
const Task = require("../models/task.model");
const mongoose = require("mongoose");

const jobs = new Map();

/**
 * Create a DB-backed task for workflow (used by scheduler)
 */
async function createTaskForSchedule(schedule) {
  try {
    const workflow = await Workflow.findById(schedule.workflowId);
    if (!workflow) {
      console.warn("Scheduled workflow not found:", schedule._id);
      return;
    }

    const steps = workflow.metadata?.steps;

    if (!Array.isArray(steps) || steps.length === 0) {
      console.warn(
        "Scheduled workflow has no steps:",
        workflow._id.toString()
      );
      return;
    }

    const task = await Task.create({
      name: `Scheduled Run - ${workflow.name}`,
      workflowId: workflow._id,
      workflowName: workflow.name,
      agentId: workflow.agentId || null,
      userId: schedule.userId,

      // ✅ THIS IS THE FIX
      steps: workflow.metadata?.steps || [],
      currentStep: 0,

      input: schedule.taskInput || {},
      metadata: {
        ...(schedule.taskMetadata || {}),
        scheduledBy: schedule._id.toString(),
        trigger: "schedule"
      },

      status: "pending"
    });


    workflow.tasks = workflow.tasks || [];
    workflow.tasks.push(task._id);
    await workflow.save();

    schedule.lastRunAt = new Date();
    await schedule.save();

    console.log(
      "Scheduler: created task",
      task._id.toString(),
      "for schedule",
      schedule._id.toString()
    );

    return task;
  } catch (err) {
    console.error("createTaskForSchedule error:", err);
  }
}


/**
 * Schedule a single job in memory
 */
function scheduleJob(schedule) {
  if (!schedule || !schedule.enabled) return;

  // If already scheduled, cancel first
  const key = schedule._id.toString();
  if (jobs.has(key)) {
    const j = jobs.get(key);
    j.stop();
    jobs.delete(key);
  }

  try {
    const job = cron.schedule(schedule.cron, async () => {
      console.log("Scheduler trigger:", schedule._id.toString());

      // create a fresh object from DB each trigger, to avoid stale references
      const s = await Schedule.findById(schedule._id);
      if (!s || !s.enabled) {
        console.log("Scheduler: disabled or removed:", schedule._id.toString());
        if (jobs.has(key)) {
          jobs.get(key).stop();
          jobs.delete(key);
        }
        return;
      }

      await createTaskForSchedule(s);
    }, {
      scheduled: schedule.enabled,
      timezone: schedule.timezone || "UTC"
    });

    jobs.set(key, job);
    console.log("Scheduler: job scheduled", key, "cron:", schedule.cron);
    return job;
  } catch (err) {
    console.error("Scheduler: failed to schedule", schedule._id.toString(), err);
  }
}

/**
 * Start the scheduler service: load all enabled schedules and create jobs
 */
async function start() {
  try {
    // ensure DB connected
    if (mongoose.connection.readyState === 0) {
      throw new Error("MongoDB not connected. Start scheduler after DB connect.");
    }

    const schedules = await Schedule.find({ enabled: true });
    console.log("SchedulerService: found", schedules.length, "enabled schedules");
    schedules.forEach((s) => scheduleJob(s));

    // watch DB changes if you want to dynamically add/remove jobs (optional)
    // We'll setup a simple change stream if available to automatically reload schedules when changed.
    try {
      const changeStream = Schedule.watch([], { fullDocument: "updateLookup" });
      changeStream.on("change", (change) => {
        try {
          const doc = change.fullDocument;
          if (!doc) return;
          // on update/create/delete, refresh this specific job
          const id = doc._id.toString();
          if (change.operationType === "delete") {
            if (jobs.has(id)) {
              jobs.get(id).stop();
              jobs.delete(id);
              console.log("SchedulerService: removed job for", id);
            }
          } else {
            // upsert schedule
            console.log("SchedulerService: change detected for schedule", id, "op:", change.operationType);
            if (doc.enabled) scheduleJob(doc);
            else {
              if (jobs.has(id)) {
                jobs.get(id).stop();
                jobs.delete(id);
              }
            }
          }
        } catch (err) {
          console.error("SchedulerService changeStream handler error", err);
        }
      });
    } catch (err) {
      console.warn("SchedulerService: change stream not supported or failed to start. You'll need to restart service to pick up schedule changes.", err.message || err);
    }

  } catch (err) {
    console.error("SchedulerService start error:", err);
    throw err;
  }
}

/**
 * Stop all jobs
 */
function stop() {
  for (const [k, job] of jobs.entries()) {
    try { job.stop(); } catch { }
  }
  jobs.clear();
}

module.exports = { start, stop, scheduleJob, createTaskForSchedule };
