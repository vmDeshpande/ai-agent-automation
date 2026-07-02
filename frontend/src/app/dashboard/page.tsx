"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { PageContainer } from "@/components/layout/page-container";
import { MetricCard } from "@/components/ui/metric-card";
import { MetricCardSkeleton, ListSkeleton } from "@/components/ui/skeletons";
import { Activity, Workflow, ListChecks, Bot, Calendar, Copy, Loader2, Check, X, Plus, FileText, Wand2, Link2 } from "lucide-react";
import { useAssistantContext } from "@/context/assistant-context";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

import { AnalyticsSection } from "@/components/dashboard/analytics-section";
import { KPIBar } from "@/components/dashboard/kpi-bar";
import { SystemHealthCard } from "@/components/dashboard/system-health-card";
import { TokenUsageCard } from "@/components/dashboard/token-usage-card";
import { WorkflowsStatusCard } from "@/components/dashboard/workflows-status-card";

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
   Page
------------------------------ */

function DashboardPageInner() {
  const router = useRouter();
  const { addToast } = useToast();
  const { setContext, clearContext } = useAssistantContext();
  
  // Hydration safety fixes restored
  const [now, setNow] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);

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

  const handleCloneWorkflow = async (workflowId: string) => {
    try {
      setCloningId(workflowId);
      
      const token = localStorage.getItem("token");
      
      const response = await fetch(apiUrl(`/workflows/${workflowId}/clone`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to clone workflow");
      }

      const data = await response.json();

      addToast({
        type: "success",
        title: "Workflow Duplicated",
        description: "Successfully cloned the workflow.",
      });

      if (data.workflow?._id) {
        router.push(`/workflows/${data.workflow._id}/builder`);
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      addToast({
        type: "error",
        title: "Error",
        description: "Failed to duplicate the workflow.",
      });
    } finally {
      setCloningId(null);
    }
  };

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
    <PageContainer>
      <div className="flex flex-col gap-6">
        
        {/* Top Row: KPI Bar & System Health */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 flex">
            <KPIBar stats={stats} loading={statsLoading} />
          </div>
          <div className="xl:col-span-4 flex">
            <div className="w-full h-full"><SystemHealthCard /></div>
          </div>
        </div>

        {/* Middle Section */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Left Column Stack */}
          <div className="xl:col-span-8 flex flex-col gap-6">
            <AnalyticsSection stats={stats} loading={statsLoading} />
            <TokenUsageCard />
          </div>

          {/* Right Column Stack */}
          <div className="xl:col-span-4 flex flex-col">
            <Card className="flex-1 flex flex-col border-border/15 bg-card/20 shadow-sm rounded-xl overflow-hidden min-h-[400px]">
              <div className="px-6 py-5 border-b border-border/10">
                <h2 className="text-base font-medium text-foreground/90 tracking-tight">Live Feed</h2>
              </div>
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                {tasksLoading ? (
                  <ListSkeleton rows={5} className="border-none divide-none" />
                ) : recentTasks.length > 0 ? (
                  recentTasks.map((task) => (
                    <div key={task._id} className="flex gap-3 items-start group">
                      <div className="flex flex-col items-center mt-0.5 shrink-0">
                        <div className={cn(
                          "flex items-center justify-center size-5 rounded-full border bg-background shadow-sm",
                          task.status === "completed" ? "text-emerald-500/90 border-emerald-500/20 bg-emerald-500/5" :
                          task.status === "failed" ? "text-destructive/90 border-destructive/20 bg-destructive/5" :
                          "text-amber-500/90 border-amber-500/20 bg-amber-500/5"
                        )}>
                          {task.status === "completed" ? <Check className="size-3" strokeWidth={2.5} /> :
                           task.status === "failed" ? <X className="size-3" strokeWidth={2.5} /> :
                           <Activity className="size-3" strokeWidth={2.5} />}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1 pb-1">
                        <p className="text-sm text-muted-foreground/80 leading-snug">
                          <span className="text-muted-foreground/60 mr-2 text-[11px] font-medium tracking-wider">
                            {new Date(task.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                          </span>
                          <span className="mr-1.5 text-muted-foreground/40">-</span>
                          Workflow <span className="font-medium text-foreground/90 group-hover:text-foreground transition-colors">"{task.name}"</span> {task.status}
                        </p>
                        {task.metadata?.runningBy && (
                          <p className="text-[10px] text-muted-foreground/40 font-mono mt-0.5 tracking-wider">
                            Connection: {task.metadata.runningBy}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-8">
                    <Activity className="size-8 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground/70">No recent activity</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
          
        </div>

        {/* Lower Middle Section: Workflows Status & Recently Modified */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <WorkflowsStatusCard />
          
          <Card className="flex flex-col border-border/15 bg-card/20 shadow-sm rounded-xl overflow-hidden h-full min-h-[300px]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/10">
              <h2 className="text-base font-medium text-foreground/90 tracking-tight">Recently Modified</h2>
              <Link href="/workflows" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                View all
              </Link>
            </div>
            
            <div className="flex-1 p-0 overflow-x-auto">
              <div className="min-w-[400px]">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border/10 bg-muted/10 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  <div className="col-span-7">Workflow Name</div>
                  <div className="col-span-3">Status</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                
                <div className="divide-y divide-border/10">
                  {workflowsLoading ? (
                    <ListSkeleton rows={3} className="border-none divide-none" />
                  ) : workflowsArray.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground/70 text-center">No workflows yet.</div>
                  ) : (
                    workflowsArray.slice(0, 4).map((wf: any) => (
                      <div key={wf._id} className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center group hover:bg-card/40 transition-colors">
                        <div className="col-span-7 flex items-center gap-3">
                          <Workflow className="size-4 text-muted-foreground/50 shrink-0 group-hover:text-primary/70 transition-colors" />
                          <span className="font-medium text-sm text-foreground/80 group-hover:text-foreground transition-colors truncate">{wf.name}</span>
                        </div>
                        <div className="col-span-3">
                          <StatusBadge
                            status={(wf.status || "draft").toLowerCase() as any}
                            variant="subtle"
                            className="uppercase text-[10px] tracking-wider py-0.5 px-2.5 shadow-none border-border/10"
                          >
                            {wf.status || "DRAFT"}
                          </StatusBadge>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCloneWorkflow(wf._id)}
                            disabled={cloningId === wf._id}
                            title="Duplicate Workflow"
                            className="size-8 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted/50 transition-all text-muted-foreground"
                          >
                            {cloningId === wf._id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom Section: Quick Actions */}
        <Card className="flex flex-col border-border/15 bg-card/20 shadow-sm rounded-xl overflow-hidden w-full mb-6">
          <div className="px-6 py-5 border-b border-border/10 flex items-center justify-between">
            <h2 className="text-base font-medium text-foreground/90 tracking-tight">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/10">
            {[
              { title: "New Workflow", desc: "Start from a blank canvas", icon: Plus, href: "/workflows" },
              { title: "Upload Document", desc: "Ingest PDF, TST, or JSON", icon: FileText, href: "/documents" },
              { title: "AI Agent Generator", desc: "Generate agent management", icon: Wand2, href: "/agents" },
              { title: "Manage Connections", desc: "Manage connection tokens", icon: Link2, href: "/settings" }
            ].map((action, i) => (
              <Link href={action.href} key={i} className="group outline-none p-5 hover:bg-card/40 transition-colors flex items-center gap-4">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-background border border-border/20 group-hover:bg-primary/5 group-hover:border-primary/20 transition-colors shrink-0">
                    <action.icon className="size-5 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <p className="text-sm font-medium text-foreground/90 truncate group-hover:text-foreground transition-colors">{action.title}</p>
                    <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5 tracking-wide">{action.desc}</p>
                  </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

export default function DashboardPage() {
  return (
    <AuthenticatedLayout>
      <DashboardPageInner />
    </AuthenticatedLayout>
  );
}