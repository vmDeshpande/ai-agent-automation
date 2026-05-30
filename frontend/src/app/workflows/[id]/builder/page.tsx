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
import { Save, Plus, Trash2 } from "lucide-react";
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
type StepType = "LLM" | "HTTP" | "Delay" | "Tool" | "Document" | "Condition" | "Switch";
type ToolType = "email" | "file" | "browser";

type WorkflowStep = {
  id: string;
  type: StepType;
  name: string;
  position?: { x: number; y: number };
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
  cases?: { value: string; target: string }[];
  defaultTarget?: string;
};

type BackendStep = {
  name: string;
  stepId: string;
  type: "LLM" | "HTTP" | "Delay" | "Tool" | "llm" | "http" | "delay" | "condition" | "switch" | "document_query" | "file" | "email" | "browser";
  prompt?: string;
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;
  seconds?: number;
};

type WorkflowResponse = {
  _id: string;
  name: string;
  metadata?: { steps?: BackendStep[]; edges?: any[] };
};

/* ---------------- UTILS ---------------- */
function getTypeColor(type: StepType) {
  switch (type) {
    case "LLM": return "bg-primary/20 text-primary border-primary/30";
    case "HTTP": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "Delay": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "Tool": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "Document": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "Condition": return "bg-rose-500/20 text-rose-400 border-rose-500/30";
    case "Switch": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function summarizeStep(step: WorkflowStep) {
  switch (step.type) {
    case "LLM": return step.prompt ? `Prompt: ${step.prompt.slice(0, 120)}...` : "No prompt configured";
    case "HTTP": return `${step.method ?? "GET"} | ${step.url || "No URL set"}`;
    case "Delay": return `Delay for ${step.delay ?? 0} seconds`;
    case "Document": return step.query ? `Query: ${step.query.slice(0, 120)}...` : "No query configured";
    case "Condition": return `Condition: ${step.conditionType || "Unconfigured"}`;
    case "Switch": return "Switch routing engine step";
    case "Tool": return step.tool ? `Tool: ${step.tool}` : "Tool not selected";
    default: return "Unknown step";
  }
}

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

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  async function fetchWorkflow() {
    try {
      const res = await fetch(apiUrl(`/workflows/${id}`), {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") },
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
        type: s.type === "delay" ? "Delay" : s.type === "http" ? "HTTP" : s.type === "condition" ? "Condition" : s.type === "switch" ? "Switch" : s.type === "document_query" ? "Document" : s.type === "file" || s.type === "email" || s.type === "browser" ? "Tool" : "LLM",
        position: (s as any).position || { x: 0, y: 0 },
        useMemory: (s as any).useMemory ?? false,
        memoryTopK: (s as any).memoryTopK ?? 5,
        prompt: s.prompt ?? "",
        url: s.url ?? "",
        method: s.method ?? "GET",
        body: s.body ?? "",
        delay: s.type === "delay" ? (s.seconds ?? 0) : 0,
        tool: s.type === "file" || s.type === "email" || s.type === "browser" ? (s.type as ToolType) : undefined,
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
        conditionType: (s as any).conditionType ?? "boolean",
        operator: (s as any).operator ?? "equals",
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchWorkflow(); }, [id]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "Unsaved configuration changes will be lost.";
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
      builderSteps: steps.map((s) => ({ id: s.id, name: s.name, type: s.type as any, summary: summarizeStep(s) })),
    });
    return () => { clearContext(); };
  }, [id, workflowName, steps.length]);

  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await fetch(apiUrl("/documents"), {
          headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        });
        const data = await res.json();
        if (data.ok) setDocuments(data.documents || []);
      } catch (err) {
        console.error("Failed to fetch documents", err);
      }
    }
    fetchDocs();
  }, []);

  function addStep() {
    setIsDirty(true);
    setSteps((prev) => [...prev, { id: uuidv4(), type: "LLM", name: "New Step", prompt: "" }]);
  }

  function removeStep(stepId: string) {
    setIsDirty(true);
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  }

  function updateStep(stepId: string, patch: Partial<WorkflowStep>) {
    setIsDirty(true);
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
  }

  function enrichStepsWithEdges(steps: WorkflowStep[], edges: any[]) {
    return steps.map((step) => {
      if (step.type === "Switch") {
        const outgoing = edges.filter((e) => e.source === step.id);
        const cases = outgoing.filter((e) => e.caseValue).map((e) => ({ value: e.caseValue, target: e.target }));
        const fallback = outgoing.find((e) => !e.caseValue);
        return { ...step, cases, defaultTarget: fallback?.target };
      }
      if (step.type === "Condition") {
        const trueEdge = edges.find((e) => e.source === step.id && e.condition === "true");
        const falseEdge = edges.find((e) => e.source === step.id && e.condition === "false");
        return { ...step, trueTarget: trueEdge?.target, falseTarget: falseEdge?.target };
      }
      return step;
    });
  }

  async function saveWorkflow() {
    try {
      setIsSaving(true);
      const enrichedSteps = enrichStepsWithEdges(steps, edges);
      const backendSteps = enrichedSteps.map((s) => {
        const base: any = { stepId: s.id, name: s.name, position: s.position };
        if (s.type === "LLM") return { ...base, type: "llm", prompt: s.prompt ?? "", useMemory: s.useMemory ?? false, memoryTopK: s.memoryTopK ?? 5 };
        if (s.type === "Delay") return { ...base, type: "delay", seconds: s.delay ?? 0 };
        if (s.type === "HTTP") return { ...base, type: "http", method: s.method ?? "GET", url: s.url ?? "", body: s.body ?? "" };
        if (s.type === "Document") return { ...base, type: "document_query", documentId: s.documentId, query: s.query, topK: s.topK ?? 4 };
        if (s.type === "Condition") return { ...base, type: "condition", conditionType: s.conditionType, operator: s.operator, value: s.value, trueTarget: s.trueTarget, falseTarget: s.falseTarget };
        if (s.type === "Switch") return { ...base, type: "switch" };
        if (s.type === "Tool" && s.tool) {
          const toolType = s.tool.toLowerCase();
          if (toolType === "file") return { ...base, type: "file", action: s.action ?? "read", path: s.path ?? "", content: s.content ?? "" };
          if (toolType === "email") return { ...base, type: "email", to: s.to ?? "", subject: s.subject ?? "", text: s.text ?? "", html: s.html ?? "" };
          if (toolType === "browser") return { ...base, type: "browser", action: s.action ?? "screenshot", url: s.url ?? "", code: s.code ?? "" };
        }
        return { ...base, type: "unknown" };
      });

      const res = await fetch(apiUrl(`/workflows/${id}/steps`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ steps: backendSteps, edges: edges }),
      });

      if (!res.ok) throw new Error("Failed to save workflow");

      setIsDirty(false);
      addToast({ type: "success", title: "Workflow saved", description: "Changes updated successfully" });
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Failed to save workflow", description: "Something went wrong." });
    } finally {
      // ✅ FIXED: Replaced 'fillAll:' typo with standard clean 'finally' block
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 pl-64 p-8">
          <p className="opacity-70">Loading workspace...</p>
        </main>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1 pl-64 p-8">
          <div className="mx-auto max-w-4xl">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Workflow Builder</h1>
                <div className="mt-4 flex gap-2">
                  <Button variant={builderMode === "list" ? "default" : "outline"} size="sm" onClick={() => setBuilderMode("list")}>
                    Step Builder
                  </Button>
                  <Button variant={builderMode === "visual" ? "default" : "outline"} size="sm" onClick={() => setBuilderMode("visual")}>
                    Visual Graph
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => isDirty ? setShowExitModal(true) : router.push(`/workflows/${id}`)}>
                  ← Back
                </Button>
                <Button onClick={saveWorkflow} disabled={isSaving}>
                  <Save className="mr-2 size-4" />
                  {isSaving ? "Saving..." : "Save Workflow"}
                </Button>
              </div>
            </div>

            {builderMode === "visual" && (
              <VisualBuilder steps={steps} setSteps={(s) => { setIsDirty(true); setSteps(s); }} edges={edges} onEdgesChange={(e) => { setIsDirty(true); setEdges(e); }} />
            )}

            {builderMode === "list" && (
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {steps.map((step, index) => (
                    <motion.div key={step.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Card className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
                            <Badge variant="outline" className={getTypeColor(step.type)}>{step.type}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeStep(step.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Step Type</Label>
                              <Select value={step.type} onValueChange={(v) => updateStep(step.id, { type: v as StepType })}>
                                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
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
                              <Input className="mt-1.5" value={step.name} onChange={(e) => updateStep(step.id, { name: e.target.value })} />
                            </div>
                          </div>

                          {/* LLM Options */}
                          {step.type === "LLM" && (
                            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
                              <div>
                                <Label>Prompt Template</Label>
                                <Textarea className="mt-1.5" placeholder="Instructions for the LLM..." value={step.prompt ?? ""} onChange={(e) => updateStep(step.id, { prompt: e.target.value })} />
                              </div>
                              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer pt-1">
                                <input type="checkbox" className="rounded border-gray-300 size-4" checked={step.useMemory ?? false} onChange={(e) => updateStep(step.id, { useMemory: e.target.checked })} />
                                Enable Vector Memory
                              </label>
                              {step.useMemory && (
                                <div className="w-1/3">
                                  <Label>Memory Top K</Label>
                                  <Input type="number" className="mt-1.5" value={step.memoryTopK ?? 5} onChange={(e) => updateStep(step.id, { memoryTopK: parseInt(e.target.value) || 5 })} />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Document Options */}
                          {step.type === "Document" && (
                            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
                              <div>
                                <Label>Document Reference</Label>
                                <Select value={step.documentId ?? ""} onValueChange={(v) => updateStep(step.id, { documentId: v })}>
                                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select vector document..." /></SelectTrigger>
                                  <SelectContent>
                                    {documents.map((doc) => <SelectItem key={doc._id} value={doc._id}>{doc.name || doc.filename}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                  <Label>Semantic Query</Label>
                                  <Input className="mt-1.5" placeholder="Search parameters..." value={step.query ?? ""} onChange={(e) => updateStep(step.id, { query: e.target.value })} />
                                </div>
                                <div>
                                  <Label>Top K Results</Label>
                                  <Input type="number" className="mt-1.5" value={step.topK ?? 4} onChange={(e) => updateStep(step.id, { topK: parseInt(e.target.value) || 4 })} />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Condition Options */}
                          {step.type === "Condition" && (
                            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <Label>Evaluation Mode</Label>
                                  <Select value={step.conditionType ?? "boolean"} onValueChange={(v) => updateStep(step.id, { conditionType: v as any })}>
                                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="boolean">Boolean</SelectItem>
                                      <SelectItem value="sentiment">Sentiment</SelectItem>
                                      <SelectItem value="contains">Contains</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Operator</Label>
                                  <Input className="mt-1.5" placeholder="e.g. eq, gt" value={step.operator ?? ""} onChange={(e) => updateStep(step.id, { operator: e.target.value })} />
                                </div>
                                <div>
                                  <Label>Value</Label>
                                  <Input className="mt-1.5" placeholder="Target value" value={step.value ?? ""} onChange={(e) => updateStep(step.id, { value: e.target.value })} />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* HTTP Options */}
                          {step.type === "HTTP" && (
                            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
                              <div className="grid grid-cols-4 gap-4">
                                <div>
                                  <Label>Method</Label>
                                  <Select value={step.method ?? "GET"} onValueChange={(v) => updateStep(step.id, { method: v as any })}>
                                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="GET">GET</SelectItem>
                                      <SelectItem value="POST">POST</SelectItem>
                                      <SelectItem value="PUT">PUT</SelectItem>
                                      <SelectItem value="DELETE">DELETE</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="col-span-3">
                                  <Label>URL</Label>
                                  <Input className="mt-1.5" placeholder="https://api.example.com" value={step.url ?? ""} onChange={(e) => updateStep(step.id, { url: e.target.value })} />
                                </div>
                              </div>
                              <div>
                                <Label>Body (JSON String)</Label>
                                <Textarea className="mt-1.5 font-mono text-xs" placeholder='{ "key": "value" }' value={step.body ?? ""} onChange={(e) => updateStep(step.id, { body: e.target.value })} />
                              </div>
                            </div>
                          )}

                          {/* Delay Options */}
                          {step.type === "Delay" && (
                            <div className="rounded-md border p-4 bg-muted/10">
                              <Label>Duration (Seconds)</Label>
                              <Input type="number" className="mt-1.5 w-1/3" value={step.delay ?? 0} onChange={(e) => updateStep(step.id, { delay: parseInt(e.target.value) || 0 })} />
                            </div>
                          )}

                          {/* Tool Options */}
                          {step.type === "Tool" && (
                            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
                              <div>
                                <Label>Select Tool</Label>
                                <Select value={step.tool} onValueChange={(v) => updateStep(step.id, { tool: v as any })}>
                                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose tool..." /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="email">Email Client</SelectItem>
                                    <SelectItem value="file">File System</SelectItem>
                                    <SelectItem value="browser">Headless Browser</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {step.tool === "email" && (
                                <div className="space-y-3 pt-2">
                                  <div><Label>To</Label><Input className="mt-1" value={step.to ?? ""} onChange={(e) => updateStep(step.id, { to: e.target.value })} /></div>
                                  <div><Label>Subject</Label><Input className="mt-1" value={step.subject ?? ""} onChange={(e) => updateStep(step.id, { subject: e.target.value })} /></div>
                                  <div><Label>Body</Label><Textarea className="mt-1" value={step.text ?? ""} onChange={(e) => updateStep(step.id, { text: e.target.value })} /></div>
                                </div>
                              )}

                              {step.tool === "file" && (
                                <div className="space-y-3 pt-2">
                                  <div>
                                    <Label>Action</Label>
                                    <Select value={step.action ?? "read"} onValueChange={(v) => updateStep(step.id, { action: v })}>
                                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="read">Read</SelectItem>
                                        <SelectItem value="write">Write</SelectItem>
                                        <SelectItem value="append">Append</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div><Label>Path</Label><Input className="mt-1" placeholder="./file.txt" value={step.path ?? ""} onChange={(e) => updateStep(step.id, { path: e.target.value })} /></div>
                                  {step.action !== "read" && <div><Label>Content</Label><Textarea className="mt-1" value={step.content ?? ""} onChange={(e) => updateStep(step.id, { content: e.target.value })} /></div>}
                                </div>
                              )}

                              {step.tool === "browser" && (
                                <div className="space-y-3 pt-2">
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <Label>Action Mode</Label>
                                      <Select value={step.action ?? "screenshot"} onValueChange={(v) => updateStep(step.id, { action: v })}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="screenshot">Screenshot</SelectItem>
                                          <SelectItem value="scrape">Scrape Text</SelectItem>
                                          <SelectItem value="evaluate">Evaluate Code</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="col-span-2"><Label>URL</Label><Input className="mt-1" placeholder="https://example.com" value={step.url ?? ""} onChange={(e) => updateStep(step.id, { url: e.target.value })} /></div>
                                  </div>
                                  {step.action === "evaluate" && (
                                    <div>
                                      <Label>Playwright JS Code</Label>
                                      <Textarea className="mt-1 font-mono text-xs h-32 bg-slate-950 text-emerald-400 border-slate-800" value={step.code ?? ""} onChange={(e) => updateStep(step.id, { code: e.target.value })} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <Button className="w-full py-6 border-dashed" variant="outline" onClick={addStep}>
                  <Plus className="mr-2 size-4" /> Add Workflow Step
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Unsaved changes dialog */}
      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-destructive">Unsaved Changes</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You have unsaved changes in your workspace. Leaving now will discard them permanently.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowExitModal(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => { setIsDirty(false); setShowExitModal(false); router.push(`/workflows/${id}`); }}>
                  Discard
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AuthGuard>
  );
}