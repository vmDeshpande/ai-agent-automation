"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect } from "react";
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

/* ---------------- TYPES ---------------- */

type StepType = "LLM" | "HTTP" | "Delay" | "Tool";

type WorkflowStep = {
  id: string;
  type: StepType;
  name: string;

  // LLM
  prompt?: string;

  // HTTP
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string; // 🔥 ADD THIS

  // Delay
  delay?: number;
};

type BackendStep = {
  name: string;
  stepId: string;
  type: "LLM" | "HTTP" | "Delay" | "Tool";

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
  };
};

type BackendStepType = "llm" | "http" | "delay" | "tool";

type BackendStepPayload = {
  stepId: string;
  name: string;
  type: BackendStepType;

  prompt?: string;
  seconds?: number;

  method?: "GET" | "POST" | "PUT" | "DELETE";
  url?: string;
  body?: string;
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
    default:
      return "bg-muted text-muted-foreground";
  }
}

/* ---------------- PAGE ---------------- */

export default function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  async function fetchWorkflow() {
    try {
      const res = await fetch(`http://localhost:5000/api/workflows/${id}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json();
      if (!data.ok) return;

      const workflow: WorkflowResponse = data.workflow;

      const backendSteps = workflow.metadata?.steps ?? [];

      // 🔄 normalize backend steps → builder steps
      const normalizedSteps: WorkflowStep[] = backendSteps.map((s, index) => ({
        id: s.stepId,
        name: s.name,
        type:
          s.type === "delay"
            ? "Delay"
            : s.type === "http"
            ? "HTTP"
            : s.type === "tool"
            ? "Tool"
            : "LLM",

        prompt: s.prompt ?? "",
        url: s.url ?? "",
        method: s.method ?? "GET",
        body: s.body ?? "",
        delay: s.type === "delay" ? s.seconds ?? 0 : 0,
      }));

      setSteps(normalizedSteps);
    } catch (err) {
      console.error("Failed to load workflow", err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "LLM",
        name: "New Step",
        prompt: "",
      },
    ]);
  }

  async function saveWorkflow() {
    try {
      const backendSteps: BackendStepPayload[] = steps.map((s) => {
        const base: BackendStepPayload = {
          stepId: s.id,
          name: s.name,
          type:
            s.type === "LLM"
              ? "llm"
              : s.type === "HTTP"
              ? "http"
              : s.type === "Delay"
              ? "delay"
              : "tool",
        };

        if (s.type === "LLM") {
          return {
            ...base,
            prompt: s.prompt ?? "",
          };
        }

        if (s.type === "Delay") {
          return {
            ...base,
            seconds: s.delay ?? 0,
          };
        }

        if (s.type === "HTTP") {
          return {
            ...base,
            method: s.method ?? "GET",
            url: s.url ?? "",
            body: s.body ?? "",
          };
        }

        return base;
      });

      const res = await fetch(
        `http://localhost:5000/api/workflows/${id}/steps`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify({
            steps: backendSteps,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to save workflow");
      }
      // alert("✅ Workflow saved successfully");
      addToast({
        type: "success",
        title: "Workflow saved",
        description: "Your workflow steps were updated successfully",
      });
    } catch (err) {
      console.error("Save workflow failed:", err);
      // alert("❌ Failed to save workflow");
      addToast({
        type: "error",
        title: "Failed to save workflow",
        description: "Something went wrong. Try again.",
      });
    }
  }

  function removeStep(stepId: string) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  }

  function updateStep(stepId: string, patch: Partial<WorkflowStep>) {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s))
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
                <h1 className="text-3xl font-bold">Workflow Builder</h1>
                <p className="mt-2 text-muted-foreground">
                  Configure workflow steps and execution order
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Workflow ID: {id}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/workflows/${id}`)}
                >
                  ← Back to Workflow
                </Button>
                <Button variant="outline">
                  <Save className="mr-2 size-4" />
                  Save Draft
                </Button>
                <Button onClick={saveWorkflow}>
                  <Play className="mr-2 size-4" />
                  Save
                </Button>
              </div>
            </div>

            {/* Steps */}
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
                      key={step.id}
                      className="p-6 transition-shadow hover:shadow-lg"
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
                          onClick={() => removeStep(step.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {/* Step Type */}
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
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Step Name */}
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

                        {/* LLM */}
                        {step.type === "LLM" && (
                          <div>
                            <Label>Prompt</Label>
                            <Textarea
                              className="mt-1.5 min-h-[100px] font-mono text-sm"
                              value={step.prompt ?? ""}
                              onChange={(e) =>
                                updateStep(step.id, {
                                  prompt: e.target.value,
                                })
                              }
                            />
                          </div>
                        )}

                        {/* HTTP */}
                        {step.type === "HTTP" && (
                          <>
                            <div>
                              <Label>Method</Label>
                              <Select
                                value={step.method}
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
                                  <SelectItem value="DELETE">DELETE</SelectItem>
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
                            <div>
                              <Label>Body (JSON)</Label>
                              <Textarea
                                className="mt-1.5 min-h-[100px] font-mono text-sm"
                                value={step.body ?? ""}
                                onChange={(e) =>
                                  updateStep(step.id, {
                                    body: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </>
                        )}

                        {/* Delay */}
                        {step.type === "Delay" && (
                          <div>
                            <Label>Delay (seconds)</Label>
                            <Input
                              type="number"
                              className="mt-1.5"
                              value={step.delay ?? 0}
                              onChange={(e) =>
                                updateStep(step.id, {
                                  delay: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>

              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={addStep}
              >
                <Plus className="mr-2 size-4" />
                Add Step
              </Button>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
