"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAssistantContext } from "@/context/assistant-context";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  GitFork,
  MoreVertical,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, memo, useCallback, useEffect, useState } from "react";

type Agent = {
  _id: string;
  name: string;
};

interface Workflow {
  _id: string;
  name: string;
  description?: string;
  status: "idle" | "running" | "failed" | "completed";
  agentId?: string;
}

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
    case "running":
      return "bg-success/20 text-success border-success/30";
    case "idle":
      return "bg-muted text-muted-foreground border-border";
    case "failed":
      return "bg-destructive/20 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/* ---------------- Memoized Workflow Card ---------------- */
// Extracted to prevent entire list from re-rendering when one card updates
const WorkflowCard = memo(
  ({
    workflow,
    agentName,
    isCopied,
    onCopy,
    onEdit,
    onDelete,
  }: {
    workflow: Workflow;
    agentName: string;
    isCopied: boolean;
    onCopy: (id: string) => void;
    onEdit: (workflow: Workflow) => void;
    onDelete: (id: string) => void;
  }) => {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link
              href={`/workflows/${workflow._id}`}
              className="text-lg font-semibold hover:text-primary"
            >
              {workflow.name}
            </Link>

            {workflow.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {workflow.description}
              </p>
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
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(workflow);
                  }}
                >
                  Edit Workflow Details
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(workflow._id);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Badge className={getStatusColor(workflow.status)}>
            {workflow.status}
          </Badge>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="size-4" />
            <span>{agentName}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
            {workflow._id.slice(0, 8)}...
          </span>
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
        </div>
      </Card>
    );
  },
);


WorkflowCard.displayName = "WorkflowCard"; 

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<false | "blank" | "template">(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});
  const { addToast } = useToast();
  const { setContext, clearContext } = useAssistantContext();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    const res = await fetch(apiUrl("/agents"), {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const data = await res.json();
    if (data.ok) {
      setAgents(data.agents);

      // 🔥 build fast lookup map
      const map: Record<string, string> = {};
      data.agents.forEach((a: Agent) => {
        map[a._id] = a.name;
      });

      setAgentMap(map);
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/workflows"), {
        headers: {
          Authorization: "Bearer " + (localStorage.getItem("token") ?? ""),
        },
      });

      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error("Failed to fetch workflows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteWorkflow = useCallback(
    async (id: string) => {
      const confirmed = confirm("Delete this workflow? This cannot be undone.");
      if (!confirmed) return;

      try {
        const res = await fetch(apiUrl(`/workflows/${id}`), {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + (localStorage.getItem("token") ?? ""),
          },
        });

        if (!res.ok) {
          addToast({
            type: "error",
            title: "Failed to delete workflow",
            description:
              "There was an error deleting the workflow. Please try again.",
          });
          return;
        }

        addToast({
          type: "success",
          title: "Workflow deleted",
          description: "Your workflow was deleted successfully.",
        });

        fetchWorkflows();
      } catch (err) {
        console.error("Delete failed:", err);
      }
    },
    [addToast, fetchWorkflows],
  );

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const getAgentName = useCallback(
    (agentId?: string | null) => {
      if (!agentId) return "No agent";
      return agentMap[agentId] ?? "Unknown agent";
    },
    [agentMap],
  );

  useEffect(() => {
    if (loading) return;

    setContext({
      page: "workflows",

      recentActivity: workflows.slice(0, 5).map((wf) => ({
        type: "workflow",
        name: wf.name,
        description: wf.description,
        agent: getAgentName(wf.agentId) || "No agent",
        status: wf.status,
      })),
    });

    return () => {
      clearContext();
    };
    // Properly resolving exhaustive-deps by adding stable context setters and callbacks
  }, [loading, workflows, setContext, clearContext, getAgentName]);

  const copyId = useCallback(
    async (id: string) => {
      try {
        await navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        addToast({
          type: "error",
          title: "Failed to copy",
          description: "Could not copy workflow ID to clipboard.",
        });
      }
    },
    [addToast],
  );

  const handleEditWorkflow = useCallback((workflow: Workflow) => {
    setEditingWorkflow(workflow);
  }, []);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />

        <main
          className="flex-1 transition-[padding] duration-300"
          style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
        >
          <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Workflows</h1>
                <p className="mt-2 text-muted-foreground">
                  Manage your AI automation workflows
                </p>
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
                  <DropdownMenuItem onClick={() => setOpen("blank")}>
                    Blank Workflow
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setOpen("template")}>
                    Choose Template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {loading ? (
              <p className="opacity-70">Loading workflows...</p>
            ) : workflows.length === 0 ? (
              <div className="py-12 max-w-2xl mx-auto">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <GitFork />
                    </EmptyMedia>
                    <EmptyTitle>No workflows yet</EmptyTitle>
                    <EmptyDescription>
                      Create your first automated workflow or build from a
                      template configuration to begin setting up agent jobs.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <div className="flex gap-4">
                      <Button onClick={() => setOpen("blank")}>
                        Create Blank Workflow
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setOpen("template")}
                      >
                        Choose Template
                      </Button>
                    </div>
                  </EmptyContent>
                </Empty>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {workflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow._id}
                    workflow={workflow}
                    agentName={getAgentName(workflow.agentId)}
                    isCopied={copiedId === workflow._id}
                    onCopy={copyId}
                    onEdit={handleEditWorkflow}
                    onDelete={handleDeleteWorkflow}
                  />
                ))}
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
      </div>
    </AuthGuard>
  );
}

/* ---------------- Modal ---------------- */

function CreateWorkflowModal({
  mode,
  onOpenChange,
  refresh,
}: {
  mode: false | "blank" | "template";
  onOpenChange: () => void;
  refresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  async function createWorkflow(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value;

    try {
      const res = await fetch(apiUrl("/workflows"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (localStorage.getItem("token") ?? ""),
        },
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) throw new Error("Failed to create workflow");

      addToast({
        type: "success",
        title: "Workflow created",
        description: "Your workflow was created successfully.",
      });

      refresh();
      form.reset();
      onOpenChange();
    } catch (err) {
      console.error("Create workflow failed", err);
      addToast({
        type: "error",
        title: "Failed to create workflow",
        description:
          "There was an error creating the workflow. Please try again.",
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
          <DialogDescription>
            Create a blank workflow or start from a template.
          </DialogDescription>
        </DialogHeader>

        {mode === "blank" && (
          <form onSubmit={createWorkflow} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Workflow name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Daily Report Generator"
                required
              />
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
        {mode === "template" && (
          <TemplateSelector refresh={refresh} close={onOpenChange} />
        )}
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
  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description ?? "");
    }
  }, [workflow]);

  async function save() {
    if (!workflow) return;
    setLoading(true);

    try {
      const res = await fetch(apiUrl(`/workflows/${workflow._id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (localStorage.getItem("token") ?? ""),
        },
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) throw new Error("Update failed");

      addToast({
        type: "success",
        title: "Workflow updated",
      });

      refresh();
      close();
    } catch {
      addToast({
        type: "error",
        title: "Failed to update workflow",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!workflow} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Workflow</DialogTitle>
          <DialogDescription>
            Update the workflow name and description.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Workflow Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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

function TemplateSelector({
  refresh,
  close,
}: {
  refresh: () => void;
  close: () => void;
}) {
  const [templates, setTemplates] = useState<any[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    async function fetchTemplates() {
      const res = await fetch(apiUrl("/templates"), {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });
      const data = await res.json();
      if (data.ok) setTemplates(data.templates);
    }
    fetchTemplates();
  }, []);

  async function applyTemplate(id: string) {
    const res = await fetch(apiUrl(`/templates/import/${id}`), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    if (!res.ok) {
      addToast({
        type: "error",
        title: "Failed to create workflow",
      });
      return;
    }

    addToast({
      type: "success",
      title: "Workflow created from template",
    });

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
              <span className="text-xl">{t.icon ?? "⚙️"}</span>
              {t.name}
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">
              {t.description}
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {t.category && <Badge variant="secondary">{t.category}</Badge>}
              {t.stepsCount && <span>{t.stepsCount} steps</span>}
            </div>
          </div>

          <Button
            size="sm"
            className="mt-4 w-full"
            onClick={() => applyTemplate(t.id)}
          >
            Use Template
          </Button>
        </Card>
      ))}
    </div>
  );
}
