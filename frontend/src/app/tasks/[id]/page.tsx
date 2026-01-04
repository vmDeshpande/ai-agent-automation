"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAssistantContext } from "@/context/assistant-context";

function getStepIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-5 text-success" />;
    case "running":
      return <Circle className="size-5 animate-pulse text-warning" />;
    case "failed":
      return <XCircle className="size-5 text-destructive" />;
    default:
      return <Circle className="size-5 text-muted-foreground" />;
  }
}

type StepOutput =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[]
  | null;

type StepResult = {
  stepId: string;
  type: string;
  tool?: string;
  output?: StepOutput;
  success: boolean;
  timestamp: string;
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

type Task = {
  _id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  workflowId?: string;
  agentId?: string;
  createdAt: string;

  // ✅ ADD THIS
  steps?: TaskMetadataStep[];

  metadata?: {
    steps?: TaskMetadataStep[]; // optional legacy / fallback
  };

  stepResults?: StepResult[];
};

type AgentMemoryItem = {
  type: "learned" | "system" | "interaction";
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
  if (output === null) return "null";

  if (
    typeof output === "string" ||
    typeof output === "number" ||
    typeof output === "boolean"
  ) {
    return String(output);
  }

  return JSON.stringify(output, null, 2);
}

export default function TaskDetailPage() {
  const [agent, setAgent] = useState<Agent | null>(null);

  const { id } = useParams();
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const { setContext, clearContext } = useAssistantContext();

  function summarizeOutput(output: StepOutput | undefined) {
    if (output === null || output === undefined) return "no output";

    if (typeof output === "string") {
      return output.length > 300 ? output.slice(0, 300) + "…" : output;
    }

    try {
      const json = JSON.stringify(output);
      return json.length > 300 ? json.slice(0, 300) + "…" : json;
    } catch {
      return "unreadable output";
    }
  }

  async function fetchTask() {
    try {
      const res = await fetch(`http://localhost:5000/api/tasks/${id}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });
      const data = await res.json();
      if (data.ok) setTask(data.task);
    } catch (err) {
      console.error("Error fetching task:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgent(agentId: string) {
    if (!agentId) return;

    try {
      const res = await fetch(`http://localhost:5000/api/agents/${agentId}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json();
      console.log("Fetched agent data:", data);
      if (data.ok) setAgent(data.agent);
    } catch (err) {
      console.error("Failed to fetch agent", err);
    }
  }

  // Initial load
  useEffect(() => {
    fetchTask();
  }, [id]);

  useEffect(() => {
    if (task?.agentId) {
      fetchAgent(task.agentId);
    }
  }, [task?.agentId]);

  // Poll while running
  useEffect(() => {
    if (!task) return;
    if (["completed", "failed"].includes(task.status)) return;

    const interval = setInterval(fetchTask, 2000);
    return () => clearInterval(interval);
  }, [task?.status]);

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
        rawOutput: result.output,
      };
    });

    const failedStep = summarizedSteps.find((s) => s.success === false);

    setContext({
      page: "task-detail",

      /* ---- Task ---- */
      taskId: task._id,
      taskName: task.name,
      taskStatus: task.status,
      workflowId: task.workflowId,

      /* ---- Agent ---- */
      agentName: agent?.name,
      model: agent?.config?.model,

      /* ---- Failure awareness ---- */
      failedStep: failedStep
        ? {
            stepId: failedStep.stepId,
            name: failedStep.name,
            type: failedStep.type,
            output: failedStep.outputSummary,
          }
        : undefined,

      /* ---- Human readable status ---- */
      status:
        task.status === "failed"
          ? `Failed at step "${failedStep?.name ?? "unknown"}"`
          : task.status,

      /* ---- Timeline ---- */
      recentActivity: summarizedSteps.map((s) => ({
        type: "task",
        name: s.name,
        status: s.success ? "completed" : "failed",
      })),

      logScope: "task",
    });

    return () => {
      clearContext();
    };
  }, [task, agent]);

  if (loading) return <p>Loading task...</p>;
  if (!task) return <p>Task not found.</p>;
  const totalSteps = task.metadata?.steps?.length ?? 0;
  const executedSteps = task.stepResults?.length ?? 0;
  const stepResults = task.stepResults ?? [];
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main
          className="flex-1 transition-[padding] duration-300"
          style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
        >
          <div className="p-8">
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <h1 className="font-mono text-2xl font-bold">{task.name}</h1>
                <Badge
                  className={
                    task.status === "completed"
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {task.status}
                </Badge>
              </div>
              <p className="mt-2 text-muted-foreground">
                Workflow id: {task.workflowId}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card className="p-6">
                  <h2 className="mb-6 text-xl font-semibold">
                    Execution Timeline ({executedSteps}/{totalSteps})
                  </h2>

                  <div className="space-y-4">
                    {stepResults.map((step: StepResult, index: number) => {
                      const outputText =
                        typeof step.output === "string"
                          ? step.output
                          : JSON.stringify(step.output, null, 2);
                      const stepMetadata = task.steps?.find(
                        (s) => s.stepId === step.stepId
                      );
                      return (
                        <div key={index} className="relative">
                          {index < stepResults.length - 1 && (
                            <div className="absolute left-2.5 top-10 h-[calc(100%+1rem)] w-0.5 bg-border" />
                          )}
                          <Collapsible>
                            <div className="flex items-start gap-4">
                              {getStepIcon(
                                step.success === true
                                  ? "completed"
                                  : step.success === false
                                  ? "failed"
                                  : "running"
                              )}

                              <div className="flex-1">
                                <CollapsibleTrigger className="group flex w-full items-start justify-between text-left">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                      <h3 className="font-semibold">
                                        {stepMetadata?.name || step.stepId}
                                      </h3>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {step.type}
                                      </Badge>
                                    </div>

                                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                      <Clock className="size-3" />
                                      {new Date(
                                        step.timestamp
                                      ).toLocaleString()}
                                    </div>
                                  </div>
                                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3">
                                  <Card className="bg-muted/30 p-4">
                                    <p className="mb-2 text-sm font-medium">
                                      Output:
                                    </p>
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

                    {executedSteps === 0 && (
                      <p className="opacity-60">No steps executed yet.</p>
                    )}
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                {agent && (
                  <Card className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">
                      Agent Inspector
                    </h2>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Bot className="size-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.type}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Cpu className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Model</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.config?.model ?? "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Thermometer className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Temperature</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.config?.temperature ?? "—"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium">Capabilities</p>
                        <div className="flex flex-wrap gap-2">
                          {(agent.capabilities ?? []).map((tool: string) => (
                            <Badge
                              key={tool}
                              variant="outline"
                              className="text-xs"
                            >
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
                      <h2 className="text-lg font-semibold">
                        Agent Memory
                      </h2>{" "}
                      {/*  IN PROGRESS */}
                    </div>

                    <div className="space-y-3">
                      {agent.memory.map(
                        (item: AgentMemoryItem, index: number) => (
                          <Card
                            key={`${item.createdAt}-${index}`}
                            className="bg-muted/30 p-3"
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  item.type === "system"
                                    ? "bg-primary/20 text-primary border-primary/30"
                                    : "bg-success/20 text-success border-success/30"
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
                        )
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
