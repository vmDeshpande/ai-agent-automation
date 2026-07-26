'use client';

import { useEffect, useState } from 'react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreVertical, Zap, AlertCircle, Cloud, Bot, Cpu, Thermometer } from 'lucide-react';
import { useAssistantContext } from '@/context/assistant-context';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

type Agent = {
  _id: string;
  name: string;
  description?: string;
  role?: string;
  objective?: string;
  systemInstructions?: string;
  avatar?: string;
  capabilities?: string[];
  status?: 'active' | 'inactive' | string;
  workflows?: string;
  config?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
};

function AgentActivityHeatmap({ tasks }: { tasks: any[] }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts = new Map<string, number>();
    tasks.forEach((task) => {
      if (task.createdAt) {
        const d = new Date(task.createdAt);
        const key = d.toISOString().split('T')[0];
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    let maxCount = 0;
    for (const count of counts.values()) {
      if (count > maxCount) maxCount = count;
    }

    const weeks = 52;
    const endDate = new Date(today);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - weeks * 7 + 1);

    // Align start to Sunday
    const offset = startDate.getDay();
    startDate.setDate(startDate.getDate() - offset);

    const days = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const key = curr.toISOString().split('T')[0];
      const count = counts.get(key) || 0;
      let intensity = 0;
      if (count > 0) {
        if (maxCount === 1) intensity = 2;
        else {
          intensity = Math.ceil((count / maxCount) * 4);
          if (intensity === 0 && count > 0) intensity = 1;
        }
      }
      days.push({ date: new Date(curr), count, intensity, key });
      curr.setDate(curr.getDate() + 1);
    }
    setData(days);
  }, [tasks]);

  const intensityClasses = {
    0: 'bg-muted/30',
    1: 'bg-foreground/20',
    2: 'bg-foreground/40',
    3: 'bg-foreground/60',
    4: 'bg-foreground/80',
  };

  const hasActivity = data.some((d) => d.count > 0);

  return (
    <Card className="p-6 bg-card/40 border-border/50 shadow-sm mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Agent Activity</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Task executions across all agents over the last year
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          <span>Less</span>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-sm ${intensityClasses[i as keyof typeof intensityClasses]}`}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      {!hasActivity && tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[160px] rounded-xl border border-dashed border-border/60 bg-muted/5">
          <ActivityIcon className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Execute a workflow to start recording activity.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {/* Days of week labels */}
          <div className="flex flex-col gap-[6px] text-[10px] text-muted-foreground font-medium pt-1 uppercase tracking-wider pr-2">
            <div className="h-3.5 leading-[14px]">Sun</div>
            <div className="h-3.5 leading-[14px]">Mon</div>
            <div className="h-3.5 leading-[14px]">Tue</div>
            <div className="h-3.5 leading-[14px]">Wed</div>
            <div className="h-3.5 leading-[14px]">Thu</div>
            <div className="h-3.5 leading-[14px]">Fri</div>
            <div className="h-3.5 leading-[14px]">Sat</div>
          </div>
          <div className="grid grid-rows-7 gap-[6px] grid-flow-col min-w-max">
            {data.map((d, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-sm transition-colors hover:ring-2 hover:ring-foreground/50 ${intensityClasses[d.intensity as keyof typeof intensityClasses]}`}
                title={`${d.count} tasks on ${d.date.toDateString()}`}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ActivityIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function getProviderColor(provider?: string) {
  switch (provider?.toLowerCase()) {
    case 'openai':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'anthropic':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'google':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterCap, setFilterCap] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { addToast } = useToast();
  const { setContext, clearContext } = useAssistantContext();

  async function fetchAgents() {
    try {
      console.log('Fetching agents...');
      setLoading(true);
      const res = await fetch(apiUrl('/agents'), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });
      const data = await res.json();
      if (data.ok) {
        setAgents(data.agents as Agent[]);
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchActivityTasks() {
    try {
      const res = await fetch(apiUrl('/tasks?limit=500'), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });
      const data = await res.json();
      if (data.ok) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Error fetching activity tasks:', err);
    }
  }

  useEffect(() => {
    fetchAgents();
    fetchActivityTasks();
  }, []);

  useEffect(() => {
    if (loading) return;

    setContext({
      page: 'agents',
      status: `${agents.length} agent(s) available`,
      recentActivity: agents.map((agent) => ({
        type: 'workflow',
        name: agent.name,
        status: agent.status ?? (agent.config?.model ? 'configured' : 'missing config'),
      })),
    });

    // We do not clear context here in the dependency array run, just return the cleanup
    return () => {
      // clearContext(); // Be careful with clearContext on unmount, depends on context-manager design
    };
  }, [loading, agents.length, setContext]);

  async function deleteAgent(id: string) {
    if (!confirm('Delete this agent?')) return;

    await fetch(apiUrl(`/agents/${id}`), {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
    });

    fetchAgents();
    addToast({
      type: 'success',
      title: 'Agent deleted successfully',
      description: 'Your agent was deleted successfully',
    });
  }

  const filteredAgents = agents.filter((agent) => {
    if (statusFilter === 'all') return true;
    const currentStatus = agent.status || 'idle';
    return currentStatus.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <AuthenticatedLayout>
      <>
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
            <p className="mt-2 text-muted-foreground">
              Manage and monitor your autonomous AI instances.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-3 rounded-md border border-border/50 bg-card px-3 py-1.5 shadow-sm">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 w-[120px] border-0 bg-transparent px-2 text-sm focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CreateAgentModal onCreated={fetchAgents} />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((skeletonId) => (
              <Card key={skeletonId} className="p-5 border-border/50 bg-card/50">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-8 rounded-md" />
                </div>
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
            {agents
              .filter(
                (a) =>
                  !filterCap ||
                  a.capabilities?.some((c) => c.includes(filterCap.toLowerCase().trim()))
              )
              .map((agent) => (
                <Card
                  key={agent._id}
                  className="p-6"
                  onClick={() =>
                    setContext({
                      page: 'agents',
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

                    <div className="flex items-center gap-2">
                      <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
                        {agent.status ?? 'idle'}
                      </Badge>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit Agent</DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                              onClick={() => deleteAgent(agent._id)}
                            >
                              Delete Agent
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold">{agent.name}</h3>
                  {agent.role && (
                    <p className="text-sm text-muted-foreground mt-0.5">{agent.role}</p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={`${getProviderColor(agent.config?.provider)}`}
                    >
                      {agent.config?.provider ?? 'unknown'} • {agent.config?.model ?? 'default'}
                    </Badge>
                    {agent.capabilities
                      ?.filter((c) => c !== 'llm')
                      .map((cap, i) => (
                        <Badge key={i} variant="secondary" className="capitalize text-xs">
                          {cap}
                        </Badge>
                      ))}
                  </div>

                  <div className="mt-6 flex-1 pt-1">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">
                          Model
                        </p>
                        <p
                          className="font-mono text-sm text-foreground truncate"
                          title={agent.config?.model}
                        >
                          {agent.config?.model ?? '—'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">
                          Provider
                        </p>
                        <div
                          className="flex items-center gap-1.5 truncate"
                          title={agent.config?.provider}
                        >
                          <span className="text-sm font-medium text-foreground capitalize">
                            {agent.config?.provider ?? '—'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">
                          Temperature
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {agent.config?.temperature ?? '—'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">
                          Max Tokens
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {agent.config?.maxTokens ?? '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        )}

        <AgentActivityHeatmap tasks={tasks} />
      </>
    </AuthenticatedLayout>
  );
}

type CreateAgentModalProps = {
  onCreated?: () => void;
};

export function CreateAgentModal({ onCreated }: CreateAgentModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [objective, setObjective] = useState('');
  const [description, setDescription] = useState('');
  const [systemInstructions, setSystemInstructions] = useState('');
  const [capabilitiesInput, setCapabilitiesInput] = useState('');
  const [type, setType] = useState<'llm' | 'tool'>('llm');

  const [providers, setProviders] = useState<any>(null);
  const [provider, setProvider] = useState<string>('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);

  const { addToast } = useToast();

  useEffect(() => {
    if (!open) return;

    async function loadProviders() {
      try {
        const res = await fetch(apiUrl('/system/providers'), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });

        const data = await res.json();
        if (data.ok) {
          setProviders(data.providers);
        }
      } catch (err) {
        console.error('Failed to load providers', err);
      }
    }

    loadProviders();
  }, [open]);

  async function createAgent() {
    if (!provider || !model) {
      addToast({
        type: 'error',
        title: 'Missing configuration',
        description: 'Select provider and model',
      });
      return;
    }

    try {
      setLoading(true);
      const caps = capabilitiesInput
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      if (!caps.includes('llm')) caps.unshift('llm');

      const body = {
        name,
        role,
        objective,
        description,
        systemInstructions,
        capabilities: caps,
        config: {
          provider,
          model,
          temperature,
        },
      };

      const res = await fetch(apiUrl('/agents'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);

      setOpen(false);
      setName('');
      setRole('');
      setObjective('');
      setDescription('');
      setSystemInstructions('');
      setCapabilitiesInput('');
      setProvider('');
      setModel('');
      setTemperature(0.7);

      onCreated?.();

      addToast({
        type: 'success',
        title: 'Agent created successfully',
        description: 'Your agent was created successfully',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to create agent',
        description: 'There was an error creating the agent',
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedProvider = providers?.[provider];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-foreground text-background hover:bg-foreground/90 shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> New Agent
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>Configure an AI agent that can run workflows.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Agent Name</Label>
            <Input
              className="mt-1.5"
              value={name}
              placeholder="e.g. CodeX, DataBot"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Role & Capabilities */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role Specialization</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Research Agent"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <div>
              <Label>Capabilities (comma separated)</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. writing, coding, analysis"
                value={capabilitiesInput}
                onChange={(e) => setCapabilitiesInput(e.target.value)}
              />
            </div>
          </div>

          {/* Objective */}
          <div>
            <Label>Agent Objective</Label>
            <Input
              className="mt-1.5"
              placeholder="What is this agent's primary goal?"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Input
              className="mt-1.5"
              placeholder="Brief summary of the agent's purpose"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* System Instructions */}
          <div>
            <Label>Persistent System Instructions</Label>
            <Textarea
              className="mt-1.5 resize-none h-20"
              placeholder="Define personality, rules, output format, or constraints..."
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
            />
          </div>

          {/* Provider */}
          <div>
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v);
                setModel('');
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers &&
                  Object.entries(providers).map(([key, value]: any) => (
                    <SelectItem key={key} value={key} disabled={!value.available}>
                      {key}
                      {!value.available && ' (Unavailable)'}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

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
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={createAgent} disabled={loading || !name.trim()}>
            {loading ? 'Creating…' : 'Create Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
