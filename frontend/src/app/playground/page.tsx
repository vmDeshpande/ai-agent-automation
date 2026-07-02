"use client";

import { useState, useEffect, useRef } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Brain, Play, Cpu, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
type Agent = {
  _id: string;
  name: string;
  description?: string;
  config?: {
    provider?: string;
    model?: string;
    temperature?: number;
  };
};

type MemoryEntry = {
  content: string;
  score: number;
  createdAt: string;
};

type RunResult = {
  response: string;
  retrievedMemory: MemoryEntry[];
  meta: {
    provider: string;
    model: string;
    temperature: number;
  };
};

/* ─── Page ───────────────────────────────────────────────── */
function PlaygroundInner() {
  const { addToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [useMemory, setUseMemory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const selectedAgent = agents.find((a) => a._id === selectedAgentId);

  /* ── Fetch agents ── */
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch(apiUrl("/agents"), {
          headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        });
        const data = await res.json();
        if (data.ok) setAgents(data.agents);
      } catch {
        addToast({ type: "error", title: "Failed to load agents" });
      }
    }
    fetchAgents();
  }, []);

  /* ── Run agent ── */
  async function handleRun() {
    if (!selectedAgentId) {
      addToast({ type: "error", title: "Select an agent first" });
      return;
    }
    if (!prompt.trim()) {
      addToast({ type: "error", title: "Enter a prompt" });
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const res = await fetch(apiUrl(`/agents/${selectedAgentId}/run`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ prompt, useMemory }),
      });

      const data = await res.json();

      if (!data.ok) {
        addToast({ type: "error", title: data.error || "Run failed" });
        return;
      }

      setResult(data);
      if (data.retrievedMemory?.length > 0) setMemoryOpen(true);
    } catch {
      addToast({ type: "error", title: "Something went wrong" });
    } finally {
      setLoading(false);
    }
  }

  /* ── Reset ── */
  function handleReset() {
    setPrompt("");
    setResult(null);
    setMemoryOpen(false);
    textareaRef.current?.focus();
  }

  /* ── Provider color ── */
  function providerColor(provider?: string) {
    switch (provider) {
      case "groq":       return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "openai":     return "bg-green-500/20 text-green-400 border-green-500/30";
      case "gemini":     return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ollama":     return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "huggingface":return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:           return "bg-muted text-muted-foreground";
    }
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />

      <main
        className="flex-1 transition-[padding] duration-300"
        style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
      >
        <div className="p-8 max-w-5xl">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Agent Playground</h1>
            <p className="mt-2 text-muted-foreground">
              Test your agents directly without creating a workflow
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* ── Left: Config panel ── */}
            <div className="space-y-4 lg:col-span-1">

              {/* Agent selector */}
              <Card className="p-4 space-y-3">
                <p className="text-sm font-semibold">Select Agent</p>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.length === 0 && (
                      <SelectItem value="none" disabled>
                        No agents found
                      </SelectItem>
                    )}
                    {agents.map((a) => (
                      <SelectItem key={a._id} value={a._id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Agent info */}
                {selectedAgent && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="size-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {selectedAgent.name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${providerColor(selectedAgent.config?.provider)}`}
                    >
                      {selectedAgent.config?.provider ?? "unknown"} •{" "}
                      {selectedAgent.config?.model ?? "default"}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Temperature: {selectedAgent.config?.temperature ?? "—"}
                    </div>
                    {selectedAgent.description && (
                      <p className="text-xs text-muted-foreground">
                        {selectedAgent.description}
                      </p>
                    )}
                  </div>
                )}
              </Card>

              {/* Memory toggle */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="size-4 text-primary" />
                    <span className="text-sm font-semibold">Semantic Memory</span>
                  </div>
                  <button
                    onClick={() => setUseMemory((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      useMemory ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useMemory ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {useMemory
                    ? "Agent will retrieve and store memory for this session"
                    : "Memory is disabled for this run"}
                </p>
              </Card>
            </div>

            {/* ── Right: Prompt + Response ── */}
            <div className="space-y-4 lg:col-span-2">

              {/* Prompt input */}
              <Card className="p-4 space-y-3">
                <p className="text-sm font-semibold">Prompt</p>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleRun();
                  }}
                  placeholder="Write your prompt here... (Ctrl+Enter to run)"
                  rows={6}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleRun}
                    disabled={loading || !selectedAgentId || !prompt.trim()}
                    className="flex items-center gap-2"
                  >
                    <Play className="size-4" />
                    {loading ? "Running..." : "Run Agent"}
                  </Button>
                  <Button variant="outline" onClick={handleReset} disabled={loading}>
                    <RotateCcw className="size-4" />
                  </Button>
                </div>
              </Card>

              {/* Response */}
              {result && (
                <>
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Response</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className={`text-xs ${providerColor(result.meta.provider)}`}>
                          {result.meta.provider} • {result.meta.model}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          temp: {result.meta.temperature}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
                      {result.response}
                    </div>
                  </Card>

                  {/* Retrieved memory */}
                  {useMemory && (
                    <Card className="p-4">
                      <button
                        onClick={() => setMemoryOpen((v) => !v)}
                        className="flex w-full items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Brain className="size-4 text-primary" />
                          <span className="text-sm font-semibold">
                            Retrieved Memory
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {result.retrievedMemory.length} entries
                          </Badge>
                        </div>
                        {memoryOpen ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </button>

                      {memoryOpen && (
                        <div className="mt-3 space-y-2">
                          {result.retrievedMemory.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No relevant memory found for this prompt.
                            </p>
                          ) : (
                            result.retrievedMemory.map((m, i) => (
                              <div
                                key={i}
                                className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                              >
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    Score:{" "}
                                    <span className="font-medium text-primary">
                                      {m.score}
                                    </span>
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(m.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-xs leading-relaxed">{m.content}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </Card>
                  )}
                </>
              )}

              {/* Empty state */}
              {!result && !loading && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                  <Play className="mb-3 size-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Select an agent and run a prompt
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Results will appear here
                  </p>
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-border py-16 text-center">
                  <div className="mb-3 size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">Agent is thinking...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <AuthGuard>
      <PlaygroundInner />
    </AuthGuard>
  );
}
