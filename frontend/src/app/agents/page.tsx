"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Cpu, Thermometer, Zap } from "lucide-react";
import { useAssistantContext } from "@/context/assistant-context";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Agent = {
  _id: string;
  name: string;
  description?: string;
  status?: "active" | "inactive";
  workflows?: string;
  config?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { addToast } = useToast();
  const { setContext, clearContext } = useAssistantContext();

  function getProviderColor(provider?: string) {
    switch (provider) {
      case "groq":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "openai":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "gemini":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ollama":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "huggingface":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  }

  async function fetchAgents() {
  try {
    console.log("Fetching agents...");
    setLoading(true);
    const res = await fetch(apiUrl("/agents"), {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });
   
    const data = await res.json();
    if (data.ok) {
      setAgents(data.agents as Agent[]);
    }
 } catch (err) {
  console.error("Error fetching agents:", err);
} finally {
  setLoading(false);
}
}

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (loading) return;

    setContext({
      page: "agents",

      status: `${agents.length} agent(s) available`,

      recentActivity: agents.map((agent) => ({
        type: "workflow", // semantic: agents power workflows
        name: agent.name,
        status:
          agent.status ??
          (agent.config?.model ? "configured" : "missing config"),
      })),
    });

    return () => {
      clearContext();
    };
  }, [loading, agents.length]);

  async function deleteAgent(id: string) {
    if (!confirm("Delete this agent?")) return;

    await fetch(apiUrl(`/agents/${id}`), {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    fetchAgents();
    addToast({
      type: "success",
      title: "Agent deleted successfully",
      description: "Your agent was deleted successfully",
    });
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
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">AI Agents</h1>
                <p className="mt-2 text-muted-foreground">
                  Manage your AI agents and their configurations
                </p>
              </div>

              <CreateAgentModal onCreated={fetchAgents} />
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((skeletonId) => (
                  <Card key={skeletonId} className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-3/4 rounded-md" />
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <Skeleton className="h-4 w-1/2 rounded-md" />
                      <Skeleton className="h-4 w-2/3 rounded-md" />
                      <Skeleton className="h-4 w-full rounded-md" />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Skeleton className="h-9 flex-1 rounded-md" />
                      <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <p className="opacity-60">No agents created yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <Card
                    key={agent._id}
                    className="p-6"
                    onClick={() =>
                      setContext({
                        page: "agents",
                        agentId: agent._id,
                        agentName: agent.name,
                        model: agent.config?.model,
                        temperature: agent.config?.temperature,
                      })
                    }
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                        <Cpu className="size-6 text-primary" />
                      </div>

                      <Badge variant={agent.status === "active" ? "success" : "secondary"}>
                        {agent.status ?? "idle"}
                      </Badge>
                    </div>

                    <h3 className="text-lg font-semibold">{agent.name}</h3>

                    <Badge
                      variant="outline"
                      className={`mt-2 ${getProviderColor(agent.config?.provider)}`}
                    >
                      {agent.config?.provider ?? "unknown"} •{" "}
                      {agent.config?.model ?? "default"}
                    </Badge>

                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Model</span>
                        <span className="font-mono text-xs">
                          {agent.config?.model ?? "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Thermometer className="size-4" />
                          <span>Temperature</span>
                        </div>
                        <span className="font-medium">
                          {agent.config?.temperature ?? "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Zap className="size-4" />
                          <span>Max Tokens</span>
                        </div>
                        <span className="font-medium">
                          {agent.config?.maxTokens ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Used in</span>
                        <span className="font-medium">
                          {agent.workflows ?? "—"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteAgent(agent._id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

type CreateAgentModalProps = {
  onCreated?: () => void;
};

export function CreateAgentModal({ onCreated }: CreateAgentModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"llm" | "tool">("llm");

  const [providers, setProviders] = useState<any>(null);
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);

  const { addToast } = useToast();

  /* ------------------------------
     Fetch Providers on Open
  ------------------------------ */
  useEffect(() => {
    if (!open) return;

    async function loadProviders() {
      try {
        const res = await fetch(apiUrl("/system/providers"), {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
        });

        const data = await res.json();
        if (data.ok) {
          setProviders(data.providers);
        }
      } catch (err) {
        console.error("Failed to load providers", err);
      }
    }

    loadProviders();
  }, [open]);

  /* ------------------------------
     Create Agent
  ------------------------------ */
  async function createAgent() {
    if (!provider || !model) {
      addToast({
        type: "error",
        title: "Missing configuration",
        description: "Select provider and model",
      });
      return;
    }

    try {
      setLoading(true);

      const body = {
        name,
        config: {
          provider,
          model,
          temperature,
        },
      };

      const res = await fetch(apiUrl("/agents"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);

      setOpen(false);
      setName("");
      setProvider("");
      setModel("");
      setTemperature(0.7);

      onCreated?.();

      addToast({
        type: "success",
        title: "Agent created successfully",
        description: "Your agent was created successfully",
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Failed to create agent",
        description: "There was an error creating the agent",
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedProvider = providers?.[provider];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Agent</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            Configure an AI agent that can run workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label>Agent Name</Label>
            <Input
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Provider */}
          <div>
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v);
                setModel("");
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers &&
                  Object.entries(providers).map(([key, value]: any) => (
                    <SelectItem
                      key={key}
                      value={key}
                      disabled={!value.available}
                    >
                      {key}
                      {!value.available && " (Unavailable)"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          {provider && (
            <div>
              <Label>Model</Label>

              {selectedProvider?.models?.length > 0 ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProvider.models.map((m: string) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input
                    className="mt-1.5"
                    placeholder="Enter model name manually"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    No predefined models found. Enter manually.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Temperature */}
          <div>
            <Label>Temperature</Label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.1}
              className="mt-1.5"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={createAgent} disabled={loading || !name.trim()}>
            {loading ? "Creating…" : "Create Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
