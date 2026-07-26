import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Filter, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';

interface StepResult {
  stepId: string;
  success?: boolean;
  requiresApproval?: boolean;
  output?: unknown;
  timestamp?: string;
}

interface Task {
  _id: string;
  name: string;
  status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'pending_approval'
    | 'rejected'
    | 'retrying';
  createdAt: string;
  stepResults?: StepResult[];
}

interface ExecutionHistoryTableProps {
  taskIds: string[];
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
          Success
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
          Failed
        </Badge>
      );
    case 'running':
      return (
        <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">
          Running
        </Badge>
      );
    case 'pending_approval':
      return (
        <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20">
          Paused
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground capitalize">
          {status.replace('_', ' ')}
        </Badge>
      );
  }
}

function ExecutionHistoryRow({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTask() {
      try {
        const res = await fetch(apiUrl(`/tasks/${taskId}`), {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
        });
        const data = await res.json();
        if (data.ok) {
          setTask(data.task);
        }
      } catch (err) {
        console.error('Error fetching task:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTask();
  }, [taskId]);

  if (loading) {
    return (
      <tr className="border-b border-border/40">
        <td colSpan={6} className="py-3 px-4 text-sm text-muted-foreground">
          <div className="h-4 w-24 bg-muted/30 animate-pulse rounded"></div>
        </td>
      </tr>
    );
  }

  if (!task) return null;

  // Placeholder for duration since precise step timing isn't available
  const duration = '-';

  // Placeholder for tokens used since it's not tracked
  const tokens = '-';

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="py-3 px-4">
        <div className="text-sm font-medium">{format(new Date(task.createdAt), 'yyyy-MM-dd')}</div>
        <div className="text-xs text-muted-foreground font-mono">
          {format(new Date(task.createdAt), 'HH:mm:ss')}
        </div>
      </td>
      <td className="py-3 px-4">
        <div
          className="text-sm font-mono text-muted-foreground truncate max-w-[120px]"
          title={`exe_${task._id}`}
        >
          exe_{task._id.substring(0, 8)}...{task._id.substring(task._id.length - 3)}
        </div>
      </td>
      <td className="py-3 px-4">{getStatusBadge(task.status)}</td>
      <td className="py-3 px-4 text-sm font-mono text-muted-foreground">{duration}</td>
      <td className="py-3 px-4 text-sm font-mono text-muted-foreground">{tokens}</td>
      <td className="py-3 px-4 text-right">
        <Link href={`/tasks/${task._id}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
          >
            View Details
          </Button>
        </Link>
      </td>
    </tr>
  );
}

export function ExecutionHistoryTable({ taskIds }: ExecutionHistoryTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <h3 className="font-semibold">Execution History</h3>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search logs..."
              className="h-8 pl-8 w-[200px] bg-background/50 text-xs focus-visible:ring-1"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/50"
            aria-label="Filter"
          >
            <Filter className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="py-3 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase w-[140px]">
                Timestamp
              </th>
              <th className="py-3 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Execution ID
              </th>
              <th className="py-3 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Status
              </th>
              <th className="py-3 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Duration
              </th>
              <th className="py-3 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Tokens
              </th>
              <th className="py-3 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {taskIds.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                  No execution history found
                </td>
              </tr>
            ) : (
              taskIds.map((id) => <ExecutionHistoryRow key={id} taskId={id} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
