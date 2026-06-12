"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Activity, Workflow, ListChecks, Bot, Calendar } from "lucide-react";
import { useAssistantContext } from "@/context/assistant-context";
import { useApi } from "@/hooks/useApi";

/* -----------------------------
   Types
------------------------------ */

type DashboardStats = {
  workflows: number;
  tasks: number;
  runningTasks: number;
  agents: number;
  schedules: number;
};

type Task = {
  _id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  metadata?: {
    runningBy?: string;
  };
};

/* -----------------------------
   Skeleton
------------------------------ */

function StatSkeleton() {
  return (
    <Card className="p-6 animate-pulse">
      <div className="h-10 w-10 rounded-lg bg-muted" />
      <div className="mt-4 space-y-2">
        <div className="h-8 w-20 rounded bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-6 w-16 rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
      </div>
      <div className="h-3 w-16 rounded bg-muted" />
    </div>
  );
}

/* -----------------------------
   Page
------------------------------ */

function DashboardPageInner() {
  const { setContext, clearContext } = useAssistantContext();
  
  // Hydration safety fixes restored
  const [now, setNow] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const { data: stats, loading: statsLoading } = useApi<DashboardStats>("/dashboard/stats");
  const { data: tasks, loading: tasksLoading } = useApi<Task[]>("/tasks");
  const { data: workflowsResponse, loading: workflowsLoading } = useApi<any>("/workflows");

  // Safely extract arrays from backend payload
  const workflowsArray = Array.isArray(workflowsResponse) 
    ? workflowsResponse 
    : (workflowsResponse?.data || workflowsResponse?.workflows || []);

  const recentTasks = useMemo(() => tasks?.slice(0, 8) ?? [], [tasks]);

  /* -----------------------------
     Assistant context
  ------------------------------ */
  useEffect(() => {
    if (!stats || statsLoading) return;

    setContext({
      page: "dashboard",
      dashboardStats: stats,
      recentActivity: recentTasks.slice(0, 5).map((task) => ({
        type: "task",
        name: task.name,
        status: task.status,
      })),
    });

    return () => clearContext();
  }, [stats, recentTasks, statsLoading, setContext, clearContext]);

  /* -----------------------------
     Helpers
  ------------------------------ */
  const timeAgo = useCallback((dateString: string) => {
    if (!now) return "";
    const diff = now - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }, [now]);

  const getStatusColor = useCallback((status: Task["status"]) => {
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
  }, []);

  const statsUI = useMemo(() => [
    { label: "Total Workflows", value: stats?.workflows ?? 0, icon: Workflow },
    { label: "Total Tasks", value: stats?.tasks ?? 0, icon: ListChecks },
    { label: "Running Tasks", value: stats?.runningTasks ?? 0, icon: Activity },
    { label: "Active Agents", value: stats?.agents ?? 0, icon: Bot },
    { label: "Schedules", value: stats?.schedules ?? 0, icon: Calendar },
  ], [stats]);

  /* -----------------------------
     UI
  ------------------------------ */
  if (!isMounted) return null;

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
          <>
            {/* Stats */}
            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
              {stats
                ? statsUI.map((stat) => (
                    <Card key={stat.label} className="p-6">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                        <stat.icon className="size-5 text-primary" />
                      </div>

                      <div className="mt-4">
                        <p className="text-3xl font-bold">{stat.value}</p>
                        <p className="mt-1 text-sm font-medium">{stat.label}</p>
                      </div>
                    </Card>
                  ))
                : Array.from({ length: 5 }).map((_, i) => (
                    <StatSkeleton key={i} />
                  ))}
            </div>

            {/* Split Grid Layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

              {/* Left Side: Workflows */}
              <div className="lg:col-span-2">
                <Card className="p-6">
                  <h2 className="mb-4 text-xl font-semibold">Your Workflows</h2>
                    {workflowsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <ActivitySkeleton key={i} />
                    ))
                  ) : workflowsArray.length === 0 ? (
                    <p className="text-sm text-muted-foreground opacity-70">No workflows yet</p>
                  ) : (
                    <div className="space-y-3">
                      {workflowsArray.slice(0, 5).map((wf: any) => (
                        <div key={wf._id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-accent/50">
                          <p className="font-medium">{wf.name}</p>
                          <Badge className={wf.status === "running" ? "bg-success/20 text-success border-success/30" : "bg-muted text-muted-foreground"}>
                            {wf.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Right Side: Recent Activity */}
              <div className="lg:col-span-1">
                <Card className="p-6">
                  <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>

                  <div className="space-y-3">
                    {tasksLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <ActivitySkeleton key={i} />
                      ))
                    ) : recentTasks.length > 0 ? (
                      recentTasks.map((task) => (
                        <div
                          key={task._id}
                          className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-accent/50"
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
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground opacity-70">
                        No recent activity
                      </p>
                    )}
                  </div>
                </Card>
              </div>
              
            </div>
          </>
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