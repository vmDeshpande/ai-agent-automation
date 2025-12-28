const Workflow = require("../models/workflow.model");
const Task = require("../models/task.model");
const Agent = require("../models/agent.model");
const Schedule = require("../models/schedule.model");

async function getDashboardStats(req, res) {
  try {
    const userId = req.user._id;

    const [
      workflowCount,
      taskCount,
      runningTaskCount,
      activeAgentCount,
      activeScheduleCount,
    ] = await Promise.all([
      Workflow.countDocuments({ userId }),
      Task.countDocuments({ userId }),
      Task.countDocuments({ userId, status: "running" }),
      Agent.countDocuments({ userId, isActive: true }),
      Schedule.countDocuments({ userId, enabled: true }),
    ]);

    res.json({
      ok: true,
      stats: {
        workflows: workflowCount,
        tasks: taskCount,
        runningTasks: runningTaskCount,
        agents: activeAgentCount,
        schedules: activeScheduleCount,
      },
    });
  } catch (err) {
    console.error("dashboard stats error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

module.exports = { getDashboardStats };
