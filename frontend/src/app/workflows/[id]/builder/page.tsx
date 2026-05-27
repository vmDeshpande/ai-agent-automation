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
import { Save, Play, Plus, Trash2, Loader2 } from "lucide-react";
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

  // LLM
  useMemory?: boolean;
  memoryTopK?: number;
  prompt?: string;

  // HTTP
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;

  // Delay
  delay?: number;

  // 🔥 Tool
  tool?: ToolType;

  // Email
  to?: string;
  subject?: string;
  text?: string;
  html?: string;

  // File
  action?: string;
  path?: string;
  content?: string;

  // Browser
  code?: string;

  // Document RAG
  documentId?: string;
  query?: string;
  topK?: number;

  // CONDITION (NEW SYSTEM)
  conditionType?: "boolean" | "sentiment" | "contains";
  operator?: string;
  value?: string;

  trueTarget?: string;
  falseTarget?: string;

  // SWITCH
  cases?: {
    value: string; // what to match
    target: string; // stepId
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
  
  // App States
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [builderMode, setBuilderMode] = useState<"list" | "visual">("list");
  
  // Status Flags
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false); // Tracks unsaved modifications

  const { addToast } = useToast();
  const { setContext, clearContext } = useAssistantContext();

  // 🌟 ALERT FIX: Browser Refresh/Tab Closing Protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes in your pipeline workflow. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // 🌟 ALERT FIX: Intercept manual router navigation updates safely
  const handleSafeBackNavigation = () => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        "You have unsaved pipeline modifications. Are you sure you want to return to the details page and discard them?"
      );
      if (!confirmLeave) return;
    }
    router.push(`/workflows/${id}`);
  };

  async function fetchWorkflow() {
    try {
      // Intercept local testing mocks immediately
      if (id === "mock-123") {
        setWorkflowName("Test Automation Pipeline");
        setEdges([]);
        setSteps([
          {
            id: "step-1",
            type: "LLM",
            name: "Analyze Customer Response Sentiment",
            prompt: "Determine if this customer input text expression carries a positive, neutral, or negative sentiment.",
            position: { x: 100, y: 150 }
          },
          {
            id: "step-2",
            type: "Delay",
            name: "Hold Processing Buffer",
            delay: 15,
            position: { x: 100, y: 350 }
          }
        ]);
        setIsDirty(false);
        setLoading(false);
        return;
      }

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

      // normalize backend steps → builder steps
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

        // LLM
        useMemory: (s as any).useMemory ?? false,
        memoryTopK: (s as any).memoryTopK ?? 5,
        prompt: s.prompt ?? "",

        // HTTP
        url: s.url ?? "",
        method: s.method ?? "GET",
        body: s.body ?? "",

        // Delay
        delay: s.type === "delay" ? (s.seconds ?? 0) : 0,

        // TOOL FIELDS
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

        // Document
        documentId: (s as any).documentId ?? "",
        query: (s as any).query ?? "",
        topK: (s as any).topK ?? 4,

        // CONDITION
        conditionType: (s as any).conditionType ?? "",
        operator: (s as any).operator ?? "",
        value: (s as any).value ?? "",

        trueTarget: (s as any).trueTarget ?? "",
        falseTarget: (s as any).falseTarget ?? "",

        // SWITCH
        cases: (s as any).cases ?? [],
        defaultTarget: (s as any).defaultTarget ?? "",
      }));

      setSteps(normalizedSteps);
      setIsDirty(false); 
    } catch (err) {
      console.error("Failed to load workflow", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    setContext({
      page: "workflow-builder",
      workflowId: id,
      workflowName: workflowName ?? undefined,
      status: isDirty ? "editing" : "saved", 

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
  }, [id, workflowName, steps.length, isDirty]); 

  useEffect(() => {
    async function fetchDocs() {
      try {
        if (id === "mock-123") return; // Skip online doc retrieval for local mocks
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
  }, [id]);

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
    setIsSaving(true);
    try {
      if (id === "mock-123") {
        // Intercept save triggers locally for local validation testing
        await new Promise((resolve) => setTimeout(resolve, 800));
        addToast({
          type: "success",
          title: "Workflow saved",
          description: "Your workflow steps were updated successfully (Mock Validation Save)",
        });
        setIsDirty(false);
        setIsSaving(false);
        return;
      }

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
          "Authorization": "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          steps: backendSteps,
          edges: edges,
        }),
      });

      if (!res.ok) throw new Error("Failed to save workflow");

      addToast({
        type: "success",
        title: "Workflow saved",
        description: "Your workflow steps were updated successfully",
      });

      setIsDirty(false); 
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
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">Workflow Builder</h1>
                  {isDirty ? (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Unsaved Changes</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Saved</Badge>
                  )}
                </div>
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
                  onClick={handleSafeBackNavigation}
                >
                  ← Back to Workflow
                </Button>
                <Button variant="outline">
                  <Save className="mr-2 size-4" />
                  Save Draft
                </Button>
                <Button onClick={saveWorkflow} disabled={isSaving || !isDirty}>
                  {isSaving ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 size-4" />
                  )}
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            {/* Steps Graph/List */}
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

            {builderMode === "list" && (
              <div className="mx-auto max-w-3xl space-y-4">
                <div className="flex justify-end mb-2">
                  <Button size="sm" onClick={addStep}>
                    <Plus className="mr-2 size-4" /> Add Step
                  </Button>
                </div>

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
                            status: isDirty ? "editing" : "saved", 

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
                                type: s.type as any,
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
                                <SelectItem value="HTTP">HTTP Request</SelectItem>
                                <SelectItem value="Delay">Delay</SelectItem>
                                <SelectItem value="Tool">Tool</SelectItem>
                                <SelectItem value="Document">Document Query</SelectItem>
                                <SelectItem value="Condition">Condition</SelectItem>
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

                          {/* Tools Render Sub-section */}
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
                                    <SelectItem value="browser">Browser</SelectItem>
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
                                        <SelectItem value="write">Write</SelectItem>
                                        <SelectItem value="append">Append</SelectItem>
                                        <SelectItem value="read">Read</SelectItem>
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
                                        <SelectItem value="screenshot">Screenshot</SelectItem>
                                        <SelectItem value="evaluate">Evaluate</SelectItem>
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
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}