"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Pause,
  Play,
  RefreshCw,
  Terminal,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Activity,
  Bug,
  LayoutList,
  Copy,
  Clock,
  Download,
  AlertCircle
} from "lucide-react";
import { useAssistantContext } from "@/context/assistant-context";
import { apiUrl } from "@/lib/api";

type LogLevel = "debug" | "info" | "success" | "warn" | "error";

type Log = {
  _id: string;
  message: string;
  level: LogLevel;
  workerId?: string;
  workflowId?: string;
  taskId?: string;
  createdAt: string;
  [key: string]: any;
};

function getLevelIcon(level: LogLevel) {
  switch (level) {
    case "success": return <CheckCircle2 className="size-4 text-emerald-500" />;
    case "error": return <AlertCircle className="size-4 text-destructive" />;
    case "warn": return <AlertTriangle className="size-4 text-warning" />;
    case "debug": return <Bug className="size-4 text-zinc-500" />;
    default: return <Info className="size-4 text-blue-400" />;
  }
}

function getLogIcon(log: Log) {
  const msg = log.message.toLowerCase();
  if (msg.includes("failed")) return <AlertCircle className="size-4 text-destructive" />;
  if (msg.includes("completed") && msg.includes("success")) return <CheckCircle2 className="size-4 text-success" />;
  if (msg.includes("executing")) return <Play className="size-4 text-cyan-400" />;
  if (msg.includes("claimed")) return <Activity className="size-4 text-purple-500" />;
  return getLevelIcon(log.level);
}

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
  if (msg.includes("executing")) return "text-cyan-400";
  if (msg.includes("claimed")) return "text-purple-500";
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

function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${Math.max(0, secs)}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getSeverityBorder(log: Log) {
  const msg = log.message.toLowerCase();
  if (msg.includes("failed")) return "border-destructive";
  if (msg.includes("completed") && msg.includes("success")) return "border-emerald-500";
  if (msg.includes("executing")) return "border-cyan-400";
  if (msg.includes("claimed")) return "border-purple-500";
  
  switch (log.level) {
    case "success": return "border-emerald-500";
    case "error": return "border-destructive";
    case "warn": return "border-warning";
    case "debug": return "border-zinc-500";
    default: return "border-zinc-700";
  }
}

function getBadgeBg(log: Log) {
  const msg = log.message.toLowerCase();
  if (msg.includes("failed")) return "bg-destructive/10 text-destructive";
  if (msg.includes("completed") && msg.includes("success")) return "bg-emerald-500/10 text-emerald-500";
  if (msg.includes("executing")) return "bg-cyan-400/10 text-cyan-400";
  if (msg.includes("claimed")) return "bg-purple-500/10 text-purple-500";
  
  switch (log.level) {
    case "success": return "bg-emerald-500/10 text-emerald-500";
    case "error": return "bg-destructive/10 text-destructive";
    case "warn": return "bg-warning/10 text-warning";
    case "debug": return "bg-zinc-500/10 text-zinc-400";
    default: return "bg-zinc-500/10 text-zinc-300";
  }
}

function LogRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 px-4">
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 flex-1" />
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { setContext, clearContext } = useAssistantContext();

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [workflowId, setWorkflowId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

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
      setError("");
      const res = await fetch(apiUrl('/logs?' + buildQuery()), {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not load logs");
      if (Array.isArray(data.logs)) {
        const sorted = [...data.logs].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setLogs(sorted);
      }
    } catch {
      setError("Could not connect to the backend service.");
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
      status: recentErrors.length + ' recent error(s)',
      recentActivity: recentErrors.map((l) => ({
        type: "workflow" as const,
        name: l.message.slice(0, 80),
        status: "error",
      })),
      logsSummary: recentErrors.map((l) => ({
        level: "error",
        message: l.message,
        time: l.createdAt,
      })),
    });
    return () => clearContext();
  }, [loading, logs, setContext, clearContext]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll, viewMode]);

  const hasActiveFilters = search || (level && level !== "all") || workflowId || taskId || startDate || endDate;

  // Derived Metrics
  const totalEvents = logs.length;
  const totalErrors = logs.filter(l => l.level === 'error').length;
  
  // Do not fake executions based on string matching. Use taskId/workflowId presence if it exists.
  const executions = useMemo(() => {
    const tasks = new Set();
    logs.forEach(l => { if (l.taskId) tasks.add(l.taskId); });
    return tasks.size > 0 ? tasks.size : "-";
  }, [logs]);

  const latestActivity = logs.length > 0 ? new Date(logs[logs.length - 1].createdAt).toLocaleTimeString() : "-";

  const selectedLog = logs.find(l => l._id === selectedLogId) || null;

  // Severity Distribution
  const distribution = useMemo(() => {
    if (!totalEvents) return null;
    const counts = { success: 0, info: 0, error: 0, warn: 0, debug: 0 };
    logs.forEach(l => { counts[l.level] = (counts[l.level] || 0) + 1; });
    return counts;
  }, [logs, totalEvents]);

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Activity className="size-8 text-primary" />
              System Observability
            </h1>
            <p className="mt-2 text-muted-foreground">
              Monitor workflow execution, agents, and runtime events.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant={autoScroll ? "default" : "secondary"}
              onClick={() => setAutoScroll((v) => !v)}
              className="shadow-sm"
            >
              {autoScroll ? <Pause className="mr-2 size-4" /> : <Play className="mr-2 size-4" />}
              {autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
            </Button>
            <Button variant="outline" onClick={() => fetchLogs(true)} className="shadow-sm">
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/40 backdrop-blur-md border-white/10 p-4 flex flex-col justify-center">
            <div className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
              <LayoutList className="size-4" /> Total Events
            </div>
            <div className="text-2xl font-bold">{totalEvents || '-'}</div>
          </Card>
          <Card className="bg-card/40 backdrop-blur-md border-white/10 p-4 flex flex-col justify-center">
            <div className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
              <AlertCircle className="size-4" /> Errors
            </div>
            <div className="text-2xl font-bold text-destructive">{totalErrors || '-'}</div>
          </Card>
          <Card className="bg-card/40 backdrop-blur-md border-white/10 p-4 flex flex-col justify-center">
            <div className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
              <Activity className="size-4" /> Executions
            </div>
            <div className="text-2xl font-bold">{executions}</div>
          </Card>
          <Card className="bg-card/40 backdrop-blur-md border-white/10 p-4 flex flex-col justify-center">
            <div className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
              <Clock className="size-4" /> Latest Activity
            </div>
            <div className="text-xl font-bold font-mono">{latestActivity}</div>
          </Card>
        </div>

        {/* Command Bar */}
        <Card className="bg-card/40 backdrop-blur-md border-white/10 p-2">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search events, tasks, workflows..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50 border-none h-10 w-full"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-[140px] h-10 bg-background/50 border-white/5">
                  <SelectValue placeholder="Level" />
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
                className="w-[140px] h-10 bg-background/50 border-white/5 font-mono text-xs"
              />
              <Input
                placeholder="Task ID"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="w-[140px] h-10 bg-background/50 border-white/5 font-mono text-xs"
              />
              
              <div className="flex items-center gap-1 bg-background/50 border border-white/5 rounded-md px-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-auto h-8 bg-transparent border-none px-1 text-xs"
                />
                <span className="text-muted-foreground text-xs">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-auto h-8 bg-transparent border-none px-1 text-xs"
                />
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={resetFilters} className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 px-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">VIEW MODE:</span>
              <div className="flex items-center bg-background/80 rounded-md p-0.5 border border-white/5">
                <button
                  onClick={() => setViewMode("structured")}
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${viewMode === 'structured' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Structured
                </button>
                <button
                  onClick={() => setViewMode("raw")}
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-all flex items-center gap-1.5 ${viewMode === 'raw' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Terminal className="size-3" />
                  Raw Terminal
                </button>
              </div>
            </div>
            
            {hasActiveFilters && (
               <div className="flex items-center gap-2 text-xs">
                 <span className="text-muted-foreground">Active Filters:</span>
                 {search && <Badge variant="secondary" className="font-normal">search: {search}</Badge>}
                 {level !== 'all' && <Badge variant="secondary" className="font-normal">level: {level}</Badge>}
                 {workflowId && <Badge variant="secondary" className="font-normal">workflow: {workflowId.slice(0,6)}...</Badge>}
                 {taskId && <Badge variant="secondary" className="font-normal">task: {taskId.slice(0,6)}...</Badge>}
               </div>
            )}
          </div>
        </Card>

        {/* Activity Timeline */}
        {logs.length > 0 && (
          <div className="py-2 flex items-center justify-center gap-2 overflow-hidden px-4 opacity-70">
            {logs.slice(-20).map((log, idx) => (
               <div key={'timeline-'+idx} className="flex items-center">
                 <div className={`size-2 rounded-full ${log.level === 'error' ? 'bg-destructive' : log.level === 'success' ? 'bg-emerald-500' : 'bg-zinc-500'}`} title={log.message} />
                 {idx < Math.min(logs.length, 20) - 1 && <div className="w-4 sm:w-8 h-[1px] bg-white/10" />}
               </div>
            ))}
          </div>
        )}

        {/* Main Split Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Left Panel: Stream */}
          <Card
            style={{ height: "800px" }}
            className="xl:col-span-2 flex flex-col overflow-hidden bg-card/40 backdrop-blur-md border-white/10"
          >
            <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
               {loading && (
                 <div className="p-4 space-y-1 overflow-y-auto flex-1">
                   {Array.from({ length: 8 }).map((_, i) => <LogRowSkeleton key={i} />)}
                 </div>
               )}

               {!loading && error && (
                 <EmptyState
                   className="h-full border-none"
                   icon={AlertCircle}
                   title="Connection Error"
                   description={error}
                   primaryAction={
                     <Button variant="outline" onClick={() => fetchLogs(true)} className="mt-4">
                       <RefreshCw className="mr-2 size-4"/>Retry
                     </Button>
                   }
                 />
               )}

               {!loading && !error && logs.length === 0 && (
                 <EmptyState
                   className="h-full border-none"
                   icon={Activity}
                   title="No runtime events yet"
                   description={hasActiveFilters ? "No logs match your current filters." : "Run a workflow to generate system activity."}
                 />
               )}

               {!loading && !error && logs.length > 0 && viewMode === "structured" && (
                 <div className="h-full overflow-y-auto flex flex-col divide-y divide-white/5">
                   {logs.map(log => (
                     <button
                       key={log._id}
                       onClick={() => setSelectedLogId(log._id)}
                       className={`flex flex-col gap-3 py-4 pl-4 pr-6 border-b border-white/5 border-l-2 transition-colors text-left relative ${getSeverityBorder(log)} ${selectedLogId === log._id ? 'bg-white/5' : 'hover:bg-white/[0.02]'}`}
                     >
                       <div className="flex items-start justify-between w-full">
                         <div className="flex items-center gap-3">
                           {getLogIcon(log)}
                           <Badge variant="secondary" className={`text-[10px] h-5 px-2 border-none rounded uppercase ${getBadgeBg(log)}`}>
                             {getLogBadge(log)}
                           </Badge>
                           <span className={`text-sm ${log.level === 'error' ? 'text-zinc-100 font-medium' : 'text-zinc-200'}`}>
                             {log.message}
                           </span>
                         </div>
                         <span className="text-xs font-mono text-zinc-500 shrink-0">
                           {timeAgo(log.createdAt)}
                         </span>
                       </div>
                       
                       {(log.workflowId || log.taskId || log.workerId) && (
                         <div className="flex items-center gap-2 pl-7 flex-wrap">
                           {log.workflowId && (
                             <div className="px-2 py-1 rounded bg-[#1e1e1e] text-[#a1a1aa] text-[10px] font-mono border border-white/5">
                               workflow_{log.workflowId.slice(-6)}
                             </div>
                           )}
                           {log.taskId && (
                             <div className="px-2 py-1 rounded bg-[#1e1e1e] text-[#a1a1aa] text-[10px] font-mono border border-white/5">
                               task_{log.taskId.slice(-4)}
                             </div>
                           )}
                           {log.workerId && (
                             <div className="px-2 py-1 rounded bg-[#1e1e1e] text-[#a1a1aa] text-[10px] font-mono border border-white/5">
                               {log.workerId}
                             </div>
                           )}
                         </div>
                       )}
                     </button>
                   ))}
                   <div ref={bottomRef} className="h-8 shrink-0" />
                 </div>
               )}

               {!loading && !error && logs.length > 0 && viewMode === "raw" && (
                 <div className="h-full flex flex-col bg-[#0d0d0d] font-mono overflow-hidden">
                   {/* Terminal Header */}
                   <div className="flex items-center justify-between border-b border-zinc-800 bg-[#151515] px-4 py-2 shrink-0">
                     <div className="flex items-center gap-2">
                       <div className="size-3 rounded-full bg-destructive" />
                       <div className="size-3 rounded-full bg-warning" />
                       <div className="size-3 rounded-full bg-success" />
                     </div>
                     <span className="font-mono text-xs text-muted-foreground">
                       logs.txt
                     </span>
                   </div>
                   <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-1">
                     {logs.map((log) => (
                       <div key={log._id} className={getLogColor(log)}>
                         <span className="text-zinc-600">
                           [{new Date(log.createdAt).toLocaleTimeString()}]
                         </span>
                         <Badge
                           variant="secondary"
                           className={`mx-2 border-none rounded text-[10px] h-4 px-1.5 uppercase ${getBadgeBg(log)}`}
                         >
                           {getLogBadge(log)}
                         </Badge>
                         {log.message}
                       </div>
                     ))}
                     <div ref={bottomRef} className="h-8" />
                   </div>
                 </div>
               )}
            </div>
          </Card>

          {/* Right Panel: Inspector & Severity */}
          <div className="flex flex-col gap-6 xl:col-span-1">
            
            {/* Severity Distribution */}
            <Card className="bg-card/40 backdrop-blur-md border-white/10 p-5 shrink-0">
              <h3 className="text-sm font-semibold mb-4">Severity Distribution</h3>
              {distribution ? (
                <div className="space-y-3">
                  <div className="flex h-2 w-full rounded-full overflow-hidden">
                     <div style={{ width: `${(distribution.success / totalEvents) * 100}%` }} className="bg-emerald-500" />
                     <div style={{ width: `${(distribution.info / totalEvents) * 100}%` }} className="bg-blue-400" />
                     <div style={{ width: `${(distribution.warn / totalEvents) * 100}%` }} className="bg-warning" />
                     <div style={{ width: `${(distribution.error / totalEvents) * 100}%` }} className="bg-destructive" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between"><span className="text-emerald-500">Success</span><span className="font-mono">{distribution.success}</span></div>
                    <div className="flex justify-between"><span className="text-blue-400">Info</span><span className="font-mono">{distribution.info}</span></div>
                    <div className="flex justify-between"><span className="text-warning">Warn</span><span className="font-mono">{distribution.warn}</span></div>
                    <div className="flex justify-between"><span className="text-destructive">Error</span><span className="font-mono">{distribution.error}</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-2">No data available</div>
              )}
            </Card>

            {/* Event Inspector */}
            <Card
              style={{ maxHeight: "800px" }}
              className="bg-card/40 backdrop-blur-md border-white/10 p-0 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 bg-background/30 shrink-0">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Terminal className="size-4 text-primary" />
                  Event Details
                </h3>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {selectedLog ? (
                  <div className="p-5 space-y-6">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1 border-b border-white/5 pb-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Level</span>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          {getLogIcon(selectedLog)}
                          {selectedLog.level.toUpperCase()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 border-b border-white/5 pb-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Timestamp</span>
                        <span className="text-sm font-mono">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col gap-1 border-b border-white/5 pb-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Workflow ID</span>
                        <span className="text-sm font-mono">{selectedLog.workflowId || '-'}</span>
                      </div>
                      <div className="flex flex-col gap-1 border-b border-white/5 pb-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Task ID</span>
                        <span className="text-sm font-mono">{selectedLog.taskId || '-'}</span>
                      </div>
                      <div className="flex flex-col gap-1 border-b border-white/5 pb-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Source</span>
                        <span className="text-sm">{selectedLog.workerId || '-'}</span>
                      </div>
                      <div className="flex flex-col gap-1 pb-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Message</span>
                        <span className="text-sm leading-relaxed">{selectedLog.message}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Raw Payload</span>
                      <div className="bg-[#0a0a0a] rounded-md p-3 border border-zinc-800 overflow-x-auto">
                        <pre className="text-xs text-zinc-300 font-mono">
                          {JSON.stringify(
                            {
                              ...selectedLog,
                              _id: undefined,
                              __v: undefined,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                    <Search className="size-8 mb-3 opacity-20" />
                    <p className="text-sm">Select an event from the stream to inspect runtime details.</p>
                  </div>
                )}
              </div>
            </Card>

          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
