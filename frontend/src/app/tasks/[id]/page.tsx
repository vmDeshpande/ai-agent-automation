'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";

import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/useApi';
import {
  CheckCircle2,
  XCircle,
  Circle,
  Clock,
  ChevronDown,
  Bot,
  Cpu,
  Thermometer,
  Database,
  ShieldCheck,
  Globe,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAssistantContext } from '@/context/assistant-context';
import { apiUrl } from '@/lib/api';

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

type StepOutput = string | number | boolean | Record<string, unknown> | unknown[] | null;

type StepResult = {
  stepId: string;
  type: string;
  tool?: string;
  output?: StepOutput;
  success: boolean;
  timestamp: string;
  executedBy?: {
    agentId?: string;
    agentName?: string;
    provider?: string;
    model?: string;
  };
};

type TaskMetadataStep = {
  name: string;
  stepId: string;
  type: string;
  prompt?: string;
  method?: string;
  url?: string;
  body?: string;
  seconds?: number;
};

type RetryHistoryItem = {
  attempt: number;
  startedAt: string | null;
  failedAt: string;
  error: string;
  stepResults: StepResult[];
};

type Task = {
  _id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'pending_approval' | 'rejected';
  workflowId?: string;
  agentId?: string;
  createdAt: string;
  steps?: TaskMetadataStep[];

  metadata?: {
    steps?: TaskMetadataStep[];
  };

  stepResults?: StepResult[];
  retryHistory?: RetryHistoryItem[];
  pausedAtStepId?: string;
  approval?: {
    stepId: string;
    requestedAt: string;
    decidedAt?: string;
    decision?: 'approved' | 'rejected';
    feedback?: string;
  };
};

type AgentMemoryItem = {
  type: 'learned' | 'system' | 'interaction';
  content: string;
  confidence?: number;
  createdAt: number;
};

type Agent = {
  _id: string;
  name: string;
  type: string;
  config?: {
    model?: string;
    temperature?: number;
  };
  capabilities?: string[];
  memory?: AgentMemoryItem[];
};

function renderStepOutput(output: StepOutput) {
  if (output === null) return 'null';

  if (typeof output === 'string' || typeof output === 'number' || typeof output === 'boolean') {
    return String(output);
  }

  return JSON.stringify(output, null, 2);
}

export default function TaskDetailPage() {
  const [agent, setAgent] = useState<Agent | null>(null);

  const router = useRouter();
  const { id } = useParams();

  const { data: task, loading, refetch } = useApi<Task>(`/tasks/${id}`);

  useEffect(() => {
    if (task) {
      console.log('FULL TASK OBJECT:', task);
    }
  }, [task]);

  const { addToast } = useToast();
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState('');
  const [isResuming, setIsResuming] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);

  async function handleResumeTask(resumeStepId?: string) {
    if (!task) return;
    setIsResuming(true);
    try {
      const res = await fetch(apiUrl(`/tasks/${task._id}/resume`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({ resumeStepId }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast({
          title: 'Task Resumed',
          description: 'Task execution has been resumed.',
          type: 'success',
        });
        refetch();
      } else {
        throw new Error(data.error || 'Failed to resume task');
      }
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to resume task',
        type: 'error',
      });
    } finally {
      setIsResuming(false);
    }
  }
  async function handleRerunFromFailed() {
    if (!task) return;

    setIsRerunning(true);

    try {
      const res = await fetch(apiUrl(`/tasks/${task._id}/rerun-from-failed`), {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();

      if (data.ok) {
        addToast({
          title: 'Task Created',
          description: 'Rerunning from failed step.',
          type: 'success',
        });

        router.push(`/tasks/${data.task._id}`);
      } else {
        throw new Error(data.error || 'Failed to rerun task');
      }
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to rerun task',
        type: 'error',
      });
    } finally {
      setIsRerunning(false);
    }
  }

  async function handleApprovalDecision(decision: 'approve' | 'reject') {
    if (!task) return;
    setIsSubmittingApproval(true);
    try {
      const res = await fetch(apiUrl(`/tasks/${task._id}/${decision}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({ feedback: approvalFeedback }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast({
          title: decision === 'approve' ? 'Task Approved' : 'Task Rejected',
          description: `Task has been ${decision}d successfully.`,
          type: 'success',
        });
        setApprovalFeedback('');
        refetch();
      } else {
        throw new Error(data.error || 'Failed to submit decision');
      }
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to submit approval decision',
        type: 'error',
      });
    } finally {
      setIsSubmittingApproval(false);
    }
  }

  const { setContext, clearContext } = useAssistantContext();

  function summarizeOutput(output: StepOutput | undefined) {
    if (output === null || output === undefined) return 'no output';

    if (typeof output === 'string') {
      return output.length > 300 ? output.slice(0, 300) + '…' : output;
    }

    try {
      const json = JSON.stringify(output);
      return json.length > 300 ? json.slice(0, 300) + '…' : json;
    } catch {
      return 'unreadable output';
    }
  }

  useEffect(() => {
    const agentId = task?.agentId;
    if (!agentId) return;

    let cancelled = false;

    async function loadAgent() {
      try {
        const res = await fetch(apiUrl(`/agents/${agentId}`), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });

        const data = await res.json();
        if (data.ok && !cancelled) setAgent(data.agent);
      } catch (err) {
        console.error('Failed to fetch agent', err);
      }
    }

    loadAgent();

    return () => {
      cancelled = true;
    };
  }, [task?.agentId]);

  // Poll while running
  useEffect(() => {
    if (!task) return;
    if (['completed', 'failed', 'rejected'].includes(task.status)) return;
    if (task.status === 'pending_approval') return; // Stop polling while waiting for human

    const interval = setInterval(() => {
      refetch();
      // refetch({ silent: true });
    }, 2000);

    return () => clearInterval(interval);
  }, [task?.status, refetch]);

  useEffect(() => {
    if (!task) return;

    const stepsMeta = task.steps ?? task.metadata?.steps ?? [];

    const summarizedSteps = (task.stepResults ?? []).map((result) => {
      const meta = stepsMeta.find((s) => s.stepId === result.stepId);

      return {
        stepId: result.stepId,
        name: meta?.name ?? result.stepId,
        type: result.type,
        success: result.success,
        outputSummary: summarizeOutput(result.output),
      };
    });

    const failedStep = summarizedSteps.find((s) => s.success === false);

    setContext({
      page: 'task-detail',

      taskId: task._id,
      taskName: task.name,
      taskStatus: task.status,
      workflowId: task.workflowId,

      agentName: agent?.name,
      model: agent?.config?.model,

      failedStep: failedStep
        ? {
            stepId: failedStep.stepId,
            name: failedStep.name,
            type: failedStep.type,
            output: failedStep.outputSummary,
          }
        : undefined,

      status:
        task.status === 'failed'
          ? `Failed at step "${failedStep?.name ?? 'unknown'}"`
          : task.status,

      recentActivity: summarizedSteps.map((s) => ({
        type: 'task',
        name: s.name,
        status: s.success ? 'completed' : 'failed',
      })),

      logScope: 'task',
    });
  }, [task?._id, task?.status, task?.stepResults?.length, agent?._id]);

  if (loading) return <p>Loading task...</p>;
  if (!task) return <p>Task not found.</p>;
  const totalSteps = task.metadata?.steps?.length ?? 0;
  const executedSteps = task.stepResults?.length ?? 0;
  const stepResults = task.stepResults ?? [];
  return (
    <AuthenticatedLayout>
      <>
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <h1 className="font-mono text-2xl font-bold">{task.name}</h1>
                <Badge
                  className={
                    task.status === 'completed'
                      ? 'bg-success/20 text-success border-success/30'
                      : task.status === 'failed' || task.status === 'rejected'
                        ? 'bg-destructive/20 text-destructive border-destructive/30'
                        : task.status === 'pending_approval'
                          ? 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                          : task.status === 'running'
                            ? 'bg-warning/20 text-warning border-warning/30'
                            : 'bg-muted text-muted-foreground'
                  }
                >
                  {task.status}
                </Badge>
                {['failed', 'retrying', 'rejected'].includes(task.status) && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResumeTask()}
                      disabled={isResuming}
                      className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                    >
                      {isResuming ? 'Resuming...' : 'Resume Execution'}
                    </Button>

                    {task.status === 'failed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRerunFromFailed}
                        disabled={isRerunning}
                        className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                      >
                        <RotateCcw className="mr-2 size-4" />
                        {isRerunning ? 'Creating...' : 'Rerun from Failed'}
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="mt-2 text-muted-foreground">Workflow id: {task.workflowId}</p>
              {(task.metadata as any)?.trigger === 'workflow_api' && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground bg-muted/30 border border-border/50 rounded-lg p-3 w-fit">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Globe className="size-4 text-primary" />
                    Triggered By:
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    Workflow API
                  </Badge>
                  {(task.metadata as any)?.sourceWorkflowId && (
                    <span className="text-xs">
                      Called from Workflow:{' '}
                      <Link
                        href={`/workflows/${(task.metadata as any).sourceWorkflowId}`}
                        className="text-primary hover:underline font-mono font-semibold"
                      >
                        {(task.metadata as any).sourceWorkflowName ||
                          (task.metadata as any).sourceWorkflowId}
                      </Link>
                    </span>
                  )}
                  {(task.metadata as any)?.sourceTaskId && (
                    <span className="text-xs text-muted-foreground border-l pl-2">
                      Task:{' '}
                      <Link
                        href={`/tasks/${(task.metadata as any).sourceTaskId}`}
                        className="text-primary hover:underline font-mono"
                      >
                        {(task.metadata as any).sourceTaskId.slice(-6).toUpperCase()}
                      </Link>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card className="p-6">
                  <h2 className="mb-6 text-xl font-semibold">
                    Execution Timeline ({executedSteps}/{totalSteps})
                  </h2>

                  {/* HITL Approval Card */}
                  {task.status === 'pending_approval' && task.approval && (
                    <Card className="mb-6 border-amber-500/30 bg-amber-500/5 p-4">
                      <div className="flex items-start gap-4">
                        <div className="rounded-full bg-amber-500/20 p-2">
                          <ShieldCheck className="size-6 text-amber-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-amber-600 dark:text-amber-500">
                            Human Approval Required
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            The workflow is paused at step{' '}
                            <span className="font-mono font-bold text-foreground">
                              {task.metadata?.steps?.find((s) => s.stepId === task.pausedAtStepId)
                                ?.name || task.pausedAtStepId}
                            </span>
                            . Please review the execution up to this point and approve or reject to
                            continue.
                          </p>

                          <div className="mt-4">
                            <label className="mb-2 block text-xs font-medium text-muted-foreground">
                              Feedback / Notes (Optional)
                            </label>
                            <Textarea
                              placeholder="Add any notes for the audit log..."
                              value={approvalFeedback}
                              onChange={(e) => setApprovalFeedback(e.target.value)}
                              className="min-h-[80px] bg-background text-sm"
                            />
                          </div>

                          <div className="mt-4 flex items-center gap-3">
                            <Button
                              onClick={() => handleApprovalDecision('approve')}
                              disabled={isSubmittingApproval}
                              className="bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700"
                            >
                              Approve & Continue
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleApprovalDecision('reject')}
                              disabled={isSubmittingApproval}
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                              Reject & Stop
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Retry History List */}
                  {task.retryHistory && task.retryHistory.length > 0 && (
                    <div className="mb-6 space-y-3">
                      {task.retryHistory.map((history, hIndex) => (
                        <Collapsible
                          key={hIndex}
                          className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"
                        >
                          <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
                            <div className="flex items-center gap-3">
                              <XCircle className="size-4 text-destructive" />
                              <div>
                                <span className="font-mono text-sm font-semibold text-destructive">
                                  Attempt #{history.attempt} - Failed
                                </span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {history.error} • {new Date(history.failedAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-4 pl-7 border-t border-border/50 pt-3 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              Historical Step Timeline:
                            </p>
                            {history.stepResults?.map((step, sIndex) => {
                              const stepsMeta = task.steps ?? task.metadata?.steps ?? [];
                              const stepMetadata = stepsMeta.find((s) => s.stepId === step.stepId);
                              return (
                                <div key={sIndex} className="flex items-start gap-3 text-xs">
                                  {step.success ? (
                                    <CheckCircle2 className="size-4 text-success mt-0.5" />
                                  ) : (
                                    <XCircle className="size-4 text-destructive mt-0.5" />
                                  )}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {stepMetadata?.name || step.stepId}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                                        {step.type}
                                      </Badge>
                                    </div>
                                    {step.output && (
                                      <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-background p-2 font-mono text-[10px] text-muted-foreground border">
                                        {typeof step.output === 'string'
                                          ? step.output
                                          : JSON.stringify(step.output, null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    {stepResults.map((step: StepResult, index: number) => {
                      const outputText =
                        typeof step.output === 'string'
                          ? step.output
                          : JSON.stringify(step.output, null, 2);
                      const stepsMeta = task.metadata?.steps ?? [];

                      const stepMetadata = stepsMeta.find((s) => s.stepId === step.stepId);
                      return (
                        <div key={index} className="relative">
                          {index < stepResults.length - 1 && (
                            <div className="absolute left-2.5 top-10 h-[calc(100%+1rem)] w-0.5 bg-border" />
                          )}
                          <Collapsible>
                            <div className="flex items-start gap-4">
                              {getStepIcon(
                                step.success === true
                                  ? 'completed'
                                  : step.success === false
                                    ? 'failed'
                                    : 'running'
                              )}

                              <div className="flex-1">
                                <CollapsibleTrigger className="group flex w-full items-start justify-between text-left">
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <h3 className="font-semibold">
                                        {stepMetadata?.name || step.stepId}
                                      </h3>
                                      <Badge variant="outline" className="text-xs">
                                        {step.type}
                                      </Badge>

                                      {step.executedBy?.agentName && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400 flex items-center gap-1.5"
                                        >
                                          <Bot className="size-3" />
                                          {step.executedBy.agentName}
                                          <span className="opacity-40 mx-0.5">|</span>
                                          {step.executedBy.provider}/{step.executedBy.model}
                                        </Badge>
                                      )}

                                      {['failed', 'retrying', 'rejected'].includes(task.status) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 px-2 text-[10px] text-primary hover:text-primary-hover flex items-center gap-1 bg-primary/5 hover:bg-primary/10 border-primary/20"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleResumeTask(step.stepId);
                                          }}
                                          disabled={isResuming}
                                        >
                                          <Play className="size-2.5" />
                                          Resume from here
                                        </Button>
                                      )}
                                    </div>

                                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                      <Clock className="size-3" />
                                      {new Date(step.timestamp).toLocaleString()}
                                    </div>
                                  </div>
                                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3">
                                  <Card className="bg-muted/30 p-4">
                                    <p className="mb-2 text-sm font-medium">Output:</p>
                                    {step.output && (
                                      <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-background p-3 font-mono text-xs text-foreground">
                                        {renderStepOutput(step.output)}
                                      </pre>
                                    )}
                                  </Card>
                                </CollapsibleContent>
                              </div>
                            </div>
                          </Collapsible>
                        </div>
                      );
                    })}

                    {executedSteps === 0 && <p className="opacity-60">No steps executed yet.</p>}
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                {agent && (
                  <Card className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Agent Inspector</h2>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Bot className="size-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.type}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Cpu className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Model</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.config?.model ?? '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Thermometer className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Temperature</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.config?.temperature ?? '—'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium">Capabilities</p>
                        <div className="flex flex-wrap gap-2">
                          {(agent.capabilities ?? []).map((tool: string) => (
                            <Badge key={tool} variant="outline" className="text-xs">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {agent?.memory && agent.memory.length > 0 && (
                  <Card className="p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <Database className="size-5 text-primary" />
                      <h2 className="text-lg font-semibold">Agent Memory</h2> {/*  IN PROGRESS */}
                    </div>

                    <div className="space-y-3">
                      {agent.memory.map((item: AgentMemoryItem, index: number) => (
                        <Card key={`${item.createdAt}-${index}`} className="bg-muted/30 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                item.type === 'system'
                                  ? 'bg-primary/20 text-primary border-primary/30'
                                  : 'bg-success/20 text-success border-success/30'
                              }
                            >
                              {item.type}
                            </Badge>

                            <span className="text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-xs">{item.content}</p>
                        </Card>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          
      </>
    </AuthenticatedLayout>
  );
}
