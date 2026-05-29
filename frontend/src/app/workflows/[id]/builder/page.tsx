"use client";

import { useParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAssistantContext } from "@/context/assistant-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VisualBuilder from "@/components/workflow/visual-builder";
import { Textarea } from "@/components/ui/textarea";
import { Save, Play, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";

/* ---------------- TYPES ---------------- */

type StepType =
  | "LLM"
  | "HTTP"
  | "Delay"
  | "Tool"
  | "Document"
  | "Condition"
  | "Switch";
type ToolType = "email" | "file" | "browser";

type WorkflowStep = {
  id: string;
  type: StepType;
  name: string;

  position?: {
    x: number;
    y: number;
  };

  useMemory?: boolean;
  memoryTopK?: number;
  prompt?: string;

  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;

  delay?: number;

  tool?: ToolType;

  to?: string;
  subject?: string;
  text?: string;
  html?: string;

  action?: string;
  path?: string;
  content?: string;

  code?: string;

  documentId?: string;
  query?: string;
  topK?: number;

  conditionType?: "boolean" | "sentiment" | "contains";
  operator?: string;
  value?: string;

  trueTarget?: string;
  falseTarget?: string;

  cases?: {
    value: string;
    target: string;
  }[];

  defaultTarget?: string;
};

type BackendStep = {
  name: string;
  stepId: string;
  type:
    | "LLM"
    | "HTTP"
    | "Delay"
    | "Tool"
    | "llm"
    | "http"
    | "delay"
    | "condition"
    | "switch"
    | "document_query"
    | "file"
    | "email"
    | "browser";

  prompt?: string;

  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;

  seconds?: number;
};

type WorkflowResponse = {
  _id: string;
  name: string;
  metadata?: {
    steps?: BackendStep[];
    edges?: any[];
  };
};

/* ---------------- UTILS ---------------- */

function getTypeColor(type: StepType) {
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
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function summarizeStep(step: WorkflowStep) {
  switch (step.type) {
    case "LLM":
      return step.prompt
        ? `Prompt: ${step.prompt.slice(0, 120)}${
            step.prompt.length > 120 ? "…" : ""
          }`
        : "No prompt configured";

    case "HTTP": {
      const method = step.method ?? "GET";
      const url = step.url?.trim() || "❌ not set";
      const body = step.body?.trim();

      let bodyStatus = "none";

      if (body) {
        try {
          JSON.parse(body);
          bodyStatus = "valid JSON";
        } catch {
          bodyStatus = "invalid JSON";
        }
      }

      return [`Method: ${method}`, `URL: ${url}`, `Body: ${bodyStatus}`].join(
        " | ",
      );
    }

    case "Delay":
      return `Delay for ${step.delay ?? 0} seconds`;

    case "Document":
      return step.query
        ? `Query: ${step.query.slice(0, 120)}${
            step.query.length > 120 ? "…" : ""
          }`
        : "No query configured";

    case "Tool": {
      if (!step.tool) return "Tool not selected";

      if (step.tool === "email") {
        const to = step.to || "❌ no recipient";
        const subject = step.subject || "no subject";

        return `Email → ${to} | Subject: ${subject}`;
      }

      if (step.tool === "file") {
        const action = step.action || "action";
        const path = step.path || "❌ path not set";

        return `File ${action} | Path: ${path}`;
      }

      if (step.tool === "browser") {
        const action = step.action || "action";
        const url = step.url || "❌ url not set";

        return `Browser ${action} | URL: ${url}`;
      }

      return "Tool execution step";
    }

    default:
      return "Unknown step";
  }
}

/* ---------------- PAGE ---------------- */

export default function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [builderMode, setBuilderMode] = useState<"list" | "visual">("list");
  const { addToast } = useToast();
  const [edges, setEdges] = useState<any[]>([]);
  const { setContext, clearContext } = useAssistantContext();

  // Safety tracking intercept state flags
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  async function fetchWorkflow() {
    try {
      const res = await fetch(apiUrl(`/workflows/${id}`), {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json();
      if (!data.ok) return;

      const workflow: WorkflowResponse = data.workflow;
      setWorkflowName(workflow.name);

      const backendSteps = workflow.metadata?.steps ?? [];
      const backendEdges = (workflow.metadata?.edges ?? []).map((e: any) => ({
        ...e,
        id: e.id || crypto.randomUUID(),
        label: e.label || e.caseValue || e.condition?.toUpperCase() || "",
      }));
      setEdges(backendEdges);

      const normalizedSteps: WorkflowStep[] = backendSteps.map((s) => ({
        id: s.stepId,
        name: s.name,
        type:
          s.type === "delay"
            ? "Delay"
            : s.type === "http"
              ? "HTTP"
              : s.type === "condition"
                ? "Condition"
                : s.type === "switch"
                  ? "Switch"
                  : s.type === "document_query"
                    ? "Document"
                    : s.type === "file" ||
                        s.type === "email" ||
                        s.type === "browser"
                      ? "Tool"
                      : "LLM",

        position: (s as any).position || { x: 0, y: 0 },

        useMemory: (s as any).useMemory ?? false,
        memoryTopK: (s as any).memoryTopK ?? 5,
        prompt: s.prompt ?? "",

        url: s.url ?? "",
        method: s.method ?? "GET",
        body: s.body ?? "",

        delay: s.type === "delay" ? (s.seconds ?? 0) : 0,

        tool:
          s.type === "file" || s.type === "email" || s.type === "browser"
            ? (s.type as ToolType)
            : undefined,
        to: (s as any).to ?? "",
        subject: (s as any).subject ?? "",
        text: (s as any).text ?? "",
        html: (s as any).html ?? "",
        action: (s as any).action ?? "",
        path: (s as any).path ?? "",
        content: (s as any).content ?? "",
        code: (s as any).code ?? "",

        documentId: (s as any).documentId ?? "",
        query: (s as any).query ?? "",
        topK: (s as any).topK ?? 4,

        conditionType: (s as any).conditionType ?? "",
        operator: (s as any).operator ?? "",
        value: (s as any).value ?? "",

        trueTarget: (s as any).trueTarget ?? "",
        falseTarget: (s as any).falseTarget ?? "",

        cases: (s as any).cases ?? [],
        defaultTarget: (s as any).defaultTarget ?? "",
      }));

      setSteps(normalizedSteps);
      setIsDirty(false);
    } catch (err) {
      console.error("Failed to load workflow", err);
    } finaly {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  // Tab close/refresh listener protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved workspace configuration modifications.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!id) return;

    setContext({
      page: "workflow-builder",
      workflowId: id,
      workflowName: workflowName ?? undefined,
      status: "editing",

      builderSteps: steps
        .filter(
          (s) =>
            s.type === "LLM" ||
            s.type === "HTTP" ||
            s.type === "Tool" ||
            s.type === "Delay",
        )
        .map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type as "LLM" | "HTTP" | "Tool" | "Delay",
          summary: summarizeStep(s),
        })),
    });

    return () => {
      clearContext();
    };
  }, [id, workflowName, steps.length]);

  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await fetch(apiUrl("/documents"), {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
        });

        const data = await res.json();

        if (data.ok) {
          setDocuments(data.documents || []);
        }
      } catch (err) {
        console.error("Failed to fetch documents", err);
      }
    }

    fetchDocs();
  }, []);

  function addStep() {
    setIsDirty(true);
    setSteps((prev) => [
      ...prev,
      {
        id: uuidv4(),
        type: "LLM",
        name: "New Step",
        prompt: "",
      },
    ]);
  }

  function removeStep(stepId: string) {
    setIsDirty(true);
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  }

  function updateStep(stepId: string, patch: Partial<WorkflowStep>) {
    setIsDirty(true);
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    );
  }

  function enrichStepsWithEdges(steps: WorkflowStep[], edges: any[]) {
    return steps.map((step) => {
      if (step.type === "Switch") {
        const outgoing = edges.filter((e) => e.source === step.id);

        const cases = outgoing
          .filter((e) => e.caseValue)
          .map((e) => ({
            value: e.caseValue,
            target: e.target,
          }));

        const fallback = outgoing.find((e) => !e.caseValue);

        return {
          ...step,
          cases,
          defaultTarget: fallback?.target,
        };
      }

      if (step.type === "Condition") {
        const trueEdge = edges.find(
          (e) => e.source === step.id && e.condition === "true",
        );

        const falseEdge = edges.find(
          (e) => e.source === step.id && e.condition === "false",
        );

        return {
          ...step,
          trueTarget: trueEdge?.target,
          falseTarget: falseEdge?.target,
        };
      }

      return step;
    });
  }

  async function saveWorkflow() {
    try {
      setIsSaving(true);
      const enrichedSteps = enrichStepsWithEdges(steps, edges);

      const backendSteps = enrichedSteps.map((s) => {
        if (s.type === "LLM") {
          return {
            stepId: s.id,
            name: s.name,
            position: s.position,
            type: "llm",
            prompt: s.prompt ?? "",
            useMemory: s.useMemory ?? false,
            memoryTopK: s.memoryTopK ?? 5,
          };
        }

        if (s.type === "Delay") {
          return {
            stepId: s.id,
            name: s.name,
            position: s.position,
            type: "delay",
            seconds: s.delay ?? 0,
          };
        }

        if (s.type === "HTTP") {
          return {
            stepId: s.id,
            name: s.name,
            position: s.position,
            type: "http",
            method: s.method ?? "GET",
            url: s.url ?? "",
            body: s.body ?? "",
          };
        }

        if (s.type === "Document") {
          return {
            stepId: s.id,
            name: s.name,
            position: s.position,
            type: "document_query",
            documentId: s.documentId,
            query: s.query,
            topK: s.topK ?? 4,
          };
        }

        if (s.type === "Condition") {
          return {
            stepId: s.id,
            name: s.name,
            position: s.position,
            type: "condition",
            conditionType: s.conditionType,
            operator: s.operator,
            value: s.value,
            trueTarget: s.trueTarget,
            falseTarget: s.falseTarget,
          };
        }

        if (s.type === "Switch") {
          return {
            stepId: s.id,
            name: s.name,
            position: s.position,
            type: "switch",
          };
        }

        if (s.type === "Tool" && s.tool) {
          const toolType = s.tool.toLowerCase();
          const base: any = {
            stepId: s.id,
            name: s.name,
            position: s.position,
            type: toolType,
          };

          if (toolType === "file") {
            return {
              ...base,
              action: s.action ?? "read",
              path: s.path ?? "",
              content: s.content ?? "",
            };
          }

          if (toolType === "email") {
            return {
              ...base,
              to: s.to ?? "",
              subject: s.subject ?? "",
              text: s.text ?? "",
              html: s.html ?? "",
            };
          }

          if (toolType === "browser") {
            return {
              ...base,
              action: s.action ?? "screenshot",
              url: s.url ?? "",
              code: s.code ?? "",
            };
          }

          return base;
        }

        return {
          stepId: s.id,
          name: s.name,
          position: s.position,
          type: "unknown" as any,
        };
      });

      const res = await fetch(apiUrl(`/workflows/${id}/steps`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          steps: backendSteps,
          edges: edges,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save workflow");
      }

      setIsDirty(false);
      addToast({
        type: "success",
        title: "Workflow saved",
        description: "Your workflow steps were updated successfully",
      });
    } catch (err) {
      console.error("Save workflow failed:", err);
      addToast({
        type: "error",
        title: "Failed to save workflow",
        description: "Something went wrong. Try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 pl-64 p-8">
          <p className="opacity-70">Loading workflow builder…</p>
        </main>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />

        <main
          className="flex-1 transition-[padding] duration-300"
          style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
        >
          <div className="p-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Workflow Builder</h1>
                <p className="mt-2 text-muted-foreground">
                  Configure workflow steps and execution order
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Workflow ID: {id}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant={builderMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBuilderMode("list")}
                  >
                    Step Builder
                  </Button>

                  <Button
                    variant={builderMode === "visual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBuilderMode("visual")}
                  >
                    Visual Graph
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (isDirty) {
                      setShowExitModal(true);
                    } else {
                      router.push(`/workflows/${id}`);
                    }
                  }}
                >
                  ← Back to Workflow
                </Button>
                <Button variant="outline" disabled={isSaving}>
                  <Save className="mr-2 size-4" />
                  Save Draft
                </Button>
                <Button onClick={saveWorkflow} disabled={isSaving}>
                  <Play className="mr-2 size-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            {/* Visual Builder Graph Workspace View */}
            {builderMode === "visual" && (
              <VisualBuilder
                steps={steps}
                setSteps={(updatedSteps) => {
                  setIsDirty(true);
                  setSteps(updatedSteps);
                }}
                edges={edges}
                onEdgesChange={(updatedEdges) => {
                  setIsDirty(true);
                  setEdges(updatedEdges);
                }}
              />
            )}

            {/* List Builder Workspace View */}
            {builderMode === "list" && (
              <div className="mx-auto max-w-3xl space-y-4">
                <AnimatePresence initial={false}>
                  {steps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <Card
                        className="p-6 transition-shadow hover:shadow-lg"
                        onClick={() => {
                          const validStepType = (
                            ["LLM", "HTTP", "Tool", "Delay"].includes(step.type)
                              ? step.type
                              : "LLM"
                          ) as "LLM" | "HTTP" | "Tool" | "Delay";
                          setContext({
                            page: "workflow-builder",
                            workflowId: id,
                            workflowName: workflowName ?? undefined,
                            status: "editing",

                            builderSteps: steps
                              .filter(
                                (s) =>
                                  s.type === "LLM" ||
                                  s.type === "HTTP" ||
                                  s.type === "Tool" ||
                                  s.type === "Delay",
                              )
                              .map((s) => ({
                                id: s.id,
                                name: s.name,
                                type: s.type as
                                  | "LLM"
                                  | "HTTP"
                                  | "Delay"
                                  | "Tool",
                                summary: summarizeStep(s),
                              })),
                            stepId: step.id,
                            stepName: step.name,
                            stepType: validStepType,
                            stepDescription: summarizeStep(step),
                          });
                        }}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <motion.span
                              layout
                              className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                            >
                              {index + 1}
                            </motion.span>
                            <Badge
                              variant="outline"
                              className={getTypeColor(step.type)}
                            >
                              {step.type}
                            </Badge>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeStep(step.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <Label>Step Type</Label>
                            <Select
                              value={step.type}
                              onValueChange={(v) =>
                                updateStep(step.id, {
                                  type: v as StepType,
                                })
                              }
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LLM">LLM</SelectItem>
                                <SelectItem value="HTTP">
                                  HTTP Request
                                </SelectItem>
                                <SelectItem value="Delay">Delay</SelectItem>
                                <SelectItem value="Tool">Tool</SelectItem>
                                <SelectItem value="Document">
                                  Document Query
                                </SelectItem>
                                <SelectItem value="Condition">
                                  Condition
                                </SelectItem>
                                <SelectItem value="Switch">Switch</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Step Name</Label>
                            <Input
                              className="mt-1.5"
                              value={step.name}
                              onChange={(e) =>
                                updateStep(step.id, {
                                  name: e.target.value,
                                })
                              }
                            />
                          </div>

                          {step.type === "Tool" && (
                            <>
                              <div>
                                <Label>Tool</Label>
                                <Select
                                  value={step.tool}
                                  onValueChange={(v) =>
                                    updateStep(step.id, { tool: v as any })
                                  }
                                >
                                  <SelectTrigger className="mt-1.5">
                                    <SelectValue placeholder="Select tool" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="file">File</SelectItem>
                                    <SelectItem value="browser">
                                      Browser
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {step.tool === "email" && (
                                <>
                                  <div>
                                    <Label>To</Label>
                                    <Input
                                      className="mt-1.5"
                                      value={step.to ?? ""}
                                      onChange={(e) =>
                                        updateStep(step.id, {
                                          to: e.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div>
                                    <Label>Subject</Label>
                                    <Input
                                      className="mt-1.5"
                                      value={step.subject ?? ""}
                                      onChange={(e) =>
                                        updateStep(step.id, {
                                          subject: e.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div>
                                    <Label>Text</Label>
                                    <Textarea
                                      className="mt-1.5"
                                      value={step.text ?? ""}
                                      onChange={(e) =>
                                        updateStep(step.id, {
                                          text: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </>
                              )}

                              {step.tool === "file" && (
                                <>
                                  <div>
                                    <Label>Action</Label>
                                    <Select
                                      value={step.action}
                                      onValueChange={(v) =>
                                        updateStep(step.id, { action: v })
                                      }
                                    >
                                      <SelectTrigger className="mt-1.5">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="write">
                                          Write
                                        </SelectItem>
                                        <SelectItem value="append">
                                          Append
                                        </SelectItem>
                                        <SelectItem value="read">
                                          Read
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label>Path</Label>
                                    <Input
                                      className="mt-1.5"
                                      value={step.path ?? ""}
                                      onChange={(e) =>
                                        updateStep(step.id, {
                                          path: e.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  {step.action !== "read" && (
                                    <div>
                                      <Label>Content</Label>
                                      <Textarea
                                        className="mt-1.5"
                                        value={step.content ?? ""}
                                        onChange={(e) =>
                                          updateStep(step.id, {
                                            content: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                  )}
                                </>
                              )}

                              {step.tool === "browser" && (
                                <>
                                  <div>
                                    <Label>Action</Label>
                                    <Select
                                      value={step.action}
                                      onValueChange={(v) =>
                                        updateStep(step.id, { action: v })
                                      }
                                    >
                                      <SelectTrigger className="mt-1.5">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="screenshot">
                                          Screenshot
                                        </SelectItem>
                                        <SelectItem value="scrape">
                                          Scrape Text
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label>URL</Label>
                                    <Input
                                      className="mt-1.5"
                                      value={step.url ?? ""}
                                      onChange={(e) =>
                                        updateStep(step.id, {
                                          url: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </>
                              )}
                            </>
                          )}

                          {step.type === "LLM" && (
                            <div>
                              <Label>System Prompt / Instruction</Label>
                              <Textarea
                                className="mt-1.5 min-h-[100px]"
                                placeholder="Tell the model what to do with the input..."
                                value={step.prompt ?? ""}
                                onChange={(e) =>
                                  updateStep(step.id, {
                                    prompt: e.target.value,
                                  })
                                }
                              />
                            </div>
                          )}

                          {step.type === "Delay" && (
                            <div>
                              <Label>Delay duration (seconds)</Label>
                              <Input
                                type="number"
                                className="mt-1.5"
                                value={step.delay ?? 0}
                                onChange={(e) =>
                                  updateStep(step.id, {
                                    delay: parseInt(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>
                          )}

                          {step.type === "HTTP" && (
                            <>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                  <Label>Method</Label>
                                  <Select
                                    value={step.method ?? "GET"}
                                    onValueChange={(v) =>
                                      updateStep(step.id, {
                                        method: v as any,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="mt-1.5">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="GET">GET</SelectItem>
                                      <SelectItem value="POST">POST</SelectItem>
                                      <SelectItem value="PUT">PUT</SelectItem>
                                      <SelectItem value="DELETE">
                                        DELETE
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="col-span-2">
                                  <Label>Endpoint URL</Label>
                                  <Input
                                    className="mt-1.5"
                                    placeholder="https://api.example.com/data"
                                    value={step.url ?? ""}
                                    onChange={(e) =>
                                      updateStep(step.id, {
                                        url: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              {step.method !== "GET" && (
                                <div>
                                  <Label>JSON Payload Body</Label>
                                  <Textarea
                                    className="mt-1.5 font-mono text-sm"
                                    placeholder={`{\n  "key": "value"\n}`}
                                    value={step.body ?? ""}
                                    onChange={(e) =>
                                      updateStep(step.id, {
                                        body: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <Button className="w-full border-dashed" variant="outline" onClick={addStep}>
                  <Plus className="mr-2 size-4" /> Add Execution Node Step
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Intercept Navigation Custom Confirmation Modal Popup */}
      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
            >
              <h2 className="text-xl font-bold">Unsaved Changes</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You have modified your workflow pipeline configuration layouts. Leaving now will permanently discard all unsaved step transitions.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowExitModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsDirty(false);
                    setShowExitModal(false);
                    router.push(`/workflows/${id}`);
                  }}
                >
                  Leave Anyway
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AuthGuard>
  );
}