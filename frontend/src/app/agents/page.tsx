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
import { useToast } from "@/hooks/use-toast";
type Agent = {
  _id: string;
  name: string;
  description?: string;
  status?: "active" | "inactive";
  config?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
};

function getProviderColor(model?: string) {
  if (!model) return "bg-muted text-muted-foreground";

  if (model.toLowerCase().includes("gpt"))
    return "bg-green-500/20 text-green-400 border-green-500/30";
  if (model.toLowerCase().includes("claude"))
    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (model.toLowerCase().includes("gemini"))
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";

  return "bg-muted text-muted-foreground";
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { addToast } = useToast();
  const { setContext, clearContext } = useAssistantContext();

  async function fetchAgents() {
    try {
      const res = await fetch("http://localhost:5000/api/agents", {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json();
      if (data.ok) setAgents(data.agents as Agent[]);
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

    await fetch(`http://localhost:5000/api/agents/${id}`, {
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
              <p className="opacity-70">Loading agents…</p>
            ) : agents.length === 0 ? (
              <p className="opacity-60">No agents created yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {agents.map(
                  (agent) => (
                    console.log(agent),
                    (
                      <Card
                        key={agent._id}
                        className="p-6"
                        onClick={() =>
                          setContext({
                            page: "agents",
                            agentId: agent._id,
                            agentName: agent.name,
                            model: agent.config?.model,
                            temperature: agent.config?.temperature
                          })
                        }
                      >
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                            <Cpu className="size-6 text-primary" />
                          </div>

                          <Badge
                            className={
                              agent.status === "active"
                                ? "bg-success/20 text-success border-success/30"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {agent.status ?? "idle"}
                          </Badge>
                        </div>

                        <h3 className="text-lg font-semibold">{agent.name}</h3>

                        <Badge
                          variant="outline"
                          className={`mt-2 ${getProviderColor(
                            agent.config?.model
                          )}`}
                        >
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
                            <span className="text-muted-foreground">
                              Used in
                            </span>
                            <span className="font-medium">2 workflows</span>
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
                    )
                  )
                )}
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
  const [model, setModel] = useState("gpt-4");
  const [temperature, setTemperature] = useState(0.7);
  const { addToast } = useToast();

  async function createAgent() {
    try {
      setLoading(true);

      const body = {
        name,
        config: {
          model,
          temperature,
        },
      };

      const res = await fetch("http://localhost:5000/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create agent");
      }

      // ✅ reset + close
      setOpen(false);
      setName("");
      setType("llm");
      setModel("gpt-4");
      setTemperature(0.7);

      onCreated?.();
      addToast({
        type: "success",
        title: "Agent created successfully",
        description: "Your agent was created successfully",
      });
    } catch (err) {
      console.error("Create agent failed:", err);
      // alert("Failed to create agent");
      addToast({
        type: "error",
        title: "Failed to create agent",
        description: "There was an error creating the agent. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Agent</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            Configure an AI agent that can run workflows and tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label>Agent Name</Label>
            <Input
              className="mt-1.5"
              placeholder="e.g. Research Agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Type */}
          <div>
            <Label>Agent Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v as any)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llm">LLM Agent</SelectItem>
                <SelectItem value="tool">Tool Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          <div>
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llama-3.1-8b-instant">
                  LLaMA 3.1 8B Instant
                </SelectItem>
                <SelectItem value="llama-3.3-70b-versatile">
                  LLaMA 3.3 70B Versatile
                </SelectItem>
                <SelectItem value="gemini-1.5-flash">
                  Gemini 1.5 Flash
                </SelectItem>
                <SelectItem value="gemma2-9b-it">Gemma2 9b It</SelectItem>
                <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
            <p className="mt-1 text-xs text-muted-foreground">
              Controls creativity (0 = deterministic, 1 = creative)
            </p>
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
