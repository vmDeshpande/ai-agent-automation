'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/workflow/MetricCard';
import { ExecutionTimeline } from '@/components/workflow/ExecutionTimeline';
import { StepDetailsPane } from '@/components/workflow/StepDetailsPane';
import { StepLogsPane } from '@/components/workflow/StepLogsPane';
import { JsonViewer } from '@/components/workflow/JsonViewer';
import {
  Target,
  Clock,
  Layers,
  Coins,
  Copy,
  ArrowLeft,
  Download,
  RotateCcw,
  Play,
  Settings,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/useApi';
import {
  CheckCircle2,
  XCircle,
  Circle,
  ChevronDown,
  Bot,
  Cpu,
  Thermometer,
  Database,
  ShieldCheck,
  Globe,
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
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
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
    <AuthenticatedLayout layout="panel">
      <div className="flex flex-col flex-1 min-h-0 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <Link href={`/workflows/${task.workflowId}`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  Execution: exe_{task._id.substring(0, 8)}
                </h1>
                <Badge
                  variant="outline"
                  className={
                    task.status === 'completed'
                      ? 'bg-success/10 text-success border-success/20'
                      : task.status === 'failed' || task.status === 'rejected'
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : task.status === 'running'
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          : task.status === 'pending_approval'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : 'bg-muted text-muted-foreground'
                  }
                >
                  <span className="flex items-center gap-1.5 capitalize">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        task.status === 'completed'
                          ? 'bg-success'
                          : task.status === 'failed' || task.status === 'rejected'
                            ? 'bg-destructive'
                            : task.status === 'running'
                              ? 'bg-blue-500'
                              : task.status === 'pending_approval'
                                ? 'bg-amber-500'
                                : 'bg-muted-foreground'
                      }`}
                    />
                    {task.status.replace('_', ' ')}
                  </span>
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm mt-2">
                Started {new Date(task.createdAt).toLocaleString()} • Workflow id: {task.workflowId}
              </p>
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
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleResumeTask()}
              disabled={isResuming || task.status !== 'pending_approval'}
            >
              <RotateCcw className="mr-2 size-3.5" />
              Retry
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRerunFromFailed}
              disabled={isRerunning || task.status !== 'failed'}
            >
              <Play className="mr-2 size-3.5" />
              Rerun
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 size-3.5" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6 shrink-0">
          <MetricCard
            title="Status"
            value={task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('_', ' ')}
            icon={Target}
            subtitle={task.status === 'completed' ? 'Success' : '-'}
          />
          <MetricCard title="Total Duration" value="-" icon={Clock} subtitle="Start to finish" />
          <MetricCard
            title="Steps"
            value={task.metadata?.steps?.length || 0}
            icon={Layers}
            subtitle={`${task.stepResults?.filter((r) => r.success).length || 0} success, ${task.stepResults?.filter((r) => r.success === false).length || 0} failed`}
          />
          <MetricCard
            title="Tokens Used"
            value="-"
            icon={Coins}
            subtitle="Prompt: - Completion: -"
          />
          <MetricCard title="Estimated Cost" value="-" icon={Coins} subtitle="tokens" />
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <Tabs defaultValue="timeline" className="flex flex-col h-full w-full">
            <div className="border-b border-border/50 px-4 mb-4">
              <TabsList className="bg-transparent h-12 p-0 gap-6">
                <TabsTrigger
                  value="timeline"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12 font-medium"
                >
                  Timeline
                </TabsTrigger>
                <TabsTrigger
                  value="steps"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12 font-medium"
                >
                  Steps
                </TabsTrigger>
                <TabsTrigger
                  value="metrics"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12 font-medium text-muted-foreground"
                >
                  Metrics
                </TabsTrigger>
                <TabsTrigger
                  value="payload"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12 font-medium"
                >
                  Payload
                </TabsTrigger>
                <TabsTrigger
                  value="configuration"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12 font-medium"
                >
                  Configuration
                </TabsTrigger>
                <TabsTrigger
                  value="artifacts"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12 font-medium text-muted-foreground"
                >
                  Artifacts
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="timeline"
              className="flex-1 min-h-0 m-0 p-0 data-[state=inactive]:hidden flex flex-col"
            >
              <div className="flex flex-col gap-6 flex-1 min-h-0">
                {/* Timeline (Full width on top) */}
                <div className="w-full flex-none min-h-[300px] h-[350px]">
                  <ExecutionTimeline
                    steps={task.metadata?.steps || []}
                    results={task.stepResults || []}
                    status={task.status}
                    onStepSelect={setSelectedStepId}
                    selectedStepId={selectedStepId}
                    taskCreatedAt={task.createdAt}
                  />
                </div>

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

                {/* Step Details & Logs (Side by side below) */}
                <div className="flex flex-col lg:flex-row gap-6 w-full flex-1 min-h-[400px]">
                  <div className="flex-1 min-w-0 lg:min-w-[350px] flex flex-col">
                    <StepDetailsPane
                      step={
                        task.metadata?.steps?.find(
                          (s) => (s.stepId || (s as any).id) === selectedStepId
                        ) || null
                      }
                      result={task.stepResults?.find((r) => r.stepId === selectedStepId) || null}
                      status={task.status}
                      taskId={task._id}
                    />
                  </div>
                  <div className="flex-1 min-w-0 lg:min-w-[350px] flex flex-col">
                    <StepLogsPane taskId={task._id} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="steps"
              className="flex-1 min-h-0 m-0 p-4 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="rounded-md border border-border overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/20 border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Step</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(task.metadata?.steps || []).map((step, idx) => {
                      const result = task.stepResults?.find(
                        (r) => r.stepId === (step.stepId || (step as any).id)
                      );
                      const status = result
                        ? result.success
                          ? 'Success'
                          : 'Failed'
                        : task.status === 'running'
                          ? 'Pending'
                          : 'Pending';
                      return (
                        <tr
                          key={step.stepId || (step as any).id}
                          className="hover:bg-muted/10 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {step.name || step.stepId || (step as any).id}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">
                              {step.stepId || (step as any).id}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px] bg-muted/20">
                              {step.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {status === 'Success' && (
                              <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
                                Success
                              </Badge>
                            )}
                            {status === 'Failed' && (
                              <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
                                Failed
                              </Badge>
                            )}
                            {status === 'Pending' && (
                              <Badge variant="outline" className="text-muted-foreground">
                                Pending
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                            {result?.timestamp ? new Date(result.timestamp).toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent
              value="metrics"
              className="flex-1 min-h-0 m-0 p-8 flex items-center justify-center text-muted-foreground data-[state=inactive]:hidden"
            >
              <div className="text-center">
                <Target className="size-8 mx-auto mb-3 opacity-20" />
                <p>No metrics data available for this execution.</p>
              </div>
            </TabsContent>

            <TabsContent
              value="payload"
              className="flex-1 min-h-0 m-0 p-4 flex flex-col data-[state=inactive]:hidden"
            >
              {!selectedStepId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border border-border/50 border-dashed rounded-md bg-muted/5">
                  <Target className="size-8 mx-auto mb-3 opacity-20" />
                  <p>Select a step from the Timeline to view its payload</p>
                </div>
              ) : (
                <div className="flex flex-1 gap-4 min-h-0">
                  <div className="w-1/2 flex flex-col border border-border/50 rounded-md overflow-hidden">
                    <div className="bg-muted/20 border-b border-border/50 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                      Input Configuration
                    </div>
                    <div className="flex-1 min-h-0 bg-[#1e1e1e]">
                      <JsonViewer
                        data={task.metadata?.steps?.find(
                          (s) => (s.stepId || (s as any).id) === selectedStepId
                        )}
                      />
                    </div>
                  </div>
                  <div className="w-1/2 flex flex-col border border-border/50 rounded-md overflow-hidden">
                    <div className="bg-muted/20 border-b border-border/50 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                      Execution Output
                    </div>
                    <div className="flex-1 min-h-0 bg-[#1e1e1e]">
                      <JsonViewer
                        data={
                          task.stepResults?.find((r) => r.stepId === selectedStepId)?.output || null
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="configuration"
              className="flex-1 min-h-0 m-0 p-4 overflow-y-auto data-[state=inactive]:hidden"
            >
              <div className="space-y-6">
                {(task.metadata?.steps || []).map((step, idx) => (
                  <div
                    key={step.stepId || (step as any).id}
                    className="border border-border/50 rounded-lg overflow-hidden"
                  >
                    <div className="bg-muted/20 px-4 py-3 border-b border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{idx + 1}.</span>
                        <span className="font-semibold text-sm">
                          {step.name || step.stepId || (step as any).id}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-5 ml-2">
                          {step.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="bg-[#1e1e1e] h-48 overflow-hidden relative">
                      <JsonViewer data={step} />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent
              value="artifacts"
              className="flex-1 min-h-0 m-0 p-8 flex items-center justify-center text-muted-foreground data-[state=inactive]:hidden"
            >
              <div className="text-center">
                <Layers className="size-8 mx-auto mb-3 opacity-20" />
                <p>No artifacts generated by this execution.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
