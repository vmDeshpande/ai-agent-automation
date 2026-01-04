"use client";

import { useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Pause, Play, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAssistantContext } from "@/context/assistant-context";

/* -------------------------
   Types
------------------------- */
type LogLevel = "info" | "success" | "warn" | "error";

type Log = {
  _id: string;
  message: string;
  level: LogLevel;
  createdAt: string;
};

/* -------------------------
   Helpers
------------------------- */
function getLevelColor(level: LogLevel) {
  switch (level) {
    case "success":
      return "text-success";
    case "error":
      return "text-destructive";
    case "warn":
      return "text-warning";
    default:
      return "text-foreground";
  }
}

function getLogColor(log: Log) {
  const msg = log.message.toLowerCase();

  if (msg.includes("failed")) return "text-destructive";
  if (msg.includes("completed") && msg.includes("success"))
    return "text-success";
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

/* -------------------------
   Page
------------------------- */
export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const { addToast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const { setContext, clearContext } = useAssistantContext();

  /* -------------------------
     Fetch logs
  ------------------------- */
  async function fetchLogs(showLoader = false) {
    try {
      if (showLoader) setLoading(true);

      const res = await fetch("http://localhost:5000/api/logs?limit=200", {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        cache: "no-store",
      });

      const data = await res.json();

      if (data.ok && Array.isArray(data.logs)) {
        const sorted = [...data.logs].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setLogs(sorted);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------
     Initial load + slow poll
  ------------------------- */
  useEffect(() => {
    fetchLogs(true);

    const interval = setInterval(() => {
      fetchLogs(false);
    }, 10000); // ✅ 10s, not aggressive

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (loading) return;

    const recentErrors = logs.filter((l) => l.level === "error").slice(-5);

    setContext({
      page: "logs",
      logScope: "system",

      status: `${recentErrors.length} recent error(s)`,

      recentActivity: recentErrors.map((l) => ({
        type: "workflow" as const,
        name: l.message.slice(0, 80),
        status: "error",
      })),

      // 🔥 NEW: real debugging signal
      logsSummary: recentErrors.map((l) => ({
        level: l.level,
        message: l.message,
        time: l.createdAt,
      })),
    });

    return () => clearContext();
  }, [loading, logs.length]);

  /* -------------------------
     Auto-scroll
  ------------------------- */
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />

        <main
          className="flex-1 transition-[padding] duration-300"
          style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
        >
          <div className="p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">System Logs</h1>
                <p className="mt-1 text-muted-foreground">
                  Execution and worker events
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setAutoScroll((v) => !v)}
                >
                  {autoScroll ? (
                    <Pause className="mr-2 size-4" />
                  ) : (
                    <Play className="mr-2 size-4" />
                  )}
                  Auto-scroll
                </Button>

                <Button variant="outline" onClick={() => fetchLogs(true)}>
                  <RefreshCw className="mr-2 size-4" />
                  Refresh
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden bg-black p-0">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-destructive" />
                  <div className="size-3 rounded-full bg-warning" />
                  <div className="size-3 rounded-full bg-success" />
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  logs.txt
                </span>
              </div>

              <div
                className="overflow-y-auto bg-black p-6"
                style={{ height: "calc(100vh - 300px)" }}
              >
                <div className="space-y-1 font-mono text-sm">
                  {loading && (
                    <p className="text-muted-foreground">Loading logs…</p>
                  )}

                  {!loading && logs.length === 0 && (
                    <p className="text-muted-foreground">
                      No logs yet. Run a workflow or wait for the worker.
                    </p>
                  )}

                  {logs.map((log) => (
                    <div key={log._id} className={getLogColor(log)}>
                      <span className="text-muted-foreground">
                        [{new Date(log.createdAt).toLocaleTimeString()}]
                      </span>

                      <Badge
                        variant="outline"
                        className={`mx-2 border-current ${getLogColor(log)}`}
                      >
                        {getLogBadge(log)}
                      </Badge>

                      {log.message}
                    </div>
                  ))}

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
