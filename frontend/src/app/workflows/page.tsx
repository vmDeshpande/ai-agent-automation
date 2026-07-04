'use client';

import type { FormEvent } from 'react';
import { useEffect, useState, useCallback, useRef, memo, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { FilterBar } from '@/components/layout/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import { useAssistantContext } from '@/context/assistant-context';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import type { WorkflowPayload as Workflow, WorkflowAgent as Agent } from '@/types/workflow';
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  Download,
  Play,
  Share2,
} from 'lucide-react';

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

function getStatusDescription(status: string) {
  switch (status) {
    case 'idle':
      return 'Workflow is ready to run';
    case 'running':
      return 'Workflow is currently executing';
    case 'failed':
      return 'Workflow execution failed. Check logs for details.';
    case 'completed':
      return 'Workflow ran successfully';
    default:
      return `Workflow is in ${status} state`;
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

function WorkflowDescription({ description }: { description: string }) {
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const updateTruncationState = useCallback(() => {
    const element = descriptionRef.current;

    if (!element) {
      return;
    }

    setIsTruncated(element.scrollHeight > element.clientHeight + 1);
  }, []);

  useEffect(() => {
    updateTruncationState();

    const element = descriptionRef.current;

    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateTruncationState();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [description, updateTruncationState]);

  const descriptionContent = (
    <p ref={descriptionRef} className="mt-2 line-clamp-2 text-sm text-muted-foreground">
      {description}
    </p>
  );

  if (!isTruncated) {
    return descriptionContent;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{descriptionContent}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap text-balance">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

// ---------- WorkflowCard with inline editing, double-click, and copy ID ----------
const HorizontalWorkflowCard = memo(
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
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="group relative"
      >
        <Card className="flex flex-col md:flex-row p-6 gap-6 bg-card hover:bg-accent/5 transition-colors overflow-hidden border-border/50">
          {/* Left Area (Description Block) */}
          <div className="relative w-full md:w-[320px] bg-muted/20 rounded-lg overflow-hidden shrink-0 flex flex-col justify-between border border-border/50 p-5">
            {/* Abstract gradient pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent"></div>
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/40 via-transparent to-transparent"></div>

            <p className="text-[13px] text-muted-foreground line-clamp-4 leading-relaxed relative z-10">
              {workflow.description || 'No description provided.'}
            </p>
            <div className="flex items-center justify-between mt-4 relative z-10">
              {agentName ? (
                <div className="flex items-center gap-1.5 opacity-80 bg-background/50 backdrop-blur-sm rounded-full px-2 py-1 border border-border/30">
                  <Bot className="size-3.5 text-primary/70" />
                  <span className="text-[10px] font-medium tracking-wide text-foreground uppercase">
                    {agentName}
                  </span>
                </div>
              ) : (
                <div />
              )}
              <div className="bg-background/90 backdrop-blur-sm border border-border/50 rounded-full px-1 py-1 flex items-center shadow-sm">
                <StatusBadge status={workflow.status as any} className="uppercase">
                  {workflow.status}
                </StatusBadge>
              </div>
            </div>
          </div>

          {/* Right Area (Details) */}
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-[11px] text-muted-foreground font-mono tracking-wider">
                  ID: {workflow._id.substring(0, 8).toUpperCase()}-WF
                </span>
              </div>

              {/* Title & Description */}
              {isEditing ? (
                <div className="flex items-center gap-2 mb-2">
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
                    className="text-2xl font-bold bg-background border border-input rounded px-2 py-1 flex-1"
                  />
                  {isSaving && <span className="text-sm text-muted-foreground">Saving...</span>}
                </div>
              ) : (
                <div
                  onDoubleClick={() => {
                    setIsEditing(true);
                    setEditName(workflow.name);
                  }}
                  className="flex items-center gap-2 mb-2 group/title"
                >
                  <Link
                    href={`/workflows/${workflow._id}`}
                    className="text-2xl font-bold tracking-tight hover:text-primary transition-colors block truncate"
                  >
                    {workflow.name}
                  </Link>
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditName(workflow.name);
                    }}
                    className="opacity-0 group-hover/title:opacity-100 transition-opacity"
                    aria-label="Edit name"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                  </button>
                </div>
              )}
              {workflow.description ? (
                <WorkflowDescription description={workflow.description} />
              ) : (
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed max-w-2xl">
                  No description provided.
                </p>
              )}
            </div>

            {/* Metrics Row */}
            <div className="flex items-center gap-10 mt-6 pt-6 border-t border-border/30">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                  Success Rate
                </span>
                <span className="text-xl font-bold text-cyan-400">-</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                  Avg Runtime
                </span>
                <span className="text-xl font-bold text-foreground">-</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                  Active Instances
                </span>
                <span className="text-xl font-bold text-fuchsia-400">-</span>
              </div>
            </div>
          </div>

          {/* Action Area (Far Right) */}
          <div className="flex flex-col gap-3 shrink-0 md:pl-6 md:border-l border-border/10 justify-center">
            <Link href={`/workflows/${workflow._id}`}>
              <Button
                variant="secondary"
                size="icon"
                className="size-11 rounded-xl bg-muted/30 hover:bg-primary/20 hover:text-primary transition-colors"
              >
                <Play className="size-5" fill="currentColor" />
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="icon"
              className="size-11 rounded-xl bg-muted/30 hover:bg-muted transition-colors"
              onClick={(e) => {
                e.preventDefault();
                onEdit(workflow);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="size-11 rounded-xl bg-muted/30 hover:bg-muted transition-colors"
              onClick={(e) => {
                e.preventDefault();
                onCopy(workflow._id);
              }}
            >
              <Copy className="size-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-xl hover:bg-muted transition-colors"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(workflow);
                  }}
                >
                  Delete Workflow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      </motion.div>
    );
  }
);

const VerticalWorkflowCard = memo(
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
        onUpdate();
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
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="group relative h-full"
      >
        <Card className="flex flex-col p-5 gap-4 bg-card hover:bg-accent/5 transition-colors overflow-hidden border-border/50 h-full">
          {/* Top Row: Status & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge status={workflow.status as any} className="uppercase">
                {workflow.status}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md hover:bg-muted"
                      onClick={(e) => {
                        e.preventDefault();
                        onCopy(workflow._id);
                      }}
                    >
                      {isCopied ? (
                        <Check className="size-3 text-green-500" />
                      ) : (
                        <Copy className="size-3 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy Workflow ID</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md hover:bg-muted"
                onClick={(e) => {
                  e.preventDefault();
                  onEdit(workflow);
                }}
              >
                <Pencil className="size-3 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md hover:bg-muted text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(workflow);
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>

          {/* Title & ID */}
          <div>
            {isEditing ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => {
                    if (isEditing && !isSaving) handleSave();
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
                  className="text-lg font-bold bg-background border border-input rounded px-2 py-0.5 flex-1"
                />
              </div>
            ) : (
              <Link
                href={`/workflows/${workflow._id}`}
                className="text-lg font-bold tracking-tight hover:text-primary transition-colors block truncate mb-1"
                onDoubleClick={() => {
                  setIsEditing(true);
                  setEditName(workflow.name);
                }}
              >
                {workflow.name}
              </Link>
            )}
            <span className="text-[11px] text-muted-foreground font-mono tracking-wider">
              ID: {workflow._id.substring(0, 8).toUpperCase()}-WF
            </span>
          </div>

          {/* Middle Description Block */}
          <div className="flex-1 flex flex-col gap-2 my-2 py-1 min-h-[120px]">
            <p className="text-[13px] text-muted-foreground line-clamp-4 leading-relaxed">
              {workflow.description || 'No description provided.'}
            </p>
            {agentName && (
              <div className="flex items-center gap-1.5 mt-auto pt-2 opacity-80">
                <Bot className="size-3.5 text-primary/70" />
                <span className="text-[10px] font-medium tracking-wide text-foreground uppercase">
                  {agentName}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Metrics Slots */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="flex flex-col gap-1 bg-muted/10 p-3 rounded-lg border border-border/30">
              <span className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase">
                Runtime
              </span>
              <span className="text-sm font-bold text-foreground">-</span>
            </div>
            <div className="flex flex-col gap-1 bg-muted/10 p-3 rounded-lg border border-border/30">
              <span className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase">
                Success
              </span>
              <span className="text-sm font-bold text-foreground">-</span>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }
);

HorizontalWorkflowCard.displayName = 'HorizontalWorkflowCard';
VerticalWorkflowCard.displayName = 'VerticalWorkflowCard';

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
    <AuthenticatedLayout>
      <>
        <div className="mb-10 flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase flex items-center gap-2 mb-2">
              <span className="text-muted-foreground/60">SYSTEM</span>
              <span className="text-muted-foreground/30">›</span>
              <span className="text-primary/80">WORKFLOWS</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Workflows</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
              Manage your automation engine. Monitor real-time performance, optimize logic branches,
              and scale your agent deployments.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-8">
            <Button
              variant="outline"
              className="bg-transparent border-border/40 hover:bg-muted/10 h-10 px-4"
            >
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              Filter
            </Button>
            <Button
              variant="outline"
              className="bg-transparent border-border/40 hover:bg-muted/10 h-10 px-4"
            >
              <Download className="mr-2 h-4 w-4 text-muted-foreground" />
              Export
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-10">
                  <Plus className="mr-2 size-4" />
                  Create Workflow
                  <ChevronDown className="ml-2 size-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setOpen('blank')}>Blank Workflow</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOpen('template')}>
                  Choose Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
            <FilterBar
              search={
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search workflows..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9 bg-background/50 border-border/40 focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary transition-colors h-10 w-full"
                  />
                </div>
              }
              filters={
                <>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="h-10 rounded-md border border-input/40 bg-background/50 px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 capitalize transition-colors"
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
                    className="h-10 rounded-md border border-input/40 bg-background/50 px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 transition-colors"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </>
              }
            />

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
              <EmptyState
                icon={Search}
                title="No workflows found"
                description={
                  hasActiveFilters
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "You haven't created any workflows yet. Get started by creating your first automation."
                }
                primaryAction={
                  hasActiveFilters ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button onClick={() => setOpen('blank')}>
                      <Plus className="mr-2 size-4" />
                      Create Workflow
                    </Button>
                  )
                }
              />
            ) : (
              <div className="flex flex-col gap-8">
                {/* Running Workflows */}
                {filteredWorkflows.filter((w) => w.status === 'running').length > 0 && (
                  <div className="flex flex-col gap-6">
                    {filteredWorkflows
                      .filter((w) => w.status === 'running')
                      .map((workflow) => (
                        <HorizontalWorkflowCard
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

                {/* Other Workflows */}
                {filteredWorkflows.filter((w) => w.status !== 'running').length > 0 && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredWorkflows
                      .filter((w) => w.status !== 'running')
                      .map((workflow) => (
                        <VerticalWorkflowCard
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
        )}
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
      </>
    </AuthenticatedLayout>
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
