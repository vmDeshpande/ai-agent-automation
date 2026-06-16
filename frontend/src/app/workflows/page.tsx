'use client';

import type { FormEvent } from 'react';
import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import { useAssistantContext } from '@/context/assistant-context';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import type { WorkflowPayload as Workflow, WorkflowAgent as Agent } from '@/types/workflow';
import { Bot, Check, ChevronDown, Copy, MoreVertical, Plus, Pencil } from 'lucide-react';

// ─── Filter Utilities ──────────────────────────────────────────────
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const STATUS_OPTIONS = ['all', 'idle', 'running', 'failed', 'completed'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Recently Created' }, // Renamed to match issue
  { value: 'updated', label: 'Recently Updated' }, // Added new option
  { value: 'oldest', label: 'Oldest first' },
  { value: 'alphabetical', label: 'A → Z' },
];
// ───────────────────────────────────────────────────────────────────

type Template = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  stepsCount?: number;
};

function getStatusColor(status: string) {
  switch (status) {
    case 'running':
      return 'bg-success/20 text-success border-success/30';
    case 'idle':
      return 'bg-muted text-muted-foreground border-border';
    case 'failed':
      return 'bg-destructive/20 text-destructive border-destructive/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getCategoryBadgeClass(category?: string) {
  switch (category?.toLowerCase()) {
    case 'custom':
      return 'bg-violet-100 text-violet-700 border-violet-200';
    case 'productivity':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'automation':
      return 'bg-primary/15 text-primary border-primary/30';
    case 'documentation':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'data':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

// ---------- WorkflowCard with inline editing, double-click, and copy ID ----------
const WorkflowCard = memo(
  ({
    workflow,
    agentName,
    isCopied,
    onCopy,
    onEdit,
    onDelete,
    onUpdate,
    onRenameSuccess,
  }: {
    workflow: Workflow;
    agentName: string;
    isCopied: boolean;
    onCopy: (id: string) => void;
    onEdit: (workflow: Workflow) => void;
    onDelete: (workflow: Workflow) => void;
    onUpdate: () => void;
    onRenameSuccess: (id: string, newName: string) => void;
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(workflow.name);
    const [isSaving, setIsSaving] = useState(false);
    const { addToast } = useToast();

    const handleSave = async () => {
      if (editName.trim() === '') {
        addToast({
          type: 'error',
          title: 'Validation Error',
          description: 'Workflow name cannot be empty.',
        });
        setEditName(workflow.name);
        setIsEditing(false);
        return;
      }
      if (editName === workflow.name) {
        setIsEditing(false);
        return;
      }
      setIsSaving(true);
      try {
        const res = await fetch(apiUrl(`/workflows/${workflow._id}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
          },
          body: JSON.stringify({ name: editName }),
        });
        if (!res.ok) throw new Error('Update failed');
        onUpdate(); // refresh parent
        onRenameSuccess(workflow._id, editName);
        addToast({ type: 'success', title: 'Workflow renamed' });
      } catch (err) {
        console.error(err);
        setEditName(workflow.name);
        addToast({ type: 'error', title: 'Failed to rename workflow' });
      } finally {
        setIsSaving(false);
        setIsEditing(false);
      }
    };

    return (
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="group"
      >
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => {
                      if (isEditing && !isSaving) {
                        handleSave();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSave();
                      } else if (e.key === 'Escape') {
                        setIsEditing(false);
                        setEditName(workflow.name);
                      }
                    }}
                    autoFocus
                    disabled={isSaving}
                    className="text-lg font-semibold bg-background border border-input rounded px-2 py-1 flex-1"
                  />
                  {isSaving && <span className="text-sm text-muted-foreground">Saving...</span>}
                </div>
              ) : (
                <div
                  className="group flex items-center gap-2"
                  onDoubleClick={() => {
                    setIsEditing(true);
                    setEditName(workflow.name);
                  }}
                >
                  <Link
                    href={`/workflows/${workflow._id}`}
                    className="text-lg font-semibold hover:text-primary"
                  >
                    {workflow.name}
                  </Link>
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditName(workflow.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Edit name"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                  </button>
                </div>
              )}
              {workflow.description && (
                <p className="mt-2 text-sm text-muted-foreground">{workflow.description}</p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href={`/workflows/${workflow._id}/builder`}>
                  <DropdownMenuItem>Configure Steps</DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(workflow);
                  }}
                >
                  Edit Workflow Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(workflow);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 overflow-hidden opacity-0 max-h-0 transition-all duration-200 group-hover:opacity-100 group-hover:max-h-24">
            <Button variant="outline" size="sm" onClick={() => onEdit(workflow)}>
              Edit details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(workflow);
              }}
            >
              Delete
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Badge className={getStatusColor(workflow.status)}>{workflow.status}</Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="size-4" />
              <span>{agentName}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
              {workflow._id.slice(0, 8)}...
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    onCopy(workflow._id);
                  }}
                >
                  {isCopied ? (
                    <>
                      <Check className="size-3 text-green-500" />
                      <span className="text-green-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      Copy ID
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy workflow ID</TooltipContent>
            </Tooltip>
          </div>
        </Card>
      </motion.div>
    );
  }
);

WorkflowCard.displayName = 'WorkflowCard';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<false | 'blank' | 'template'>(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});
  const { addToast } = useToast();
  const { setContext, clearContext } = useAssistantContext();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ─── Filter State ───
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const statusFromUrl = searchParams.get('status');

  const statusFilter =
    statusFromUrl && STATUS_OPTIONS.includes(statusFromUrl) ? statusFromUrl : 'all';
  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }

    router.replace(`${pathname}?${params.toString()}`);
  };
  const debouncedQuery = useDebounce(query, 300);

  const fetchAgents = useCallback(async () => {
    const res = await fetch(apiUrl('/agents'), {
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
    });
    const data = await res.json();
    if (data.ok) {
      const map: Record<string, string> = {};
      data.agents.forEach((a: Agent) => {
        map[a._id] = a.name;
      });
      setAgentMap(map);
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/workflows'), {
        headers: {
          Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
        },
      });
      const data = await res.json();

      // POINT 3 FIX: Safely extract array regardless of API wrapper
      const workflowsArray = Array.isArray(data) ? data : data.workflows || data.data || [];

      setWorkflows(workflowsArray);
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteClick = useCallback((workflow: Workflow) => {
    setWorkflowToDelete(workflow);
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const getAgentName = useCallback(
    (agentId?: string | null) => {
      if (!agentId) return 'No agent';
      return agentMap[agentId] ?? 'Unknown agent';
    },
    [agentMap]
  );

  useEffect(() => {
    if (loading) return;
    setContext({
      page: 'workflows',
      recentActivity: workflows.slice(0, 5).map((wf) => ({
        type: 'workflow',
        name: wf.name,
        description: wf.description,
        agent: getAgentName(wf.agentId) || 'No agent',
        status: wf.status,
      })),
    });
    return () => {
      clearContext();
    };
  }, [loading, workflows, setContext, clearContext, getAgentName]);

  const copyId = useCallback(
    async (id: string) => {
      try {
        await navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        addToast({
          type: 'error',
          title: 'Failed to copy',
          description: 'Could not copy workflow ID to clipboard.',
        });
      }
    },
    [addToast]
  );

  const handleEditWorkflow = useCallback((workflow: Workflow) => {
    setEditingWorkflow(workflow);
  }, []);
  const handleRenameSuccess = useCallback((id: string, newName: string) => {
    setEditingWorkflow((prev) => (prev && prev._id === id ? { ...prev, name: newName } : prev));
  }, []);

  // ─── Filter Logic ───
  const filteredWorkflows = useMemo(() => {
    let result = [...workflows];

    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(
        (w) => w.name?.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((w) => w.status === statusFilter);
    }

    result.sort((a, b) => {
      // 1. Handle "Recently Updated" sorting
      if (sortBy === 'updated') {
        // Fallback: If updatedAt is missing, use createdAt. If both missing, use MongoID.
        const updatedA = a.updatedAt
          ? new Date(a.updatedAt).getTime()
          : a.createdAt
            ? new Date(a.createdAt).getTime()
            : parseInt(a._id.substring(0, 8), 16);
        const updatedB = b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : b.createdAt
            ? new Date(b.createdAt).getTime()
            : parseInt(b._id.substring(0, 8), 16);
        return updatedB - updatedA; // Sort descending (newest updates first)
      }

      // 2. Handle standard Created dates (newest/oldest)
      const dateA = a.createdAt
        ? new Date(a.createdAt).getTime()
        : parseInt(a._id.substring(0, 8), 16);
      const dateB = b.createdAt
        ? new Date(b.createdAt).getTime()
        : parseInt(b._id.substring(0, 8), 16);

      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      if (sortBy === 'alphabetical') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

    return result;
  }, [workflows, debouncedQuery, statusFilter, sortBy]);

  const hasActiveFilters = query || statusFilter !== 'all' || sortBy !== 'newest';

  function clearFilters() {
    setQuery('');
    setSortBy('newest');

    const params = new URLSearchParams(searchParams.toString());

    params.delete('status');

    router.replace(`${pathname}?${params.toString()}`);
  }
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main
          className="flex-1 transition-[padding] duration-300"
          style={{ paddingLeft: 'var(--sidebar-width, 256px)' }}
        >
          <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Workflows</h1>
                <p className="mt-2 text-muted-foreground">Manage your AI automation workflows</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="mr-2 size-4" />
                    Create Workflow
                    <ChevronDown className="ml-2 size-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setOpen('blank')}>
                    Blank Workflow
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setOpen('template')}>
                    Choose Template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {/* ─── Control Toolbar ─── */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="relative flex-1">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                      />
                    </svg>
                    <Input
                      type="text"
                      placeholder="Search workflows..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 capitalize"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s === 'all' ? 'All statuses' : s}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Showing {filteredWorkflows.length} of {workflows.length} workflows
                  </span>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-primary hover:underline">
                      Clear filters
                    </button>
                  )}
                </div>

                {/* ─── Filtered Grid or Empty State ─── */}
                {filteredWorkflows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
                    <p className="text-sm font-medium">No workflows found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try adjusting your search or filters.
                    </p>
                    <Button variant="ghost" size="sm" className="mt-4" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredWorkflows.map((workflow) => (
                      <WorkflowCard
                        key={workflow._id}
                        workflow={workflow}
                        agentName={getAgentName(workflow.agentId)}
                        isCopied={copiedId === workflow._id}
                        onCopy={copyId}
                        onEdit={handleEditWorkflow}
                        onDelete={handleDeleteClick}
                        onUpdate={fetchWorkflows}
                        onRenameSuccess={handleRenameSuccess}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <CreateWorkflowModal
          mode={open}
          onOpenChange={() => setOpen(false)}
          refresh={fetchWorkflows}
        />
        <EditWorkflowModal
          workflow={editingWorkflow}
          close={() => setEditingWorkflow(null)}
          refresh={fetchWorkflows}
        />
        <DeleteWorkflowModal
          workflow={workflowToDelete}
          close={() => setWorkflowToDelete(null)}
          refresh={fetchWorkflows}
        />
      </div>
    </AuthGuard>
  );
}

// ---------- Modals (unchanged from upstream) ----------
function CreateWorkflowModal({
  mode,
  onOpenChange,
  refresh,
}: {
  mode: false | 'blank' | 'template';
  onOpenChange: () => void;
  refresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  async function createWorkflow(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
    try {
      const res = await fetch(apiUrl('/workflows'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
        },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error('Failed to create workflow');
      addToast({
        type: 'success',
        title: 'Workflow created',
        description: 'Your workflow was created successfully.',
      });
      refresh();
      form.reset();
      onOpenChange();
    } catch (err) {
      console.error('Create workflow failed', err);
      addToast({
        type: 'error',
        title: 'Failed to create workflow',
        description: 'There was an error creating the workflow. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!mode} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
          <DialogDescription>Create a blank workflow or start from a template.</DialogDescription>
        </DialogHeader>
        {mode === 'blank' && (
          <form onSubmit={createWorkflow} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Workflow name</Label>
              <Input id="name" name="name" placeholder="e.g. Daily Report Generator" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe what this workflow does…"
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={onOpenChange}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                Create Workflow
              </Button>
            </DialogFooter>
          </form>
        )}
        {mode === 'template' && <TemplateSelector refresh={refresh} close={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function EditWorkflowModal({
  workflow,
  close,
  refresh,
}: {
  workflow: Workflow | null;
  close: () => void;
  refresh: () => void;
}) {
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description ?? '');
    }
  }, [workflow]);

  async function save() {
    if (!workflow) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/workflows/${workflow._id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
        },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error('Update failed');
      addToast({ type: 'success', title: 'Workflow updated' });
      refresh();
      close();
    } catch {
      addToast({ type: 'error', title: 'Failed to update workflow' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!workflow} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Workflow</DialogTitle>
          <DialogDescription>Update the workflow name and description.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Workflow Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={loading}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteWorkflowModal({
  workflow,
  close,
  refresh,
}: {
  workflow: Workflow | null;
  close: () => void;
  refresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  async function confirmDelete() {
    if (!workflow) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/workflows/${workflow._id}`), {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + (localStorage.getItem('token') ?? ''),
        },
      });

      if (!res.ok) throw new Error('Delete failed');

      addToast({ type: 'success', title: 'Workflow deleted' });
      refresh();
      close();
    } catch (err) {
      console.error('Delete failed:', err);
      addToast({ type: 'error', title: 'Failed to delete workflow' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={!!workflow}
      onOpenChange={(open) => {
        if (!open && !loading) close();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => loading && e.preventDefault()}
        onPointerDownOutside={(e) => loading && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Delete Workflow</DialogTitle>
          <DialogDescription className="text-foreground mt-4">
            Are you sure you want to delete workflow <strong>&quot;{workflow?.name}&quot;</strong>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateSelector({ refresh, close }: { refresh: () => void; close: () => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    async function fetchTemplates() {
      const res = await fetch(apiUrl('/templates'), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });
      const data = await res.json();
      if (data.ok) setTemplates(data.templates);
    }
    fetchTemplates();
  }, []);

  async function applyTemplate(id: string) {
    const res = await fetch(apiUrl(`/templates/import/${id}`), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
    });
    if (!res.ok) {
      addToast({ type: 'error', title: 'Failed to create workflow' });
      return;
    }
    addToast({ type: 'success', title: 'Workflow created from template' });
    refresh();
    close();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-2">
      {templates.map((t) => (
        <Card
          key={t.id}
          className="p-5 hover:border-primary/40 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span className="text-xl">{t.icon ?? '⚙️'}</span>
              {t.name}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {t.category && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className={getCategoryBadgeClass(t.category)}>
                      {t.category}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">Category: {t.category}</TooltipContent>
                </Tooltip>
              )}
              {t.stepsCount && <span>{t.stepsCount} steps</span>}
            </div>
          </div>
          <Button size="sm" className="mt-4 w-full" onClick={() => applyTemplate(t.id)}>
            Use Template
          </Button>
        </Card>
      ))}
    </div>
  );
}
