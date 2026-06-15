'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppSidebar } from '@/components/app-sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAssistantContext } from '@/context/assistant-context';
import {
  Play,
  Settings,
  ListChecks,
  ArrowRight,
  CheckCircle2,
  Circle,
  XCircle,
  Download,
  History,
} from 'lucide-react';
import VersionHistoryDialog from '@/components/workflow/version-history-dialog';
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
} from '@/types/workflow';

interface CreateTaskModalProps {
  workflowId: string;
  refreshWorkflow: () => void;
}

interface StepResult {
  stepId: string;
  success?: boolean;
  output?: unknown;
  timestamp?: string;
}

interface Task {
  _id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stepResults?: StepResult[];
}

// Centralized types imported from @/types/workflow

function getStepIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-5 text-success" />;
    case 'running':
      return <Circle className="size-5 animate-pulse text-warning" />;
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
    case 'failed':
      return 'border-destructive/50 bg-destructive/5';
    default:
      return 'border-border bg-card';
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'LLM':
      return 'bg-primary/20 text-primary border-primary/30';
    case 'HTTP':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Delay':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Tool':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Document':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function normalizeStepType(type: string) {
  switch (type.toLowerCase()) {
    case 'llm':
      return 'LLM';
    case 'delay':
      return 'Delay';
    case 'http':
      return 'HTTP';
    case 'document_query':
      return 'Document';
    case 'email':
    case 'file':
    case 'browser':
      return 'Tool';
    default:
      return 'Tool';
  }
}

function getStepDescription(step: WorkflowStep) {
  const type = (step.type || '').toLowerCase();

  /* ---------- LLM ---------- */
  if (step.prompt) {
    return step.prompt.slice(0, 160);
  }

  /* ---------- HTTP ---------- */
  if (step.url && step.method) {
    return `${step.method} ${step.url}`;
  }

  /* ---------- DELAY ---------- */
  if (step.seconds) {
    return `Wait for ${step.seconds} seconds`;
  }

  /* ---------- DOCUMENT QUERY ---------- */
  if (type === 'document_query') {
    if (step.query) {
      return `Query: ${step.query.slice(0, 160)}`;
    }
    return 'Document query step';
  }

  /* ---------- EMAIL TOOL ---------- */
  if (type === 'email') {
    const to = step.to || '❌ no recipient';
    const subject = step.subject || 'no subject';

    return `Email → ${to} | Subject: ${subject}`;
  }

  /* ---------- FILE TOOL ---------- */
  if (type === 'file') {
    const action = step.action || 'action';
    const path = step.path || '❌ path not set';

    return `File ${action} | Path: ${path}`;
  }

  /* ---------- BROWSER TOOL ---------- */
  if (type === 'browser') {
    const action = step.action || 'action';
    const url = step.url || '❌ url not set';

    return `Browser ${action} | URL: ${url}`;
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
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const { addToast } = useToast();

  function getStepStatus(stepId: string): 'pending' | 'completed' | 'failed' {
    if (!latestTask?.stepResults) return 'pending';

    const result = latestTask.stepResults.find((r: StepResult) => r.stepId === stepId);

    if (!result) return 'pending';
    if (result.success === false) return 'failed';
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
      stepType: normalizeStepType(step.type),
      stepDescription: getStepDescription(step),
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

  /** Load workflow + agents */
  useEffect(() => {
    fetchWorkflow();
    fetchAgents();
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
    <div className="flex min-h-screen">
      <AppSidebar />
      <main
        className="flex-1 transition-[padding] duration-300"
        style={{ paddingLeft: 'var(--sidebar-width, 256px)' }}
      >
        <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{workflow.name}</h1>
              <p className="mt-2 text-muted-foreground">Workflow pipeline visualization</p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[200px]">
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
              <Button variant="outline" onClick={assignAgent}>
                <Settings className="mr-2 size-4" />
                Save Agent
              </Button>
              <Link href={`/workflows/${workflow._id}/builder`}>
                <Button variant="outline">
                  <Settings className="mr-2 size-4" />
                  Configure
                </Button>
              </Link>
              <Button
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
                <Play className="mr-2 size-4" />
                Run Workflow
              </Button>
            </div>
          </div>

          <div className="mb-6 flex items-center gap-3">
            <Badge
              className={
                workflow.status === 'running' ? 'bg-success/20 text-success border-success/30' : ''
              }
            >
              {workflow.status}
            </Badge>

            <Link href={`/workflows/${workflow._id}/tasks`}>
              <Button variant="outline" size="sm">
                <ListChecks className="mr-2 size-4" />
                View Task History
              </Button>
            </Link>

            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="mr-2 size-4" />
              Version History
            </Button>

            <Button variant="outline" size="sm" onClick={exportWorkflow}>
              <Download className="mr-2 size-4" />
              Export Workflow
            </Button>
          </div>

          <Card className="p-8">
            <h2 className="mb-6 text-xl font-semibold">Workflow Pipeline</h2>
            <div className="space-y-4">
              {workflow.metadata?.steps?.map((step: WorkflowStep, index: number) => {
                const status = getStepStatus(step.stepId);

                return (
                  <div key={step.stepId}>
                    <Card
                      className={`p-6 cursor-pointer ${getStepColor(status)}`}
                      onClick={() => handleStepSelect(step)}
                    >
                      <div className="flex items-start gap-4">
                        {getStepIcon(status)}

                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={getTypeColor(normalizeStepType(step.type))}
                            >
                              {normalizeStepType(step.type)}
                            </Badge>

                            <h3 className="font-semibold">{step.name}</h3>
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {getStepDescription(step)}
                          </p>
                        </div>
                      </div>
                    </Card>

                    {index < (workflow.metadata?.steps?.length ?? 0) - 1 && (
                      <div className="flex justify-center py-2">
                        <ArrowRight className="size-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <VersionHistoryDialog
            workflowId={workflow._id}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            onRollbackSuccess={fetchWorkflow}
          />
        </div>
      </main>
    </div>
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
    return <div className="loading loading-sm"></div>;
  }

  return (
    <div className="card bg-base-200 shadow p-4">
      <h3 className="text-lg font-semibold">{task.name}</h3>
      <p className="text-sm opacity-70">Status: {task.status}</p>

      <a href={`/dashboard/tasks/${task._id}`} className="btn btn-sm btn-primary mt-3">
        View Task
      </a>
    </div>
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
    <dialog id="createWorkflowTaskModal" className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Create Task</h3>

        <form className="space-y-3 mt-4" onSubmit={createTask}>
          <input
            type="text"
            name="name"
            className="input input-bordered w-full"
            placeholder="Task name"
            required
          />

          <textarea
            name="text"
            className="textarea textarea-bordered w-full"
            placeholder="Task input text (for LLM)"
            required
          />

          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() =>
                (
                  document.getElementById('createWorkflowTaskModal') as HTMLDialogElement | null
                )?.close()
              }
            >
              Cancel
            </button>

            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
