"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Activity, Workflow, ListChecks, Bot, Calendar } from "lucide-react";
import { useAssistantContext } from "@/context/assistant-context";

function DashboardPageInner() {
  const [stats, setStats] = useState<{
    workflows: number;
    tasks: number;
    runningTasks: number;
    agents: number;
    schedules: number;
  } | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { setContext, clearContext } = useAssistantContext();

  function timeAgo(dateString: string) {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  useEffect(() => {
    Promise.all([
      fetch(`http://localhost:5000/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).then((res) => res.json()),

      fetch(`http://localhost:5000/api/tasks`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).then((res) => res.json()),
    ])
      .then(([statsRes, taskRes]) => {
        setStats(statsRes.stats);
        setTasks(taskRes.tasks.slice(0, 8));
        console.log(taskRes.tasks);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const statsUI = [
    {
      label: "Total Workflows",
      value: `${stats?.workflows || 0}`,
      icon: Workflow,
      change: "+3 this week",
    },
    {
      label: "Total Tasks",
      value: `${stats?.tasks || 0}`,
      icon: ListChecks,
      change: "+127 this week",
    },
    {
      label: "Running Tasks",
      value: `${stats?.runningTasks || 0}`,
      icon: Activity,
      change: "Active now",
    },
    {
      label: "Active Agents",
      value: `${stats?.agents || 0}`,
      icon: Bot,
      change: "3 idle",
    },
    {
      label: "Schedules",
      value: `${stats?.schedules || 0}`,
      icon: Calendar,
      change: "4 upcoming",
    },
  ];

  function getStatusColor(status: string) {
    switch (status) {
      case "completed":
        return "bg-success/20 text-success border-success/30";
      case "running":
        return "bg-warning/20 text-warning border-warning/30";
      case "failed":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  }

  useEffect(() => {
    if (!stats) return;

    setContext({
      page: "dashboard",

      dashboardStats: {
        workflows: stats.workflows,
        tasks: stats.tasks,
        runningTasks: stats.runningTasks,
        agents: stats.agents,
        schedules: stats.schedules,
      },

      recentActivity: tasks.slice(0, 5).map((task) => ({
        type: "task",
        name: task.name,
        status: task.status,
      })),
    });

    return () => {
      clearContext();
    };
  }, [stats, tasks]);

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main
        className="flex-1 transition-[padding] duration-300"
        style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
      >
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Overview of your AI automation workflows
            </p>
          </div>
          {loading ? (
            <p className="opacity-70">Loading workflows...</p>
          ) : (
            <>
              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
                {statsUI.map((stat) => (
                  <Card key={stat.label} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                        <stat.icon className="size-5 text-primary" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {stat.change}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Recent Activity</h2>
                    <p className="text-sm text-muted-foreground">
                      Latest workflow executions
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task._id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-4">
                        <Badge className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>

                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.metadata?.runningBy ?? "Unknown Agent"}
                          </p>
                        </div>
                      </div>

                      <span className="text-sm text-muted-foreground">
                        {timeAgo(task.startedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardPageInner />
    </AuthGuard>
  );
}
