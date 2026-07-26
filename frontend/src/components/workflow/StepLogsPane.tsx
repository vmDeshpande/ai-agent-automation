import { Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import Link from 'next/link';

interface StepLogsPaneProps {
  taskId?: string;
}

export function StepLogsPane({ taskId }: StepLogsPaneProps) {
  const [logSearch, setLogSearch] = useState('');

  const endpoint = taskId ? `/logs?taskId=${taskId}&limit=200` : '/logs?limit=1';
  const { data: logsData, loading: logsLoading } = useApi<{ logs: any[] }>(endpoint);

  const logs = useMemo(() => {
    if (!logsData?.logs) return [];
    let filtered = logsData.logs;
    if (logSearch) {
      filtered = filtered.filter((l) => l.message.toLowerCase().includes(logSearch.toLowerCase()));
    }
    // Reverse so chronologically they appear top-to-bottom if they came sorted newest-first
    return [...filtered].reverse();
  }, [logsData, logSearch]);

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-muted/20 border-b border-border/50 shrink-0">
        <div className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Execution Logs
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="bg-background/50 border border-border/50 rounded-sm text-xs pl-8 pr-3 py-1 h-8 focus:outline-none focus:ring-1 focus:ring-primary/50 w-48"
            />
          </div>
          <Button variant="ghost" size="icon" className="size-8">
            <Download className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 font-mono text-xs bg-[#0a0a0a]">
        {logsLoading ? (
          <div className="text-muted-foreground">Loading logs...</div>
        ) : logs.length > 0 ? (
          logs.map((log) => (
            <div key={log._id} className="flex gap-3 text-muted-foreground">
              <span className="shrink-0">{new Date(log.createdAt).toLocaleTimeString()}</span>
              <span
                className={
                  log.level === 'error'
                    ? 'text-destructive'
                    : log.level === 'warn'
                      ? 'text-amber-500'
                      : log.level === 'success'
                        ? 'text-emerald-500'
                        : 'text-blue-500'
                }
              >
                ●
              </span>
              <span className="text-foreground">{log.message}</span>
            </div>
          ))
        ) : (
          <div className="text-muted-foreground">No detailed logs found for this task.</div>
        )}
      </div>
      <div className="bg-[#0a0a0a] px-4 py-3 border-t border-border/20 text-center shrink-0">
        <Link
          href={`/logs?taskId=${taskId}`}
          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1 transition-colors"
        >
          View full logs &rarr;
        </Link>
      </div>
    </div>
  );
}
