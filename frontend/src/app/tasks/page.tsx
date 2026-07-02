'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Trash2, SearchX, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssistantContext } from '@/context/assistant-context';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-success/20 text-success border-success/30';
    case 'running':
      return 'bg-warning/20 text-warning border-warning/30';
    case 'failed':
    case 'rejected':
      return 'bg-destructive/20 text-destructive border-destructive/30';
    case 'pending_approval':
      return 'bg-amber-500/20 text-amber-600 border-amber-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/* -----------------------------
   Skeletons
------------------------------ */

function TableRowSkeleton() {
  return (
    <tr className="border-b border-border animate-pulse">
      <td className="p-4">
        <div className="h-4 w-32 rounded bg-muted" />
      </td>
      <td className="p-4">
        <div className="h-4 w-40 rounded bg-muted" />
      </td>
      <td className="p-4">
        <div className="h-6 w-20 rounded bg-muted" />
      </td>
      <td className="p-4">
        <div className="h-4 w-16 rounded bg-muted" />
      </td>
      <td className="p-4">
        <div className="h-4 w-32 rounded bg-muted" />
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
      // alert("Failed to delete task");
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
  }, [page, totalPages, filteredTasks.length]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main
          className="flex-1 transition-[padding] duration-300"
          style={{ paddingLeft: 'var(--sidebar-width, 256px)' }}
        >
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Task Executions</h1>
              <p className="mt-2 text-muted-foreground">
                View and manage workflow execution history
              </p>
            </div>

            {!loading && tasks.length === 0 ? (
              <div className="py-4 w-full">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox className="size-6" />
                    </EmptyMedia>
                    <EmptyTitle>No tasks yet</EmptyTitle>
                    <EmptyDescription>
                      No tasks yet. Run a workflow to see tasks here.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Link href="/workflows" passHref>
                      <Button className="gap-2">Go to Workflows</Button>
                    </Link>
                  </EmptyContent>
                </Empty>
              </div>
            ) : (
              <>
                <Card className="mb-6 p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search tasks by name..."
                      className="pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </Card>

                <Card className="overflow-hidden">
                  {loading ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                              Task ID
                            </th>
                            <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                              Workflow ID
                            </th>
                            <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                              Status
                            </th>
                            <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                              Steps
                            </th>
                            <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                              Time
                            </th>
                            <th className="p-4 text-left text-sm font-medium text-muted-foreground">
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
                    <div className="p-8 w-full">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <SearchX className="size-6" />
                          </EmptyMedia>
                          <EmptyTitle>No results found</EmptyTitle>
                          <EmptyDescription>
                            We couldn&apos;t find any matches for &quot;{search}&quot;. Check your
                            spelling or try another keyword.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                            Clear search filter
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                                Task ID
                              </th>
                              <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                                Workflow ID
                              </th>
                              <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                                Status
                              </th>
                              <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                                Steps
                              </th>
                              <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                                Time
                              </th>
                              <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTasks.map((task) => {
                              const totalSteps = task.metadata?.steps?.length ?? 0;
                              const executedSteps = task.stepResults?.length ?? 0;

                              return (
                                <tr
                                  key={task._id}
                                  className="border-b border-border transition-colors hover:bg-accent/50"
                                >
                                  <td className="p-4">
                                    <Link
                                      href={`/tasks/${task._id}`}
                                      className="font-mono text-sm text-primary hover:underline"
                                    >
                                      {task.name}
                                    </Link>
                                  </td>

                                  <td className="p-4 text-sm text-muted-foreground">
                                    {task.workflowId ?? '—'}
                                  </td>

                                  <td className="p-4">
                                    <Badge className={getStatusColor(task.status)}>
                                      {task.status}
                                    </Badge>
                                  </td>

                                  <td className="p-4 text-sm text-muted-foreground">
                                    {executedSteps}/{totalSteps}
                                  </td>

                                  <td className="p-4 text-sm text-muted-foreground">
                                    {new Date(task.createdAt).toLocaleString()}
                                  </td>

                                  <td className="p-4">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 text-destructive"
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
                      {totalPages > 1 && (
                        <div className="border-t border-border p-4">
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious
                                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                                />
                              </PaginationItem>

                              {Array.from({ length: totalPages })
                                .slice(0, 5)
                                .map((_, i) => {
                                  const p = i + 1;
                                  return (
                                    <PaginationItem key={p}>
                                      <PaginationLink
                                        isActive={p === page}
                                        onClick={() => setPage(p)}
                                      >
                                        {p}
                                      </PaginationLink>
                                    </PaginationItem>
                                  );
                                })}

                              {totalPages > 5 && (
                                <PaginationItem>
                                  <PaginationLink
                                    onClick={() => {
                                      const input = prompt(`Go to page (1 - ${totalPages})`);
                                      const p = Number(input);
                                      if (p >= 1 && p <= totalPages) setPage(p);
                                    }}
                                  >
                                    …
                                  </PaginationLink>
                                </PaginationItem>
                              )}

                              <PaginationItem>
                                <PaginationNext
                                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
