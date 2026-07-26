'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Play, RotateCcw, Calendar, AlertTriangle, ListChecks } from 'lucide-react';

type ReplayDialogProps = {
  workflowId: string;
  startNodeId: string;
  startNodeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TaskTrace = {
  _id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'pending_approval' | 'rejected';
  createdAt: string;
  executionMode?: 'standard' | 'partial';
};

export default function ReplayDialog({
  workflowId,
  startNodeId,
  startNodeName,
  open,
  onOpenChange,
}: ReplayDialogProps) {
  const [tasks, setTasks] = useState<TaskTrace[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState<{ message: string; code: string } | null>(
    null
  );
  const { addToast } = useToast();
  const router = useRouter();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    setValidationError(null);
    try {
      const res = await fetch(apiUrl(`/tasks?workflowId=${workflowId}&limit=50`), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load execution runs');
      }

      // Filter out tasks that don't have step results or are incomplete,
      // but showing completed/failed/rejected is generally best for replays.
      setTasks(data.tasks || []);
      if (data.tasks && data.tasks.length > 0) {
        setSelectedTask(data.tasks[0]);
      } else {
        setSelectedTask(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load task runs');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (open && workflowId) {
      fetchTasks();
    }
  }, [open, workflowId, fetchTasks]);

  const handleStartReplay = async () => {
    if (!selectedTask) return;
    setReplayLoading(true);
    setValidationError(null);
    try {
      const res = await fetch(apiUrl(`/workflows/${workflowId}/run-partial`), {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startNodeId,
          parentTaskId: selectedTask._id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === 'workflow_schema_changed') {
          setValidationError({
            code: data.error,
            message:
              data.message ||
              'The workflow schema has changed since the original execution. Please run a full execution to establish a valid baseline context.',
          });
          return;
        }
        throw new Error(data.error || 'Failed to start replay run');
      }

      addToast({
        type: 'success',
        title: 'Replay Run Started',
        description: `Successfully initiated partial run from node: ${startNodeName}`,
      });

      onOpenChange(false);
      // Redirect to the newly created task page to inspect execution
      router.push(`/tasks/${data.task._id}`);
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Replay Failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setReplayLoading(false);
    }
  };

  const getStatusBadgeColor = (status: TaskTrace['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-success/20 text-success border-success/30';
      case 'failed':
      case 'rejected':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'running':
        return 'bg-warning/20 text-warning border-warning/30 animate-pulse';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-0 overflow-hidden bg-background border border-border shadow-2xl rounded-xl">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Partial Replay Run
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select a previous execution run to serve as the upstream context, starting execution
                from node <strong>{startNodeName}</strong> forward.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading execution history...
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="size-10 text-destructive" />
            <p className="font-semibold text-destructive">Error Loading History</p>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchTasks}>
              Try Again
            </Button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6">
            <ListChecks className="size-10 text-muted-foreground/50" />
            <p className="font-semibold text-muted-foreground">No Execution History Available</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Run this workflow fully at least once to capture a baseline execution trace for
              replays.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex divide-x divide-border min-h-0">
            {/* Left Column: Task Runs */}
            <div className="w-[50%] flex flex-col bg-muted/5">
              <div className="px-4 py-2 border-b border-border bg-muted/10">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Previous Run
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {tasks.map((task) => {
                    const isActive = selectedTask?._id === task._id;
                    const dateFormatted = new Date(task.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    });

                    return (
                      <button
                        key={task._id}
                        onClick={() => {
                          setSelectedTask(task);
                          setValidationError(null);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isActive
                            ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                            : 'border-transparent hover:bg-muted text-foreground/80 hover:text-foreground'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm font-semibold truncate flex-1 leading-tight">
                            {task.name}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono leading-none py-0.5 px-1 ${getStatusBadgeColor(task.status)}`}
                          >
                            {task.status}
                          </Badge>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="size-3" />
                            {dateFormatted}
                          </span>
                          {task.executionMode === 'partial' && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                            >
                              Replay
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Right Column: Replay Summary & Actions */}
            <div className="w-[50%] flex flex-col bg-background p-6 justify-between">
              {selectedTask ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Replay Configuration</h3>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Replay Start Node</span>
                        <span className="font-semibold text-primary">{startNodeName}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Parent Task ID</span>
                        <span
                          className="font-mono text-xs text-muted-foreground truncate max-w-[150px]"
                          title={selectedTask._id}
                        >
                          {selectedTask._id}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Baseline Run Status</span>
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs ${getStatusBadgeColor(selectedTask.status)}`}
                        >
                          {selectedTask.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Baseline Timestamp</span>
                        <span className="text-xs">
                          {new Date(selectedTask.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {validationError && (
                      <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1.5 animate-in fade-in duration-200">
                        <div className="flex items-center gap-1 font-bold">
                          <AlertTriangle className="size-4" />
                          <span>Graph Mismatch Detected</span>
                        </div>
                        <p className="leading-relaxed">{validationError.message}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-border flex justify-end">
                    <Button
                      onClick={handleStartReplay}
                      disabled={replayLoading}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5 w-full"
                    >
                      <Play className="size-4 fill-current" />
                      {replayLoading
                        ? 'Initializing Replay...'
                        : `Start Replay from ${startNodeName}`}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground">
                  Select a previous run on the left to configure the replay
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
