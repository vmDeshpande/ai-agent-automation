'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Trash2,
  SearchX,
  Inbox,
  Plus,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Activity,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssistantContext } from '@/context/assistant-context';
import { apiUrl } from '@/lib/api';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { StatusBadge } from '@/components/ui/status-badge';

const PAGE_SIZE = 10;

type Task = {
  _id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'pending_approval' | 'rejected';
  createdAt: string;
  workflowId?: string;
  stepResults: any;

  metadata?: {
    steps?: {
      stepId: string;
      type: string;
    }[];
  };
};

/* -----------------------------
   Skeletons
------------------------------ */

function TableRowSkeleton() {
  return (
    <tr className="border-b border-border/50 animate-pulse bg-card/50">
      <td className="p-4">
        <div className="h-5 w-48 rounded bg-muted mb-2" />
        <div className="h-3 w-32 rounded bg-muted/50" />
      </td>
      <td className="p-4">
        <div className="h-4 w-40 rounded bg-muted" />
      </td>
      <td className="p-4">
        <div className="h-6 w-20 rounded-full bg-muted" />
      </td>
      <td className="p-4">
        <div className="h-4 w-12 rounded bg-muted" />
      </td>
      <td className="p-4">
        <div className="h-4 w-24 rounded bg-muted mb-1" />
        <div className="h-3 w-16 rounded bg-muted/50" />
      </td>
      <td className="p-4">
        <div className="h-8 w-8 rounded bg-muted" />
      </td>
    </tr>
  );
}

export default function TasksPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const { setContext, clearContext } = useAssistantContext();

  async function deleteTask(taskId: string) {
    const confirmed = confirm('Delete this task permanently?');
    if (!confirmed) return;

    try {
      const res = await fetch(apiUrl(`/tasks/${taskId}`), {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();
      if (data.ok) {
        setTasks((prev) => prev.filter((t) => t._id !== taskId));
        addToast({
          type: 'info',
          title: 'Task Deleted Successfully',
          description: 'Your task was deleted successfully',
        });
      }
    } catch (err) {
      console.error('Delete task failed', err);
      addToast({
        type: 'error',
        title: 'Failed to delete task',
        description: 'There was an error deleting the task. Please try again.',
      });
    }
  }

  async function fetchTasks(pageNumber = 1) {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/tasks?page=${pageNumber}&limit=${PAGE_SIZE}`), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();

      if (data.ok) {
        setTasks(data.tasks);

        const total = data.meta?.total ?? 0;
        setTotalCount(total);
        setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks(page);
  }, [page]);

  const filteredTasks = tasks.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    setContext({
      page: 'tasks',
      taskStatus: `${filteredTasks.length} task(s) visible on page ${page} of ${totalPages}`,
      recentActivity: filteredTasks.slice(0, 5).map((t) => ({
        type: 'task',
        name: t.name,
        status: t.status,
      })),
    });

    return () => {
      clearContext();
    };
  }, [page, totalPages, filteredTasks.length, setContext, clearContext]);

  // Derived Metrics for visible tasks
  const visibleTasks = filteredTasks;
  const completedTasks = visibleTasks.filter((t) => t.status === 'completed').length;
  const successRate =
    visibleTasks.length > 0 ? Math.round((completedTasks / visibleTasks.length) * 100) : 0;

  const activeTasks = visibleTasks.filter((t) =>
    ['running', 'pending', 'pending_approval'].includes(t.status)
  ).length;
  const failedTasks = visibleTasks.filter((t) => ['failed', 'rejected'].includes(t.status)).length;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Task Executions</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              View and manage workflow execution history with real-time status tracking and detailed
              step analysis.
            </p>
          </div>
          <Link href="/workflows" passHref>
            <Button
              variant="secondary"
              className="gap-2 bg-background border border-border hover:bg-muted font-semibold"
            >
              <Plus className="size-4" />
              New Workflow
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks by name, ID, or workflow..."
              className="pl-10 bg-card border-border/50 h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-border/50 bg-card h-10" disabled>
              <Filter className="size-4" />
              Filters
            </Button>
            <Button variant="outline" className="gap-2 border-border/50 bg-card h-10" disabled>
              <ArrowUpDown className="size-4" />
              Sort
            </Button>
          </div>
        </div>

        {/* Main Table Card */}
        <Card className="overflow-hidden bg-card/40 border-border/50 flex flex-col min-h-[500px]">
          {loading ? (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="p-4 text-left font-medium text-muted-foreground/70 uppercase text-[11px] tracking-wider">
                      Task ID
                    </th>
                    <th className="p-4 text-left font-medium text-muted-foreground/70 uppercase text-[11px] tracking-wider">
                      Workflow ID
                    </th>
                    <th className="p-4 text-left font-medium text-muted-foreground/70 uppercase text-[11px] tracking-wider">
                      Status
                    </th>
                    <th className="p-4 text-left font-medium text-muted-foreground/70 uppercase text-[11px] tracking-wider">
                      Steps
                    </th>
                    <th className="p-4 text-left font-medium text-muted-foreground/70 uppercase text-[11px] tracking-wider">
                      Time
                    </th>
                    <th className="p-4 text-left font-medium text-muted-foreground/70 uppercase text-[11px] tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <TableRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <Empty className="border-none bg-transparent shadow-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-muted/20">
                    {search ? (
                      <SearchX className="size-8 text-muted-foreground/50" />
                    ) : (
                      <Inbox className="size-8 text-muted-foreground/50" />
                    )}
                  </EmptyMedia>
                  <EmptyTitle className="text-xl">
                    {search ? 'No results found' : 'No task executions yet'}
                  </EmptyTitle>
                  <EmptyDescription className="text-muted-foreground">
                    {search ? (
                      <>
                        We couldn&apos;t find any matches for &quot;
                        <span className="text-foreground">{search}</span>&quot;.
                      </>
                    ) : (
                      'Run a workflow to see its execution history and logs here.'
                    )}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  {search ? (
                    <Button variant="outline" onClick={() => setSearch('')}>
                      Clear search
                    </Button>
                  ) : (
                    <Link href="/workflows" passHref>
                      <Button variant="outline">Go to Workflows</Button>
                    </Link>
                  )}
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/10">
                      <th className="p-4 pl-6 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest whitespace-nowrap">
                        Task ID
                      </th>
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest whitespace-nowrap">
                        Workflow ID
                      </th>
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest whitespace-nowrap">
                        Status
                      </th>
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest whitespace-nowrap">
                        Steps
                      </th>
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest whitespace-nowrap">
                        Time
                      </th>
                      <th className="p-4 pr-6 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredTasks.map((task) => {
                      const completedSteps = Object.keys(task.stepResults || {}).length;
                      const totalSteps = task.metadata?.steps?.length || '-';
                      const dateObj = new Date(task.createdAt);

                      return (
                        <tr key={task._id} className="hover:bg-muted/10 transition-colors group">
                          <td className="p-4 pl-6 align-top">
                            <Link
                              href={`/tasks/${task._id}`}
                              className="inline-flex items-center gap-1.5 font-bold text-foreground hover:text-primary transition-colors line-clamp-1 mb-1"
                            >
                              {task.name}
                              <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                              #{task._id.substring(0, 8)}_T
                            </div>
                          </td>
                          <td className="p-4 align-top">
                            <span className="font-mono text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded">
                              {task.workflowId || 'Unknown'}
                            </span>
                          </td>
                          <td className="p-4 align-top">
                            <StatusBadge status={task.status as any} className="uppercase">
                              {task.status}
                            </StatusBadge>
                          </td>
                          <td className="p-4 align-top">
                            <span className="font-bold text-foreground">{completedSteps}</span>
                            <span className="text-muted-foreground">/{totalSteps}</span>
                          </td>
                          <td className="p-4 align-top">
                            <div className="text-sm font-medium text-foreground/90">
                              {dateObj.toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {dateObj.toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="p-4 pr-6 align-top">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteTask(task._id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/5">
                <div className="text-xs text-muted-foreground font-medium">
                  Showing <span className="text-foreground">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                  <span className="text-foreground">{Math.min(page * PAGE_SIZE, totalCount)}</span>{' '}
                  of <span className="text-foreground">{totalCount}</span> executions
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <span className="text-xs">&lt;</span>
                  </Button>

                  {Array.from({ length: Math.min(3, totalPages) }).map((_, idx) => {
                    // Simple logic for displaying current, prev, next pages
                    let pageNum = page;
                    if (page === 1) pageNum = 1 + idx;
                    else if (page === totalPages && totalPages >= 3) pageNum = totalPages - 2 + idx;
                    else pageNum = page - 1 + idx;

                    if (pageNum > totalPages) return null;

                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? 'default' : 'ghost'}
                        size="icon"
                        className={`size-8 text-xs font-bold ${page === pageNum ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <span className="text-xs">&gt;</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Bottom Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Success Rate */}
          <Card className="bg-card/40 border-border/50 p-6 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div
                className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-muted-foreground"
                title="Based on loaded executions"
              >
                <CheckCircle2 className="size-4" />
                Success Rate
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative z-10">
              <div className="relative size-32 flex items-center justify-center">
                {/* SVG Donut */}
                <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/20"
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-foreground transition-all duration-1000 ease-out"
                    strokeDasharray={`${(successRate / 100) * 251.2} 251.2`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tracking-tighter">{successRate}%</span>
                  <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase mt-1">
                    Completed
                  </span>
                </div>
              </div>
            </div>
            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-32 bg-primary/5 blur-[50px] rounded-full pointer-events-none"></div>
          </Card>

          {/* Average Execution Time (Placeholder/Derivable) */}
          <Card className="bg-card/40 border-border/50 p-6 flex flex-col">
            <div
              className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-muted-foreground mb-6"
              title="Based on loaded executions"
            >
              <Clock className="size-4" />
              Avg Execution Time
            </div>
            <div className="flex-1 flex items-end justify-between gap-2 opacity-50 grayscale pt-4">
              {/* Just structural bars, no fake data values, purely aesthetic structure to match mockup since we don't have historical time */}
              {[40, 70, 30, 80, 50, 90, 60, 100].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-muted-foreground/30 rounded-t-sm"
                  style={{ height: `${h}%` }}
                ></div>
              ))}
            </div>
            <div className="text-center mt-4 text-xs font-medium text-muted-foreground">-</div>
          </Card>

          {/* Active Tasks by Status */}
          <Card className="bg-card/40 border-border/50 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div
                className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-muted-foreground"
                title="Based on loaded executions"
              >
                <Activity className="size-4" />
                Task Status
              </div>
              <span
                className="text-xs font-bold text-foreground"
                title="Based on loaded executions"
              >
                {visibleTasks.length} Total
              </span>
            </div>
            <div className="flex flex-col gap-5 flex-1 justify-center">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Running / Pending
                  </span>
                  <span className="text-[10px] font-bold">{activeTasks}</span>
                </div>
                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{
                      width: visibleTasks.length
                        ? `${(activeTasks / visibleTasks.length) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Completed
                  </span>
                  <span className="text-[10px] font-bold">{completedTasks}</span>
                </div>
                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{
                      width: visibleTasks.length
                        ? `${(completedTasks / visibleTasks.length) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Failed
                  </span>
                  <span className="text-[10px] font-bold">{failedTasks}</span>
                </div>
                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{
                      width: visibleTasks.length
                        ? `${(failedTasks / visibleTasks.length) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
