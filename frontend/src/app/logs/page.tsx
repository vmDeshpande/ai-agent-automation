"use client";

import { useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Pause, Play, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Pause, Play, RefreshCw, Terminal, X } from "lucide-react";
import { useAssistantContext } from "@/context/assistant-context";
import { apiUrl } from "@/lib/api";

type LogLevel = "debug" | "info" | "success" | "warn" | "error";

type Log = {
  _id: string;
  message: string;
  level: LogLevel;
  workflowId?: string;
  taskId?: string;
  createdAt: string;
};

function getLevelColor(level: LogLevel) {
  switch (level) {
    case "success": return "text-success";
    case "error": return "text-destructive";
    case "warn": return "text-warning";
    case "debug": return "text-zinc-500";
    default: return "text-foreground";
  }
}

function getLogColor(log: Log) {
  const msg = log.message.toLowerCase();
  if (msg.includes("failed")) return "text-destructive";
  if (msg.includes("completed") && msg.includes("success")) return "text-success";
  if (msg.includes("executing")) return "text-warning";
  if (msg.includes("claimed")) return "text-cyan-400";
  return getLevelColor(log.level);
}

function getLogBadge(log: Log) {
  const msg = log.message.toLowerCase();
  if (msg.includes("failed")) return "FAILED";
  if (msg.includes("completed") && msg.includes("success")) return "SUCCESS";
  if (msg.includes("executing")) return "EXEC";
  if (msg.includes("claimed")) return "CLAIMED";
  return log.level.toUpperCase();
}
function LogRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-4 flex-1" />
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { setContext, clearContext } = useAssistantContext();

  // Filter state
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [workflowId, setWorkflowId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function buildQuery() {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (search) params.set("search", search);
    if (level && level !== "all") params.set("level", level);
    if (workflowId) params.set("workflowId", workflowId);
    if (taskId) params.set("taskId", taskId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }

  function resetFilters() {
    setSearch("");
    setLevel("all");
    setWorkflowId("");
    setTaskId("");
    setStartDate("");
    setEndDate("");
  }

  async function fetchLogs(showLoader = false) {
    try {
      if (showLoader) setLoading(true);
      const res = await fetch(apiUrl(`/logs?${buildQuery()}`), {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        cache: "no-store",
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.logs)) {
        const sorted = [...data.logs].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setLogs(sorted);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs(true);
    const interval = setInterval(() => fetchLogs(false), 10000);
    return () => clearInterval(interval);
  }, [search, level, workflowId, taskId, startDate, endDate]);

  useEffect(() => {
    if (loading) return;
    const recentErrors = logs.filter((l) => l.level === "error").slice(-5);
    setContext({
      page: "logs",
      logScope: "system",
      status: `${recentErrors.length} recent error(s)`,
      recentActivity: recentErrors.map((l) => ({ type: "workflow" as const, name: l.message.slice(0, 80), status: "error" })),
      logsSummary: recentErrors.map((l) => ({ level: "error", message: l.message, time: l.createdAt })),
    });
    return () => clearContext();
  }, [loading, logs.length]);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll]);

  const hasActiveFilters = search || (level && level !== "all") || workflowId || taskId || startDate || endDate;

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 transition-[padding] duration-300" style={{ paddingLeft: "var(--sidebar-width, 256px)" }}>
          <div className="p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">System Logs</h1>
                <p className="mt-1 text-muted-foreground">Execution and worker events</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setAutoScroll((v) => !v)}>
                  {autoScroll ? <Pause className="mr-2 size-4" /> : <Play className="mr-2 size-4" />}
                  Auto-scroll
                </Button>
                <Button variant="outline" onClick={() => fetchLogs(true)}>
                  <RefreshCw className="mr-2 size-4" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="mb-4 flex flex-wrap gap-3 items-end">
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-52"
              />
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Log Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Workflow ID"
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value)}
                className="w-44"
              />
              <Input
                placeholder="Task ID"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="w-44"
              />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
              {hasActiveFilters && (
                <Button variant="ghost" onClick={resetFilters} className="gap-1">
                  <X className="size-4" /> Reset
                </Button>
              )}
            </div>

            <Card className="overflow-hidden bg-black p-0 border-zinc-800">
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-destructive" />
                  <div className="size-3 rounded-full bg-warning" />
                  <div className="size-3 rounded-full bg-success" />
                </div>
                <span className="font-mono text-xs text-muted-foreground">logs.txt</span>
              </div>

              <div
                className="overflow-y-auto bg-black p-6"
                style={{ height: "calc(100vh - 300px)" }}
              >
                <div className="space-y-1 font-mono text-sm">
                  {loading && (
                    <>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <LogRowSkeleton key={i} />
                      ))}
                      </>
                    )}

                  {!loading && logs.length === 0 && (
                    <Empty className="border-none bg-transparent max-w-md mx-auto py-12">
                      <EmptyHeader>
                        <EmptyMedia className="bg-zinc-900 text-zinc-400">
                          <Terminal className="size-5" />
                        </EmptyMedia>
                        <EmptyTitle className="text-zinc-200">No logs found</EmptyTitle>
                        <EmptyDescription className="text-zinc-500">
                          {hasActiveFilters ? "No logs match your current filters." : "No active job cycles detected."}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                  {logs.length > 0 && (
                    <div className="w-full h-full align-top space-y-1">
                      {logs.map((log) => (
                        <div key={log._id} className={getLogColor(log)}>
                          <span className="text-zinc-600">
                            [{new Date(log.createdAt).toLocaleTimeString()}]
                          </span>
                          <Badge variant="outline" className={`mx-2 border-current text-[10px] h-4 px-1.5 ${getLogColor(log)}`}>
                            {getLogBadge(log)}
                          </Badge>
                          {log.message}
                        </div>
                      ))}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
