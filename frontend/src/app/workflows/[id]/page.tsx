"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAssistantContext } from "@/context/assistant-context";
import {
  Play,
  Settings,
  ListChecks,
  ArrowRight,
  CheckCircle2,
  Circle,
  XCircle,
  Download,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";

interface CreateTaskModalProps {
  workflowId: string;
  refreshWorkflow: () => void;
}

type Agent = {
  _id: string;
  name: string;
  config?: { model: string };
};

interface Task {
  _id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  stepResults?: StepResult[];
}

interface StepResult {
  stepId: string;
  success?: boolean;
  output?: unknown;
  timestamp?: string;
}

interface WorkflowStep {
  stepId: string;
  type: string;
  name?: string;
  prompt?: string;
  config?: string;
  url?: string;
  method?: string;
  seconds?: number;
  query?: string;
  to?: string;
  subject?: string;
  action?: string;
  path?: string;
}

interface Workflow {
  _id: string;
  name: string;
  description?: string;
  status: string;
  agentId?: string;
  metadata?: {
    steps?: WorkflowStep[];
  };
}

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

function getStepColor(status: string) {
  switch (status) {
    case "completed":
      return "border-success/50 bg-success/5";
    case "running":
      return "border-warning/50 bg-warning/5";
    case "failed":
      return "border-destructive/50 bg-destructive/5";
    default:
      return "border-border bg-card";
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "LLM":
      return "bg-primary/20 text-primary border-primary/30";
    case "HTTP":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "Delay":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "Tool":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "Document":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function normalizeStepType(type: string) {
  switch (type.toLowerCase()) {
    case "llm": return "LLM";
    case "delay": return "Delay";
    case "http": return "HTTP";
    case "document_query": return "Document";
    default: return "Tool";
  }
}

function getStepDescription(step: any) {
  const type = (step.type || "").toLowerCase();
  if (step.prompt) return step.prompt.slice(0, 160);
  if (step.url && step.method) return `${step.method} ${step.url}`;
  if (step.seconds) return `Wait for ${step.seconds} seconds`;
  if (type === "document_query") return step.query ? `Query: ${step.query.slice(0, 160)}` : "Document query step";
  if (type === "email") return `Email → ${step.to || "..."}`;
  if (type === "file") return `File ${step.action} | Path: ${step.path}`;
  if (type === "browser") return `Browser ${step.action} | URL: ${step.url}`;
  return "No configuration";
}

export default function WorkflowDetailPage() {
  const { id } = useParams();
  const { setContext } = useAssistantContext();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [latestTask, setLatestTask] = useState<Task | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const { addToast } = useToast();

  function getStepStatus(stepId: string): "pending" | "completed" | "failed" {
    if (!latestTask?.stepResults) return "pending";
    const result = latestTask.stepResults.find((r) => r.stepId === stepId);
    if (!result) return "pending";
    return result.success === false ? "failed" : (result.success === true ? "completed" : "pending");
  }

  async function fetchWorkflow() {
    try {
      const res = await fetch(apiUrl(`/workflows/${id}`), {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      });
      const data = await res.json();
      if (data.ok) {
        setWorkflow(data.workflow);
        setSelectedAgent(data.workflow.agentId || "");
      }
    } catch (err) {
      console.error("Error fetching workflow:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgents() {
    try {
      const res = await fetch(apiUrl("/agents"), {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      });
      const data = await res.json();
      if (data.ok) {
        setAgents(data.agents);
        const map: Record<string, string> = {};
        data.agents.forEach((a: Agent) => map[a._id] = a.name);
        setAgentMap(map);
      }
    } catch (err) {
      console.error("Error loading agents:", err);
    }
  }

  useEffect(() => {
    fetchWorkflow();
    fetchAgents();
  }, [id]);

  useEffect(() => {
    if (!workflow) return;
    setContext({
      page: "workflow-detail",
      workflowId: workflow._id,
      workflowName: workflow.name,
      status: workflow.status,
      agentName: agentMap[workflow.agentId || ""] || "No agent",
    });
  }, [workflow, agentMap]);

  async function assignAgent() {
    if (!workflow) return;
    try {
      await fetch(apiUrl(`/workflows/${workflow._id}/assign-agent`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ agentId: selectedAgent }),
      });
      addToast({ type: "success", title: "Agent assigned successfully" });
      fetchWorkflow();
    } catch {
      addToast({ type: "error", title: "Failed to assign agent" });
    }
  }

  function exportWorkflow() {
    if (!workflow) return;
    const template = {
      id: workflow.name.toLowerCase().replace(/\s+/g, "-"),
      name: workflow.name,
      description: workflow.description || "",
      steps: workflow.metadata?.steps?.map(({ stepId, ...rest }) => rest) || [],
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.id}.json`;
    a.click();
  }

  if (loading) return <p className="p-8">Loading workflow...</p>;
  if (!workflow) return <p className="p-8">Workflow not found.</p>;

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 transition-[padding] duration-300" style={{ paddingLeft: "var(--sidebar-width, 256px)" }}>
        <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{workflow.name}</h1>
              <p className="mt-2 text-muted-foreground">Workflow pipeline visualization</p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => <SelectItem key={a._id} value={a._id}>{a.name} ({a.config?.model})</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={assignAgent}><Settings className="mr-2 size-4" /> Save Agent</Button>
              <Link href={`/workflows/${workflow._id}/builder`}><Button variant="outline"><Settings className="mr-2 size-4" /> Configure</Button></Link>
              <Button onClick={async () => {
                const res = await fetch(apiUrl(`/workflows/${workflow._id}/run`), {
                  method: "POST",
                  headers: { Authorization: "Bearer " + localStorage.getItem("token") },
                });
                const data = await res.json();
                if (data.ok) {
                  setLatestTask(data.task);
                  fetchWorkflow();
                  addToast({ type: "info", title: "Workflow started" });
                }
              }}><Play className="mr-2 size-4" /> Run Workflow</Button>
            </div>
          </div>

          <div className="mb-6 flex items-center gap-3">
            <Badge className={workflow.status === "running" ? "bg-success/20 text-success border-success/30" : ""}>{workflow.status}</Badge>
            <Link href={`/workflows/${workflow._id}/tasks`}><Button variant="outline" size="sm"><ListChecks className="mr-2 size-4" /> View Task History</Button></Link>
            <Button variant="outline" size="sm" onClick={exportWorkflow}><Download className="mr-2 size-4" /> Export</Button>
          </div>

          <Card className="p-8">
            <h2 className="mb-6 text-xl font-semibold">Workflow Pipeline</h2>
            <div className="space-y-4">
              {workflow.metadata?.steps?.map((step, index) => {
                const status = getStepStatus(step.stepId);
                return (
                  <div key={step.stepId}>
                    <Card className={`p-6 ${getStepColor(status)}`}>
                      <div className="flex items-start gap-4">
                        {getStepIcon(status)}
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <Badge variant="outline" className={getTypeColor(normalizeStepType(step.type))}>{normalizeStepType(step.type)}</Badge>
                            <h3 className="font-semibold">{step.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3">{getStepDescription(step)}</p>
                        </div>
                      </div>
                    </Card>
                    {index < (workflow.metadata?.steps?.length || 0) - 1 && (
                      <div className="flex justify-center py-2"><ArrowRight className="size-5 text-muted-foreground" /></div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}