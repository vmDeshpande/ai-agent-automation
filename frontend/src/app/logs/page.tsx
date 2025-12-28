"use client";

import { useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Pause, Play } from "lucide-react";

type LogLevel = "info" | "success" | "warning" | "error";

type Log = {
  _id: string;
  workflowId?: string;
  workflowName?: string;
  message: string;
  level: LogLevel;
  createdAt: string;
};

function getLevelColor(level: LogLevel) {
  switch (level) {
    case "success":
      return "text-success";
    case "error":
      return "text-destructive";
    case "warning":
      return "text-warning";
    case "info":
      return "text-foreground";
    default:
      return "text-muted-foreground";
  }
}

function getLogColor(log: Log) {
  const msg = log.message.toLowerCase();

  if (msg.includes("success=false")) return "text-destructive";
  if (msg.includes("failed")) return "text-destructive";

  if (msg.includes("completed") && msg.includes("success=true")) {
    return "text-success";
  }

  if (msg.includes("executing")) return "text-warning";
  if (msg.includes("claimed")) return "text-cyan-400";
  if (msg.includes("polling")) return "text-muted-foreground";

  return getLevelColor(log.level);
}


function getLogBadge(log: Log) {
  const msg = log.message.toLowerCase();

  if (msg.includes("success=false")) return "FAILED";
  if (msg.includes("failed")) return "FAILED";
  if (msg.includes("completed") && msg.includes("success=true")) return "SUCCESS";
  if (msg.includes("executing")) return "EXEC";
  if (msg.includes("claimed")) return "CLAIMED";
  if (msg.includes("polling")) return "POLL";

  return log.level.toUpperCase();
}



export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [loading, setLoading] = useState(true);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);

  /* auto-scroll */
  useEffect(() => {
    if (isAutoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isAutoScroll]);

  async function fetchLogs() {
    try {
      const res = await fetch("http://localhost:5000/api/logs?limit=200", {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        cache: "no-store", // keep this if you want guaranteed fresh data
      });

      const data = await res.json();

      if (data.ok && Array.isArray(data.logs)) {
        // 🔽 OLDEST → NEWEST (new logs appear at bottom)
        const sortedLogs = [...data.logs].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );

        setLogs(sortedLogs);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }


  /* polling */
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1 pl-64">
          <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">System Logs</h1>
                <p className="mt-2 text-muted-foreground">
                  Real-time workflow execution logs
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsAutoScroll((v) => !v)}
                >
                  {isAutoScroll ? (
                    <Pause className="mr-2 size-4" />
                  ) : (
                    <Play className="mr-2 size-4" />
                  )}
                  {isAutoScroll ? "Pause" : "Resume"} Auto-scroll
                </Button>

                <Button variant="outline">
                  <Download className="mr-2 size-4" />
                  Export Logs
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

              <div className="overflow-y-auto bg-black p-6" style={{ height: "calc(100vh - 300px)" }}>
                <div className="space-y-1 font-mono text-sm">
                  {loading && (
                    <p className="text-muted-foreground">
                      Loading logs…
                    </p>
                  )}

                  {logs.map((log) => (
                    <div
                      key={`${log._id}-${log.createdAt}`}
                      className={getLogColor(log)}
                    >
                      <span className="text-muted-foreground">
                        [{new Date(log.createdAt).toLocaleTimeString()}]
                      </span>

                      <Badge
                        variant="outline"
                        className={`${getLogColor(log)} mx-2 border-current`}
                      >
                        {getLogBadge(log)}
                      </Badge>

                      {log.message}
                    </div>
                  ))}

                  <div ref={logsEndRef} />
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
