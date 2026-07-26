'use client';

import { useState, useEffect, useRef } from 'react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Brain,
  Play,
  Cpu,
  RotateCcw,
  Sparkles,
  Bot,
  Database as DatabaseIcon,
  User,
  Activity,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

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
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [useMemory, setUseMemory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const selectedAgent = agents.find((a) => a._id === selectedAgentId);

  /* ── Fetch agents ── */
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch(apiUrl('/agents'), {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
        });
        const data = await res.json();
        if (data.ok) setAgents(data.agents);
      } catch {
        addToast({ type: 'error', title: 'Failed to load agents' });
      }
    }
    fetchAgents();
  }, []);

  /* ── Run agent ── */
  async function handleRun() {
    if (!selectedAgentId) {
      addToast({ type: 'error', title: 'Select an agent first' });
      return;
    }
    if (!prompt.trim()) {
      addToast({ type: 'error', title: 'Enter a prompt' });
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      setLastPrompt(prompt); // Save the prompt that was actually run

      const res = await fetch(apiUrl(`/agents/${selectedAgentId}/run`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({ prompt, useMemory }),
      });

      const data = await res.json();

      if (!data.ok) {
        addToast({ type: 'error', title: data.error || 'Run failed' });
        return;
      }

      setResult(data);
    } catch {
      addToast({ type: 'error', title: 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  }

  /* ── Reset ── */
  function handleReset() {
    setPrompt('');
    setLastPrompt('');
    setResult(null);
    textareaRef.current?.focus();
  }

  /* ── Provider color ── */
  function providerColor(provider?: string) {
    switch (provider?.toLowerCase()) {
      case 'groq':
      case 'openai':
      case 'gemini':
      case 'ollama':
      case 'huggingface':
        return 'border-primary/20 bg-primary/10 text-primary';
      default:
        return 'border-border bg-muted text-muted-foreground';
    }
  }

  return (
    <div className="flex flex-col lg:flex-row border border-border/50 rounded-2xl bg-background/50 backdrop-blur-sm shadow-sm">
      {/* ── Left/Center: Main Execution Area ── */}
      <div className="flex flex-col flex-1 border-r border-border/50 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Agent Workspace</h1>
              <p className="text-xs text-muted-foreground">Interactive execution sandbox</p>
            </div>
          </div>

          <div className="w-[280px]">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="bg-background/50 border-border/50 shadow-sm transition-all focus:ring-primary/30 h-10">
                <SelectValue placeholder="Select an active agent..." />
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
          </div>
        </div>

        {/* Output Area */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto w-full pb-8">
            {/* Empty state */}
            {!result && !loading && !lastPrompt && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/5 py-24 text-center mt-12 backdrop-blur-sm">
                <div className="rounded-full bg-primary/5 p-4 mb-4 border border-primary/10">
                  <Play className="size-8 text-primary/40 ml-1" />
                </div>
                <p className="text-base font-medium text-foreground">Ready for Execution</p>
                <p className="mt-2 text-sm text-muted-foreground max-w-[280px]">
                  Select an agent from the dropdown, configure your context, and dispatch a prompt.
                </p>
              </div>
            )}

            {/* Chat-style Execution Flow */}
            {(lastPrompt || loading) && (
              <div className="space-y-6">
                {/* USER BUBBLE */}
                <div className="flex flex-col items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                      USER
                    </span>
                    <div className="size-6 rounded-full bg-muted/50 border border-border/50 flex items-center justify-center">
                      <User className="size-3.5 text-foreground/70" />
                    </div>
                  </div>
                  <div className="rounded-2xl rounded-tr-sm border border-border/40 bg-muted/30 px-5 py-4 text-sm max-w-[85%] shadow-sm leading-relaxed text-foreground/90 font-sans">
                    {lastPrompt}
                  </div>
                </div>

                {/* TIMELINE / LIFECYCLE (Visualizer) */}
                <div className="flex justify-end pr-3">
                  <div className="h-6 w-px bg-border/50"></div>
                </div>

                <div className="flex flex-col items-end animate-in fade-in duration-500 delay-150">
                  <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground bg-background/50 border border-border/40 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3 text-primary/70" />
                      <span>Agent_Selected</span>
                    </div>
                    <span className="text-border/50">|</span>
                    <div className="flex items-center gap-1.5">
                      {useMemory ? (
                        <CheckCircle2 className="size-3 text-primary/70" />
                      ) : (
                        <Circle className="size-3 text-muted-foreground/30" />
                      )}
                      <span className={useMemory ? 'text-primary/70' : 'text-muted-foreground/50'}>
                        Memory_Retrieval
                      </span>
                    </div>
                    <span className="text-border/50">|</span>
                    <div className="flex items-center gap-1.5">
                      {loading ? (
                        <div className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3 text-primary/70" />
                      )}
                      <span className={loading ? 'text-primary animate-pulse' : 'text-primary/70'}>
                        {loading ? 'Generating_Response...' : 'Response_Generated'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pr-3">
                  <div className="h-6 w-px bg-border/50"></div>
                </div>

                {/* AGENT RESPONSE BUBBLE */}
                {result && !loading && (
                  <div className="flex flex-col items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-2 w-full justify-between max-w-[85%]">
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-mono bg-background/50"
                      >
                        {result.meta.provider} / {result.meta.model}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary tracking-wider uppercase">
                          AGENT RESPONSE
                        </span>
                        <div className="size-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Bot className="size-3.5 text-primary" />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl rounded-tr-sm border border-primary/20 bg-primary/5 px-6 py-5 text-sm w-full max-w-[85%] shadow-[0_4px_20px_-10px_rgba(var(--primary),0.1)] leading-relaxed text-foreground font-sans whitespace-pre-wrap">
                      {result.response}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="p-4 bg-background/80 border-t border-border/50 backdrop-blur-md shrink-0 sticky bottom-0 z-10">
          <div className="max-w-4xl mx-auto relative rounded-2xl border border-border/60 bg-background shadow-sm focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all overflow-hidden">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRun();
              }}
              placeholder="Write your prompt here... (Ctrl+Enter to run)"
              rows={4}
              className="w-full resize-none bg-transparent px-4 py-4 text-sm focus:outline-none scrollbar-hide text-foreground placeholder:text-muted-foreground/50"
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2 bg-background/80 backdrop-blur-sm p-1 rounded-xl border border-border/40 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                disabled={loading}
                className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                title="Reset"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                onClick={handleRun}
                disabled={loading || !selectedAgentId || !prompt.trim()}
                className="h-8 px-4 flex items-center gap-2 rounded-lg shadow-sm transition-all hover:shadow-md border border-primary/50"
              >
                {loading ? (
                  <div className="size-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
                ) : (
                  <Play className="size-3" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {loading ? 'Running' : 'Dispatch'}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Sidebar Context ── */}
      <div className="w-full lg:w-[320px] bg-background/50 border-l border-border/50 flex flex-col shrink-0">
        <div className="flex-1">
          <div className="p-5 space-y-6">
            {/* Agent Profile Card */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Cpu className="size-3" />
                Agent Profile
              </h3>

              {selectedAgent ? (
                <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
                  {/* Card Header */}
                  <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="size-4 text-primary" />
                      <span className="font-semibold text-sm truncate max-w-[150px]">
                        {selectedAgent.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border border-green-500/20">
                      <div className="size-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      Active
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <span className="text-muted-foreground uppercase text-[10px] tracking-wider">
                          Provider
                        </span>
                        <p className="font-medium truncate">
                          {selectedAgent.config?.provider ?? 'Unknown'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground uppercase text-[10px] tracking-wider">
                          Model
                        </span>
                        <p className="font-medium truncate font-mono bg-muted/50 px-1 rounded inline-block">
                          {selectedAgent.config?.model ?? 'default'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between items-end">
                        <span className="text-muted-foreground uppercase text-[10px] tracking-wider">
                          Creativity (Temp)
                        </span>
                        <span className="font-mono text-[10px]">
                          {selectedAgent.config?.temperature ?? 0}
                        </span>
                      </div>
                      {/* Visual progress bar representing temperature (assuming 0-2 scale commonly, or 0-1) */}
                      <Progress
                        value={Math.min(((selectedAgent.config?.temperature ?? 0) / 2) * 100, 100)}
                        className="h-1.5 bg-muted"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 p-6 text-center">
                  <div className="mx-auto size-8 rounded-full bg-muted flex items-center justify-center mb-3 border border-border/50">
                    <Bot className="size-4 text-muted-foreground/50" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select an agent to view its profile parameters.
                  </p>
                </div>
              )}
            </div>

            {/* Memory Context Control */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Brain className="size-3" />
                Context Layer
              </h3>

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      Semantic Memory
                      {useMemory && <CheckCircle2 className="size-3 text-green-500" />}
                    </span>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {useMemory
                        ? 'Active memory retrieval enabled.'
                        : 'Operating without historical context.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setUseMemory((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background ${
                      useMemory ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform shadow-sm ${
                        useMemory ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Retrieved Memory Cards */}
            {useMemory && result?.retrievedMemory && result.retrievedMemory.length > 0 && (
              <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary flex items-center gap-2">
                  <DatabaseIcon className="size-3" />
                  Relevant Context ({result.retrievedMemory.length})
                </h3>

                <div className="space-y-2">
                  {result.retrievedMemory.map((m, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border/40 bg-card overflow-hidden shadow-sm hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/40">
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0 font-mono bg-primary/10 text-primary border-primary/20 rounded"
                        >
                          MEM
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground truncate">
                          Score: {(m.score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-xs leading-relaxed text-foreground/80 line-clamp-3 font-sans">
                          {m.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {useMemory && result && result.retrievedMemory?.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 p-4 text-center mt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  No semantic matches found
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <AuthenticatedLayout layout="default">
      <PlaygroundInner />
    </AuthenticatedLayout>
  );
}
