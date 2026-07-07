'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MetricCard } from '@/components/workflow/MetricCard';
import { ExecutionHistoryTable } from '@/components/workflow/ExecutionHistoryTable';
import { WorkflowMetadataCard } from '@/components/workflow/WorkflowMetadataCard';
import { VariablesCard } from '@/components/workflow/VariablesCard';
import { Target, Clock, Activity, Coins, Copy } from 'lucide-react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAssistantContext } from '@/context/assistant-context';
import {
  Play,
  Settings,
  ListChecks,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Circle,
  XCircle,
  Download,
  History,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import VersionHistoryDialog from '@/components/workflow/version-history-dialog';
import ApiSettingsDialog from '@/components/workflow/api-settings-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import type {
  WorkflowPayload as Workflow,
  BackendStep as WorkflowStep,
  WorkflowAgent as Agent,
  NodeDefinition,
} from '@/types/workflow';

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

interface CreateTaskModalProps {
  workflowId: string;
  refreshWorkflow: () => void;
}

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
  stepResults?: StepResult[];
}

// Centralized types imported from @/types/workflow

function getStepIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-5 text-success" />;
    case 'running':
      return <Circle className="size-5 animate-pulse text-warning" />;
    case 'paused':
      return <ShieldCheck className="size-5 text-amber-500 animate-pulse" />;
    case 'failed':
      return <XCircle className="size-5 text-destructive" />;
    default:
      return <Circle className="size-5 text-muted-foreground" />;
  }
}

function getStepColor(status: string) {
  switch (status) {
    case 'completed':
      return 'border-success/50 bg-success/5';
    case 'running':
      return 'border-warning/50 bg-warning/5';
    case 'paused':
      return 'border-amber-500/50 bg-amber-500/5';
    case 'failed':
      return 'border-destructive/50 bg-destructive/5';
    default:
      return 'border-border bg-card';
  }
}

function getTypeColor(type: string) {
  switch ((type || '').toLowerCase()) {
    case 'llm':
      return 'bg-primary/20 text-primary border-primary/30';
    case 'http':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'delay':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'document_query':
    case 'document':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'mcp':
      return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    case 'condition':
    case 'switch':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'parallel':
    case 'join':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    default:
      // All dynamically discovered tool nodes (email, file, browser, github, slack, test_tool, etc.)
      return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
}

/**
 * Schema-driven step description.
 * Finds the node definition by type and returns the first non-empty field values.
 * Falls back gracefully for types not yet loaded.
 */
function getStepDescription(
  step: WorkflowStep,
  nodeDefinitions: NodeDefinition[] = [],
  agentMap: Record<string, string> = {}
): string {
  const lowerType = (step.type || '').toLowerCase();
  const def = nodeDefinitions.find((d) => d.id.toLowerCase() === lowerType);

  if (def && def.fields.length > 0) {
    const parts: string[] = [];
    for (const field of def.fields) {
      let val = step.config?.[field.name] ?? (step as any)[field.name];

      if (val !== undefined && val !== null && String(val).trim() !== '') {
        if (
          (field.name === 'agentId' || field.label.includes('Agent')) &&
          agentMap[val as string]
        ) {
          val = agentMap[val as string];
        }

        const display = String(val).slice(0, 160);
        parts.push(
          `${field.label}: ${display}${display.length < String(val).length ? '\u2026' : ''}`
        );
        if (parts.length >= 2) break;
      }
    }
    return parts.length > 0 ? parts.join(' | ') : `${def.name} — not configured`;
  }

  // Fallback: check common config fields directly
  const config = step.config || {};
  const anyStep = step as any;
  if (config.prompt || anyStep.prompt) return (config.prompt || anyStep.prompt).slice(0, 160);
  if (config.url && config.method) return `${config.method} ${config.url}`;
  if (config.seconds) return `Wait for ${config.seconds} seconds`;

  if (lowerType === 'agent_call') {
    return config.agentId ? 'Delegated' : 'Target agent not set';
  }

  return 'No configuration';
}

export default function WorkflowDetailPage() {
  const { id } = useParams();

  const { setContext } = useAssistantContext();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [latestTask, setLatestTask] = useState<Task | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'pipeline' | 'history'>('pipeline');
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [nodeDefinitions, setNodeDefinitions] = useState<NodeDefinition[]>([]);
  const [apiSettingsOpen, setApiSettingsOpen] = useState<boolean>(false);
  const { addToast } = useToast();

  function getStepStatus(stepId: string): 'pending' | 'completed' | 'failed' | 'paused' {
    if (!latestTask?.stepResults) return 'pending';

    const result = latestTask.stepResults.find((r: StepResult) => r.stepId === stepId);

    if (!result) return 'pending';
    if (result.success === false) return 'failed';
    if (result.requiresApproval && latestTask.status === 'pending_approval') return 'paused';
    if (result.success === true) return 'completed';

    return 'pending';
  }

  /** Fetch workflow details */
  async function fetchWorkflow() {
    try {
      const res = await fetch(apiUrl(`/workflows/${id}`), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();
      if (data.ok) {
        const workflowData = data.workflow;

        // Normalize task IDs
        type TaskRef = string | { _id: string };
        const normalizedTaskIds = (workflowData.tasks ?? []).map((t: TaskRef) =>
          typeof t === 'string' ? t : t._id
        );

        setWorkflow(workflowData);
        const sortedTaskIds = [...normalizedTaskIds].reverse();
        setTasks(sortedTaskIds);

        // Fetch latest task details
        if (sortedTaskIds.length > 0) {
          const taskRes = await fetch(apiUrl(`/tasks/${sortedTaskIds[0]}`), {
            headers: {
              Authorization: 'Bearer ' + localStorage.getItem('token'),
            },
          });

          const taskData = await taskRes.json();
          if (taskData.ok) {
            setLatestTask(taskData.task);
          }
        }

        // Set agent selected state
        if (workflowData.agentId) {
          setSelectedAgent(workflowData.agentId);
        }
      }
    } catch (err) {
      console.error('Error fetching workflow:', err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!workflow) return;

    setContext({
      page: 'workflow-detail',
      workflowId: workflow._id,
      workflowName: workflow.name,
      status: workflow.status,
      agentName: getAgentName(workflow.agentId) || 'No agent',
    });
  }, [workflow]);

  function getAgentName(agentId?: string | null) {
    if (!agentId) return 'No agent';
    return agentMap[agentId] ?? 'Unknown agent';
  }

  /** Fetch all agents */
  async function fetchAgents() {
    try {
      const res = await fetch(apiUrl(`/agents`), {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
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
    } catch (err) {
      console.error('Error loading agents:', err);
    }
  }

  function handleStepSelect(step: WorkflowStep) {
    setContext({
      page: 'workflow-detail',
      workflowId: workflow?._id,
      workflowName: workflow?.name,
      stepId: step.stepId,
      stepName: step.name ?? 'Unnamed step',
      stepType: step.type,
      stepDescription: getStepDescription(step, nodeDefinitions, agentMap),
    });
  }

  /** Assign selected agent */
  async function assignAgent() {
    if (!workflow) {
      console.warn('No workflow selected to assign agent to');
      return;
    }

    try {
      await fetch(apiUrl(`/workflows/${workflow._id}/assign-agent`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({ agentId: selectedAgent }),
      });
      // alert("Agent assigned successfully");
      addToast({
        type: 'success',
        title: 'Agent assigned successfully',
      });
      fetchWorkflow(); // reload UI
    } catch (err) {
      console.error('Error assigning agent:', err);
    }
  }

  function exportWorkflow() {
    if (!workflow) return;

    const template = {
      id: workflow.name.toLowerCase().replace(/\s+/g, '-'),
      name: workflow.name,
      description: workflow.description || '',
      category: 'Custom',
      icon: '⚙️',
      tags: ['workflow'],
      steps:
        workflow.metadata?.steps?.map((step) => {
          const { stepId, ...rest } = step;
          return rest; // remove stepId for template
        }) || [],
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.id}.json`;
    a.click();

    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: 'Workflow exported',
      description: 'Template JSON downloaded successfully',
    });
  }

  /** Load workflow + agents + node definitions */
  useEffect(() => {
    fetchWorkflow();
    fetchAgents();
    // Fetch schema-driven node definitions
    fetch(apiUrl('/workflows/node-definitions'), {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setNodeDefinitions(data.nodeDefinitions || []);
      })
      .catch(console.error);
  }, [id]);
  useEffect(() => {
    if (!latestTask) return;
    if (['completed', 'failed'].includes(latestTask.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/tasks/${latestTask._id}`), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });

        const data = await res.json();
        if (data.ok) {
          setLatestTask(data.task);
        }
      } catch (err) {
        console.error('Polling task failed', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [latestTask]);

  if (loading) return <p>Loading workflow...</p>;
  if (!workflow) return <p>Workflow not found.</p>;

  return (
    <AuthenticatedLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{workflow.name}</h1>
              <Badge
                variant="outline"
                className={
                  workflow.status === 'running'
                    ? 'bg-success/10 text-success border-success/20'
                    : 'bg-muted/10 text-muted-foreground border-border'
                }
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${workflow.status === 'running' ? 'bg-success' : 'bg-muted-foreground'}`}
                  />
                  {workflow.status === 'running' ? 'Active' : 'Idle'}
                </span>
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {workflow.description || 'Workflow pipeline visualization'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {latestTask && (latestTask.status === 'pending' || latestTask.status === 'running') && (
              <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-transparent uppercase text-[10px] tracking-wider py-1 px-2">
                pending
              </Badge>
            )}
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Select Agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent._id} value={agent._id}>
                    {agent.name} ({agent.config?.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={assignAgent} className="h-9">
              <Settings className="mr-2 size-4" />
              Save Agent
            </Button>

            <Link href={`/workflows/${workflow._id}/builder`}>
              <Button variant="outline" className="h-9">
                <Settings className="mr-2 size-4" />
                Configure
              </Button>
            </Link>

            <Button variant="outline" className="h-9" onClick={exportWorkflow}>
              <Download className="mr-2 size-4" />
              Export Workflow
            </Button>

            <Button variant="outline" className="h-9" onClick={() => setApiSettingsOpen(true)}>
              <ShieldCheck className="mr-2 size-4" />
              API
            </Button>
            <Button
              className="h-9"
              onClick={async () => {
                const res = await fetch(apiUrl(`/workflows/${workflow._id}/run`), {
                  method: 'POST',
                  headers: {
                    Authorization: 'Bearer ' + localStorage.getItem('token'),
                  },
                });

                const data = await res.json();
                if (data.ok && data.task) {
                  setLatestTask(data.task);
                  fetchWorkflow();
                }
                addToast({
                  type: 'info',
                  title: 'Workflow started',
                  description: 'Execution is running in background',
                });
              }}
            >
              <Play className="mr-2 size-4 fill-current" />
              Run Now
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="Success Rate"
            value="-"
            icon={Target}
            trend={{ value: '-', isPositive: true }}
          />
          <MetricCard title="Avg. Duration" value="-" icon={Clock} subtitle="seconds" />
          <MetricCard title="Total Runs" value={tasks.length.toString()} icon={Activity} />
          <MetricCard title="Est. Cost" value="-" icon={Coins} subtitle="tokens" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 flex flex-col gap-6" id="execution-history">
            <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-lg border border-border/50">
              <Button
                variant="ghost"
                className={`flex-1 justify-center ${activeView === 'pipeline' ? 'bg-background text-foreground shadow-sm cursor-default' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveView('pipeline')}
              >
                <Settings className="mr-2 size-4" />
                Workflow Pipeline
              </Button>
              <Button
                variant="ghost"
                className={`flex-1 justify-center ${activeView === 'history' ? 'bg-background text-foreground shadow-sm cursor-default' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveView('history')}
              >
                <ListChecks className="mr-2 size-4" />
                Task History
              </Button>
              <Button
                variant="ghost"
                className="flex-1 justify-center text-muted-foreground hover:text-foreground"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="mr-2 size-4" />
                Version History
              </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-2 rounded-xl border border-border/40 bg-card">
              {activeView === 'history' ? (
                <ExecutionHistoryTable taskIds={tasks} />
              ) : (
                <div className="flex flex-col gap-2 p-4">
                  {(workflow.metadata?.steps || []).map((step: WorkflowStep, index: number) => {
                    const status = getStepStatus(step.stepId);
                    const isFailed = status === 'failed';
                    const isCompleted = status === 'completed';
                    return (
                      <div key={step.stepId} className="flex flex-col items-center">
                        <div
                          className={`w-full p-4 rounded-xl border ${isFailed ? 'border-destructive/50 bg-destructive/5' : isCompleted ? 'border-success/50 bg-success/5' : 'border-border bg-card shadow-sm'}`}
                        >
                          <div className="flex items-center gap-3">
                            {getStepIcon(status)}
                            <Badge
                              variant="secondary"
                              className={`${getTypeColor(step.type)} px-2 py-0 text-[10px] uppercase font-mono`}
                            >
                              {step.type || 'unknown'}
                            </Badge>
                            <span className="font-semibold text-foreground">
                              {step.name || step.type || 'Unnamed step'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground pl-[44px]">
                            {getStepDescription(step, nodeDefinitions, agentMap)}
                          </p>
                        </div>
                        {index < (workflow.metadata?.steps?.length || 0) - 1 && (
                          <div className="flex justify-center py-4">
                            <ArrowDown className="text-muted-foreground size-5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(!workflow.metadata?.steps || workflow.metadata.steps.length === 0) && (
                    <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl">
                      No steps configured for this workflow.
                    </div>
                  )}
                </div>
              )}
            </div>

            <Card className="p-0 border-border bg-card shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                  <Activity className="size-3.5" />
                  Trigger Configuration
                </h3>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Webhook Endpoint</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono tracking-widest bg-muted/20"
                  >
                    POST
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-muted/30 border border-border/50 rounded-md p-2 flex-1 font-mono text-xs text-muted-foreground truncate">
                    https://api.workbench.ai/v1/webhooks/workflow/{workflow._id}
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <WorkflowMetadataCard creatorName={undefined} createdAt={undefined} />
            <VariablesCard />
          </div>
        </div>
      </div>

      <VersionHistoryDialog
        workflowId={workflow._id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRollbackSuccess={fetchWorkflow}
      />

      <ApiSettingsDialog
        workflow={workflow}
        open={apiSettingsOpen}
        onOpenChange={setApiSettingsOpen}
        onSaveSuccess={fetchWorkflow}
      />
    </AuthenticatedLayout>
  );
}

/** Task Card Component */
function TaskItem({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<Task | null>(null);

  async function fetchTask(): Promise<void> {
    try {
      const res = await fetch(apiUrl(`/tasks/${taskId}`), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();
      if (data.ok) {
        setTask(data.task as Task);
      }
    } catch (err) {
      console.error('Error fetching task:', err);
    }
  }

  useEffect(() => {
    async function loadTask() {
      await fetchTask();
    }
    loadTask();
  }, [taskId]);

  if (!task) {
    return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary m-4"></div>;
  }

  return (
    <Card className="p-4 shadow-sm flex flex-col gap-1 items-start">
      <h3 className="text-lg font-semibold">{task.name}</h3>
      <p className="text-sm text-muted-foreground">Status: {task.status}</p>

      <Button size="sm" asChild className="mt-3">
        <a href={`/dashboard/tasks/${task._id}`}>View Task</a>
      </Button>
    </Card>
  );
}

/** Modal for creating tasks */
function CreateTaskModal({ workflowId, refreshWorkflow }: CreateTaskModalProps) {
  async function createTask(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const text = (form.elements.namedItem('text') as HTMLTextAreaElement).value;

    const res = await fetch(apiUrl(`/tasks`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
      body: JSON.stringify({
        name,
        workflowId,
        input: { text },
      }),
    });

    const data = await res.json();
    if (data.ok) {
      refreshWorkflow();
      (document.getElementById('createWorkflowTaskModal') as HTMLDialogElement | null)?.close();
    }
  }

  return (
    <dialog
      id="createWorkflowTaskModal"
      className="bg-background text-foreground rounded-lg shadow-lg border border-border p-6 max-w-lg w-full backdrop:bg-black/80"
    >
      <div className="w-full">
        <h3 className="font-bold text-lg">Create Task</h3>

        <form className="space-y-4 mt-4" onSubmit={createTask}>
          <input
            type="text"
            name="name"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Task name"
            required
          />

          <textarea
            name="text"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Task input text (for LLM)"
            required
          />

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                (
                  document.getElementById('createWorkflowTaskModal') as HTMLDialogElement | null
                )?.close()
              }
            >
              Cancel
            </Button>

            <Button type="submit">Create</Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
