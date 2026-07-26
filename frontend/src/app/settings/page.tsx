'use client';

import { useEffect, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

import { useTheme } from 'next-themes';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { useAssistantContext } from '@/context/assistant-context';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronRightIcon,
  Key,
  Trash2,
  Copy,
  Check,
  Cpu,
  Cloud,
  Plug,
  Activity,
  Settings2,
  Plus,
  MonitorSmartphone,
  Moon,
  Sun,
  Sparkles,
  BookOpen,
  KeyRound,
  Server,
  XCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuContent,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiUrl } from '@/lib/api';

/* -------------------------
   Types
------------------------- */
type WorkerSettings = {
  pollIntervalMs: number;
  maxAttempts: number;
};

type UiTheme = 'light' | 'dark' | 'system' | 'midnight' | 'solarized';

type AssistantProvider = 'ollama' | 'groq' | 'openai' | 'gemini' | 'huggingface';

type AssistantSettings = {
  enabled: boolean;
  provider: AssistantProvider | null;
  model: string | null;
};

type DocumentChatSettings = {
  enabled: boolean;
  provider: AssistantProvider | null;
  model: string | null;
  topK: number;
  temperature: number;
};

type McpServerSettings = {
  id: string;
  name: string;
  transport: 'stdio' | 'streamable-http';
  command: string;
  args: string[];
  url: string;
  headers: Record<string, string>;
  env: Record<string, string>;
  enabled: boolean;
  autoDiscover: boolean;
  timeoutMs: number;
};

type McpSettings = {
  enabled: boolean;
  servers: McpServerSettings[];
};

type McpRuntimeState = {
  envEnabled: boolean;
  configPath: string | null;
  hasConfigJson: boolean;
  hasServerUrl: boolean;
};

type TelemetryMetrics = {
  taskRuns: number;
  workflowExecutions: number;
  totalStepExecutions: number;
  totalTaskDurationMs: number;
  stepTypeCounts: Record<string, number>;
};

type TelemetryState = {
  enabled: boolean;
  instanceId: string;
  lastHeartbeatAt: string | null;
  lastHeartbeatVersion: string | null;
  endpointConfigured: boolean;
  outboundDisabled: boolean;
  localMetrics: TelemetryMetrics;
};

type SystemSettings = {
  worker: WorkerSettings;
  ui: {
    theme: UiTheme;
  };
  assistant: AssistantSettings;
  documentChat: DocumentChatSettings;
  mcp: McpSettings;
};

const PROVIDER_LABELS: Record<AssistantProvider, string> = {
  ollama: 'Ollama (Local)',
  groq: 'Groq',
  openai: 'OpenAI',
  gemini: 'Gemini',
  huggingface: 'Hugging Face',
};

const DEFAULT_TELEMETRY: TelemetryState = {
  enabled: false,
  instanceId: '',
  lastHeartbeatAt: null,
  lastHeartbeatVersion: null,
  endpointConfigured: false,
  outboundDisabled: false,
  localMetrics: {
    taskRuns: 0,
    workflowExecutions: 0,
    totalStepExecutions: 0,
    totalTaskDurationMs: 0,
    stepTypeCounts: {},
  },
};

const DEFAULT_SETTINGS: SystemSettings = {
  worker: {
    pollIntervalMs: 2000,
    maxAttempts: 3,
  },
  ui: {
    theme: 'dark',
  },
  assistant: {
    enabled: false,
    provider: null,
    model: null,
  },
  documentChat: {
    enabled: true,
    provider: 'ollama',
    model: null,
    topK: 3,
    temperature: 0.2,
  },
  mcp: {
    enabled: false,
    servers: [],
  },
};

const DEFAULT_MCP_RUNTIME: McpRuntimeState = {
  envEnabled: true,
  configPath: null,
  hasConfigJson: false,
  hasServerUrl: false,
};

function createEmptyMcpServer(): McpServerSettings {
  return {
    id: `mcp-${Date.now()}`,
    name: 'New MCP Server',
    transport: 'stdio',
    command: '',
    args: [],
    url: '',
    headers: {},
    env: {},
    enabled: true,
    autoDiscover: true,
    timeoutMs: 30000,
  };
}

function toKeyValueText(value: Record<string, string>) {
  return Object.entries(value || {})
    .map(([key, entry]) => `${key}=${entry}`)
    .join('\n');
}

function fromKeyValueText(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return acc;
      const key = line.slice(0, idx).trim();
      const entry = line.slice(idx + 1).trim();
      if (key) acc[key] = entry;
      return acc;
    }, {});
}

/* -------------------------
   Theme transition helper
------------------------- */
function applyThemeWithTransition(setTheme: (theme: string) => void, theme: UiTheme) {
  const root = document.documentElement;

  root.classList.add('theme-transition');
  root.getBoundingClientRect(); // force reflow

  setTheme(theme);

  setTimeout(() => {
    root.classList.remove('theme-transition');
  }, 300);
}

/* -------------------------
   Theme option
------------------------- */
function ThemeOption({ value, label }: { value: UiTheme; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <RadioGroupItem value={value} id={value} />
      <Label htmlFor={value}>{label}</Label>
    </div>
  );
}

/* -------------------------
   Page
------------------------- */
export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingWorker, setSavingWorker] = useState(false);
  const [savingMcp, setSavingMcp] = useState(false);
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();
  const { setMode } = useAssistantContext();
  const [mcpRuntime, setMcpRuntime] = useState<McpRuntimeState>(DEFAULT_MCP_RUNTIME);

  const [availableProviders, setAvailableProviders] = useState<{
    ollama?: boolean;
    groq?: boolean;
    openai?: boolean;
    gemini?: boolean;
    huggingface?: boolean;
  }>({});

  // API Key State
  type ApiKeyType = {
    _id: string;
    name: string;
    createdAt: string;
  };
  const [apiKeys, setApiKeys] = useState<ApiKeyType[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  async function fetchApiKeys() {
    try {
      const res = await fetch(apiUrl('/keys'), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });
      const data = await res.json();
      if (data.ok) {
        setApiKeys(data.keys || []);
      }
    } catch (err) {
      console.warn('Failed to fetch API keys:', err);
    } finally {
      setLoadingKeys(false);
    }
  }

  async function handleGenerateKey() {
    if (!newKeyName.trim()) return;
    setGeneratingKey(true);
    try {
      const res = await fetch(apiUrl('/keys'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setGeneratedKey(data.rawKey);
        setNewKeyName('');
        fetchApiKeys();
        addToast({
          type: 'success',
          title: 'API Key Generated',
          description: 'Your new API key has been created successfully.',
        });
      }
    } catch (err) {
      console.error('Failed to generate key:', err);
      addToast({
        type: 'error',
        title: 'Generation Failed',
        description: 'Could not generate API key.',
      });
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (
      !window.confirm('Are you sure you want to revoke this API key? This action cannot be undone.')
    ) {
      return;
    }
    try {
      const res = await fetch(apiUrl(`/keys/${keyId}`), {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });
      const data = await res.json();
      if (data.ok) {
        fetchApiKeys();
        addToast({
          type: 'success',
          title: 'Key Revoked',
          description: 'The API key has been revoked successfully.',
        });
      }
    } catch (err) {
      console.error('Failed to revoke key:', err);
      addToast({
        type: 'error',
        title: 'Revocation Failed',
        description: 'Could not revoke API key.',
      });
    }
  }

  const [telemetry, setTelemetry] = useState<TelemetryState>(DEFAULT_TELEMETRY);

  /* -------------------------
     Env status
  ------------------------- */
  const [env, setEnv] = useState<{
    groq: boolean;
    ollama: boolean;
    openai: boolean;
    gemini: boolean;
    hf: boolean;
  } | null>(null);

  /* -------------------------
     Load settings
  ------------------------- */
  async function loadSettings() {
    try {
      const res = await fetch(apiUrl('/settings'), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();

      if (data.ok && data.settings) {
        // 🔥 Set available providers from backend
        setAvailableProviders(data.availableProviders || {});
        setMcpRuntime(data.mcpRuntime || DEFAULT_MCP_RUNTIME);

        const merged: SystemSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings,
          worker: {
            ...DEFAULT_SETTINGS.worker,
            ...data.settings.worker,
          },
          ui: {
            ...DEFAULT_SETTINGS.ui,
            ...data.settings.ui,
          },
          assistant: {
            ...DEFAULT_SETTINGS.assistant,
            ...data.settings.assistant,
          },
          documentChat: {
            ...DEFAULT_SETTINGS.documentChat,
            ...data.settings.documentChat,
          },
          mcp: {
            ...DEFAULT_SETTINGS.mcp,
            ...data.settings.mcp,
          },
        };

        setSettings(merged);
        setTheme(merged.ui.theme);
      }
    } catch (err) {
      console.warn('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEnv() {
    try {
      const res = await fetch(apiUrl('/system/env'), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();
      if (data.ok) setEnv(data.env);
    } catch (err) {
      console.warn('Failed to load env', err);
    }
  }

  async function loadTelemetry() {
    try {
      const res = await fetch(apiUrl('/telemetry'), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });
      const data = await res.json();
      if (data.ok && data.telemetry) {
        setTelemetry(data.telemetry);
      }
    } catch (err) {
      console.warn('Failed to load telemetry', err);
    }
  }

  async function saveTelemetryEnabled(enabled: boolean) {
    try {
      const res = await fetch(apiUrl('/telemetry'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.ok && data.telemetry) {
        setTelemetry(data.telemetry);
        addToast({
          type: 'success',
          title: 'Telemetry Updated',
          description: `Anonymous telemetry has been ${enabled ? 'enabled' : 'disabled'}.`,
        });
      }
    } catch (err) {
      console.error('Failed to save telemetry', err);
      addToast({
        type: 'error',
        title: 'Telemetry Save Failed',
        description: 'Could not update telemetry preferences.',
      });
    }
  }

  useEffect(() => {
    if (settings.assistant?.enabled) {
      setMode('online');
    } else {
      setMode('offline');
    }
  }, [settings.assistant?.enabled]);

  /* -------------------------
     Save worker settings
  ------------------------- */
  async function saveWorkerSettings() {
    try {
      setSavingWorker(true);

      await fetch(apiUrl('/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({
          worker: settings.worker,
        }),
      });
      addToast({
        type: 'success',
        title: 'Worker Settings Saved',
        description: 'Your Worker Settings were updated successfully',
      });
    } finally {
      setSavingWorker(false);
    }
  }

  async function saveMcpSettings() {
    try {
      setSavingMcp(true);

      const res = await fetch(apiUrl('/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({
          mcp: settings.mcp,
        }),
      });

      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to save MCP settings');
      }

      addToast({
        type: 'success',
        title: 'MCP Settings Saved',
        description: 'Your MCP configuration was updated successfully.',
      });
    } catch (err) {
      console.error('Failed to save MCP settings', err);
      addToast({
        type: 'error',
        title: 'MCP Save Failed',
        description: 'Could not update MCP configuration.',
      });
    } finally {
      setSavingMcp(false);
    }
  }

  function updateMcpServer(serverId: string, patch: Partial<McpServerSettings>) {
    setSettings((prev) => ({
      ...prev,
      mcp: {
        ...prev.mcp,
        servers: prev.mcp.servers.map((server) =>
          server.id === serverId ? { ...server, ...patch } : server
        ),
      },
    }));
  }

  function removeMcpServer(serverId: string) {
    setSettings((prev) => ({
      ...prev,
      mcp: {
        ...prev.mcp,
        servers: prev.mcp.servers.filter((server) => server.id !== serverId),
      },
    }));
  }

  function addMcpServer() {
    setSettings((prev) => ({
      ...prev,
      mcp: {
        ...prev.mcp,
        servers: [...prev.mcp.servers, createEmptyMcpServer()],
      },
    }));
  }

  /* -------------------------
     Change theme
  ------------------------- */
  async function changeTheme(value: UiTheme) {
    applyThemeWithTransition(setTheme, value);

    setSettings((prev) => ({
      ...prev,
      ui: { theme: value },
    }));

    await fetch(apiUrl('/settings'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
      body: JSON.stringify({
        ui: { theme: value },
      }),
    });
    addToast({
      type: 'success',
      title: 'Theme Changed',
      description: `Theme changed to ${value}`,
    });
  }

  useEffect(() => {
    loadSettings();
    loadEnv();
    loadTelemetry();
    fetchApiKeys();
  }, []);

  if (loading) return <p className="p-8">Loading…</p>;

  // helper to get connected providers count
  const activeProvidersCount = [env?.groq, env?.ollama, env?.openai, env?.gemini, env?.hf].filter(
    Boolean
  ).length;

  // Active MCP servers
  const activeMcpCount = settings.mcp.servers.filter((s) => s.enabled).length;

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        {/* Header section */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings2 className="size-8 text-primary" />
            System Control Center
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure your AI Workbench components, integrations, and telemetry.
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-card/40 backdrop-blur-md border-white/10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cpu className="size-4" />
              <span className="text-sm font-medium">Execution Engine</span>
            </div>
            <div className="text-2xl font-semibold flex items-center gap-2">
              <div className="size-2.5 rounded-full bg-emerald-500" />
              Active
            </div>
            <div className="text-xs text-muted-foreground">
              {settings.worker.pollIntervalMs}ms poll interval
            </div>
          </Card>

          <Card className="p-4 bg-card/40 backdrop-blur-md border-white/10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cloud className="size-4" />
              <span className="text-sm font-medium">API Providers</span>
            </div>
            <div className="text-2xl font-semibold flex items-center gap-2">
              <div
                className={`size-2.5 rounded-full ${activeProvidersCount > 0 ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
              />
              {activeProvidersCount} Connected
            </div>
            <div className="text-xs text-muted-foreground">Ready for tasks</div>
          </Card>

          <Card className="p-4 bg-card/40 backdrop-blur-md border-white/10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Plug className="size-4" />
              <span className="text-sm font-medium">MCP Servers</span>
            </div>
            <div className="text-2xl font-semibold flex items-center gap-2">
              <div
                className={`size-2.5 rounded-full ${settings.mcp.enabled ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
              />
              {activeMcpCount} Active
            </div>
            <div className="text-xs text-muted-foreground">Local tools & integrations</div>
          </Card>

          <Card className="p-4 bg-card/40 backdrop-blur-md border-white/10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="size-4" />
              <span className="text-sm font-medium">Telemetry</span>
            </div>
            <div className="text-2xl font-semibold flex items-center gap-2">
              <div
                className={`size-2.5 rounded-full ${telemetry.enabled ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
              />
              {telemetry.enabled ? 'Online' : 'Disabled'}
            </div>
            <div className="text-xs text-muted-foreground">
              {telemetry.localMetrics.workflowExecutions} executions
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Provider Configuration */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-card/40 backdrop-blur-md border-white/10 overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Cloud className="size-5 text-primary" />
                    Provider Configuration
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage AI model providers and authenticate outbound requests. Secrets are
                    managed via environment variables.
                  </p>
                </div>

                <div className="p-0">
                  <div className="divide-y divide-white/5">
                    {[
                      { id: 'openai', name: 'OpenAI', icon: 'OpenAI', active: env?.openai },
                      { id: 'gemini', name: 'Gemini', icon: 'Gemini', active: env?.gemini },
                      { id: 'groq', name: 'Groq', icon: 'Groq', active: env?.groq },
                      { id: 'ollama', name: 'Ollama (Local)', icon: 'Ollama', active: env?.ollama },
                      { id: 'hf', name: 'Hugging Face', icon: 'HF', active: env?.hf },
                    ].map((provider) => (
                      <div
                        key={provider.id}
                        className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-muted flex items-center justify-center font-bold text-muted-foreground">
                            {provider.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {provider.active
                                ? 'Environment variable found'
                                : 'Missing environment variable'}
                            </div>
                          </div>
                        </div>
                        <div>
                          {provider.active ? (
                            <Badge
                              variant="default"
                              className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            >
                              Connected ✓
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <span className="flex items-center text-destructive">
                                Not Configured <XCircle className="w-4 h-4 ml-1" />
                              </span>
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-muted/5 border-t border-white/5 space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <KeyRound className="size-4" />
                    API Keys
                  </h3>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Key name (e.g. My App)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="max-w-xs bg-background/50"
                    />
                    <Button
                      onClick={handleGenerateKey}
                      disabled={generatingKey || !newKeyName.trim()}
                    >
                      Generate Key
                    </Button>
                  </div>

                  {generatedKey && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-2 animate-in fade-in zoom-in-95 duration-200">
                      <div className="text-xs font-semibold text-emerald-500 flex justify-between items-center">
                        <span>Save this key (it won&apos;t be shown again!):</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-emerald-500 hover:bg-emerald-500/20"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedKey);
                            setCopiedKey(true);
                            setTimeout(() => setCopiedKey(false), 2000);
                          }}
                        >
                          {copiedKey ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      </div>
                      <div className="font-mono text-xs break-all bg-background border p-2 rounded select-all text-foreground">
                        {generatedKey}
                      </div>
                    </div>
                  )}

                  {loadingKeys ? (
                    <p className="text-xs text-muted-foreground animate-pulse">Loading keys...</p>
                  ) : apiKeys.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No API keys created yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {apiKeys.map((key) => (
                        <div
                          key={key._id}
                          className="flex items-center justify-between border border-white/10 p-2.5 rounded-lg bg-background/50 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold truncate text-foreground">{key.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Created: {new Date(key.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRevokeKey(key._id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Developer Integrations (MCP) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-card/40 backdrop-blur-md border-white/10 p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Server className="size-5 text-primary" />
                      Developer Integrations
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Model Context Protocol (MCP) servers for local tools and system integrations.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">Master Toggle</span>
                      <Switch
                        checked={!!settings.mcp.enabled}
                        onCheckedChange={(checked) =>
                          setSettings((prev) => ({
                            ...prev,
                            mcp: { ...prev.mcp, enabled: checked },
                          }))
                        }
                      />
                    </div>
                    {mcpRuntime.envEnabled ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]"
                      >
                        Environment: Enabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Environment: Disabled
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={addMcpServer} className="gap-2">
                    <Plus className="size-4" /> Add Server
                  </Button>
                  <Button type="button" onClick={saveMcpSettings} disabled={savingMcp}>
                    {savingMcp ? 'Saving…' : 'Save MCP Settings'}
                  </Button>
                </div>

                {settings.mcp.servers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-8 flex flex-col items-center justify-center text-center space-y-3 bg-muted/5">
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                      <Plug className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">No MCP servers connected</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Add a local tool integration to extend your agents with custom capabilities.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {settings.mcp.servers.map((server) => (
                      <div
                        key={server.id}
                        className="rounded-xl border border-white/10 p-5 space-y-4 bg-background/50 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={server.enabled}
                              onCheckedChange={(checked) =>
                                updateMcpServer(server.id, { enabled: checked })
                              }
                            />
                            <div className="font-medium text-base">{server.name || server.id}</div>
                            <Badge variant="secondary" className="text-[10px]">
                              {server.transport}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeMcpServer(server.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">ID</Label>
                            <Input
                              className="bg-background/50 h-8"
                              value={server.id}
                              onChange={(e) => updateMcpServer(server.id, { id: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Name</Label>
                            <Input
                              className="bg-background/50 h-8"
                              value={server.name}
                              onChange={(e) => updateMcpServer(server.id, { name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Transport</Label>
                            <select
                              className="w-full h-8 border rounded-md px-3 bg-background/50 text-sm"
                              value={server.transport}
                              onChange={(e) =>
                                updateMcpServer(server.id, {
                                  transport: e.target.value as 'stdio' | 'streamable-http',
                                })
                              }
                            >
                              <option value="stdio">stdio</option>
                              <option value="streamable-http">streamable-http</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Timeout (ms)</Label>
                            <Input
                              type="number"
                              className="bg-background/50 h-8"
                              value={server.timeoutMs}
                              onChange={(e) =>
                                updateMcpServer(server.id, { timeoutMs: Number(e.target.value) })
                              }
                            />
                          </div>
                        </div>

                        {server.transport === 'stdio' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Command</Label>
                              <Input
                                className="bg-background/50 h-8"
                                value={server.command}
                                onChange={(e) =>
                                  updateMcpServer(server.id, { command: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">
                                Args (space-separated)
                              </Label>
                              <Input
                                className="bg-background/50 h-8"
                                value={server.args.join(' ')}
                                onChange={(e) =>
                                  updateMcpServer(server.id, {
                                    args: e.target.value
                                      .split(' ')
                                      .map((item) => item.trim())
                                      .filter(Boolean),
                                  })
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">URL</Label>
                            <Input
                              className="bg-background/50 h-8"
                              value={server.url}
                              onChange={(e) => updateMcpServer(server.id, { url: e.target.value })}
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              Headers (Key=Value)
                            </Label>
                            <textarea
                              className="w-full min-h-[80px] border rounded-md px-3 py-2 bg-background/50 font-mono text-xs"
                              value={toKeyValueText(server.headers)}
                              onChange={(e) =>
                                updateMcpServer(server.id, {
                                  headers: fromKeyValueText(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              Environment (Key=Value)
                            </Label>
                            <textarea
                              className="w-full min-h-[80px] border rounded-md px-3 py-2 bg-background/50 font-mono text-xs"
                              value={toKeyValueText(server.env)}
                              onChange={(e) =>
                                updateMcpServer(server.id, {
                                  env: fromKeyValueText(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm mt-2 cursor-pointer w-fit">
                          <input
                            type="checkbox"
                            checked={server.autoDiscover}
                            onChange={(e) =>
                              updateMcpServer(server.id, { autoDiscover: e.target.checked })
                            }
                            className="rounded border-white/20 bg-background"
                          />
                          <span className="text-muted-foreground">Auto-discover tools</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          {/* Right Column: Settings */}
          <div className="space-y-8">
            {/* Execution Engine */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-card/40 backdrop-blur-md border-white/10 p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Cpu className="size-5 text-primary" />
                    Execution Engine
                  </h2>
                  <Button size="sm" onClick={saveWorkerSettings} disabled={savingWorker}>
                    {savingWorker ? 'Saving…' : 'Save'}
                  </Button>
                </div>

                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Poll Interval</Label>
                      <span className="text-xs text-muted-foreground font-mono">
                        {settings.worker.pollIntervalMs}ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="10000"
                      step="500"
                      className="w-full accent-primary"
                      value={settings.worker.pollIntervalMs}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          worker: { ...settings.worker, pollIntervalMs: Number(e.target.value) },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Max Attempts</Label>
                      <span className="text-xs text-muted-foreground font-mono">
                        {settings.worker.maxAttempts}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            setSettings({
                              ...settings,
                              worker: { ...settings.worker, maxAttempts: i + 1 },
                            })
                          }
                          className={`size-3 rounded-full transition-colors ${i < settings.worker.maxAttempts ? 'bg-primary' : 'bg-muted hover:bg-muted-foreground/30'}`}
                          title={`Set max attempts to ${i + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* AI Runtime Config */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-card/40 backdrop-blur-md border-white/10 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles className="size-5 text-primary" />
                    AI Runtime Config
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure the in-app assistant model.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between border border-white/5 bg-background/50 p-3 rounded-lg">
                    <div className="font-medium text-sm">Assistant Status</div>
                    <Switch
                      checked={!!settings.assistant?.enabled}
                      disabled={!settings.assistant?.provider}
                      onCheckedChange={async (checked) => {
                        const updated = {
                          ...settings,
                          assistant: { ...settings.assistant, enabled: checked },
                        };
                        setSettings(updated);
                        await fetch(apiUrl('/settings'), {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: 'Bearer ' + localStorage.getItem('token'),
                          },
                          body: JSON.stringify({ assistant: updated.assistant }),
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Provider</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full border border-white/10 rounded-md px-3 py-2 bg-background/50 text-left flex items-center justify-between text-sm">
                          <span>
                            {settings.assistant?.provider
                              ? PROVIDER_LABELS[settings.assistant.provider as AssistantProvider]
                              : 'Select Provider'}
                          </span>
                          <ChevronRightIcon className="rotate-90 size-4 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>Select Provider</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={settings.assistant?.provider ?? ''}
                          onValueChange={async (value) => {
                            const provider: AssistantProvider | null =
                              value === '' ? null : (value as AssistantProvider);
                            const updated = {
                              ...settings,
                              assistant: { ...settings.assistant, provider },
                            };
                            setSettings(updated);
                            await fetch(apiUrl('/settings'), {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: 'Bearer ' + localStorage.getItem('token'),
                              },
                              body: JSON.stringify({ assistant: updated.assistant }),
                            });
                          }}
                        >
                          {Object.entries(availableProviders).map(
                            ([key, available]) =>
                              available && (
                                <DropdownMenuRadioItem key={key} value={key}>
                                  {PROVIDER_LABELS[key as AssistantProvider]}
                                </DropdownMenuRadioItem>
                              )
                          )}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Model Override</Label>
                    <Input
                      className="bg-background/50 h-9 text-sm"
                      placeholder="Default"
                      value={settings.assistant?.model ?? ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          assistant: { ...prev.assistant, model: e.target.value || null },
                        }))
                      }
                      onBlur={async () => {
                        await fetch(apiUrl('/settings'), {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: 'Bearer ' + localStorage.getItem('token'),
                          },
                          body: JSON.stringify({ assistant: settings.assistant }),
                        });
                      }}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Knowledge Assistant */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="bg-card/40 backdrop-blur-md border-white/10 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="size-5 text-primary" />
                    Knowledge Assistant
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure Document Chat RAG pipeline.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between border border-white/5 bg-background/50 p-3 rounded-lg">
                    <div className="font-medium text-sm">Document Chat</div>
                    <Switch
                      checked={!!settings.documentChat?.enabled}
                      disabled={!settings.documentChat?.provider}
                      onCheckedChange={async (checked) => {
                        const updated = {
                          ...settings,
                          documentChat: { ...settings.documentChat, enabled: checked },
                        };
                        setSettings(updated);
                        await fetch(apiUrl('/settings'), {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: 'Bearer ' + localStorage.getItem('token'),
                          },
                          body: JSON.stringify({ documentChat: updated.documentChat }),
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Provider</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full border border-white/10 rounded-md px-3 py-2 bg-background/50 text-left flex items-center justify-between text-sm">
                          <span>
                            {settings.documentChat?.provider
                              ? PROVIDER_LABELS[settings.documentChat.provider as AssistantProvider]
                              : 'Select Provider'}
                          </span>
                          <ChevronRightIcon className="rotate-90 size-4 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>Select Provider</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={settings.documentChat?.provider ?? ''}
                          onValueChange={async (value) => {
                            const provider: AssistantProvider | null =
                              value === '' ? null : (value as AssistantProvider);
                            const updated = {
                              ...settings,
                              documentChat: { ...settings.documentChat, provider },
                            };
                            setSettings(updated);
                            await fetch(apiUrl('/settings'), {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: 'Bearer ' + localStorage.getItem('token'),
                              },
                              body: JSON.stringify({ documentChat: updated.documentChat }),
                            });
                          }}
                        >
                          {Object.entries(availableProviders).map(
                            ([key, available]) =>
                              available && (
                                <DropdownMenuRadioItem key={key} value={key}>
                                  {PROVIDER_LABELS[key as AssistantProvider]}
                                </DropdownMenuRadioItem>
                              )
                          )}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs">Top-K Retrieval</Label>
                        <span className="text-xs text-muted-foreground font-mono">
                          {settings.documentChat.topK}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        className="w-full accent-primary"
                        value={settings.documentChat.topK}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            documentChat: {
                              ...settings.documentChat,
                              topK: Number(e.target.value),
                            },
                          })
                        }
                        onMouseUp={async () => {
                          await fetch(apiUrl('/settings'), {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'Bearer ' + localStorage.getItem('token'),
                            },
                            body: JSON.stringify({ documentChat: settings.documentChat }),
                          });
                        }}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
                        <span>Shallow</span>
                        <span>Deep Context</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs">Temperature</Label>
                        <span className="text-xs text-muted-foreground font-mono">
                          {settings.documentChat.temperature.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        className="w-full accent-primary"
                        value={settings.documentChat.temperature}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            documentChat: {
                              ...settings.documentChat,
                              temperature: Number(e.target.value),
                            },
                          })
                        }
                        onMouseUp={async () => {
                          await fetch(apiUrl('/settings'), {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'Bearer ' + localStorage.getItem('token'),
                            },
                            body: JSON.stringify({ documentChat: settings.documentChat }),
                          });
                        }}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
                        <span>Cold</span>
                        <span>Creative</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
          {/* Split row for System Health & Theme Gallery */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start lg:col-span-3">
            {/* System Health */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="bg-card/40 backdrop-blur-md border-white/10 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="size-5 text-primary" />
                    System Health
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Optional anonymous telemetry is local-first and opt-in. No prompts, documents,
                    or user data are collected.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border border-white/5 bg-background/50 p-3 rounded-lg mb-4">
                    <div>
                      <div className="font-medium text-sm">Enable anonymous telemetry</div>
                      <div className="text-xs text-muted-foreground">
                        Use a random instance ID and minimal system metadata.
                      </div>
                    </div>
                    <Switch checked={telemetry.enabled} onCheckedChange={saveTelemetryEnabled} />
                  </div>
                  <div className="space-y-2 text-sm bg-background/30 p-3 border border-white/5 rounded-lg mb-4">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-muted-foreground">Heartbeat</span>
                      <span>
                        {telemetry.lastHeartbeatAt
                          ? new Date(telemetry.lastHeartbeatAt).toLocaleString()
                          : 'not sent yet'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-muted-foreground">Endpoint Configured</span>
                      <span>{telemetry.endpointConfigured ? 'Yes' : 'No'}</span>
                    </div>
                  </div>

                  {!telemetry.localMetrics ||
                  telemetry.localMetrics.workflowExecutions === undefined ? (
                    <div className="text-sm text-muted-foreground italic text-center p-4">
                      No telemetry data collected yet
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 border border-white/5 bg-background/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Instance</div>
                          <div className="font-mono text-xs truncate" title={telemetry.instanceId}>
                            {telemetry.instanceId || '-'}
                          </div>
                        </div>
                        <div className="p-3 border border-white/5 bg-background/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Avg Duration</div>
                          <div className="font-mono text-sm">
                            {telemetry.localMetrics.taskRuns > 0
                              ? Math.round(
                                  telemetry.localMetrics.totalTaskDurationMs /
                                    telemetry.localMetrics.taskRuns
                                )
                              : 0}
                            ms
                          </div>
                        </div>
                        <div className="p-3 border border-white/5 bg-background/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Executions</div>
                          <div className="font-mono text-sm">
                            {telemetry.localMetrics.workflowExecutions}
                          </div>
                        </div>
                        <div className="p-3 border border-white/5 bg-background/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Steps</div>
                          <div className="font-mono text-sm">
                            {telemetry.localMetrics.totalStepExecutions}
                          </div>
                        </div>
                      </div>

                      {Object.keys(telemetry.localMetrics.stepTypeCounts).length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="text-sm font-medium">Step Type Usage</div>
                          {Object.entries(telemetry.localMetrics.stepTypeCounts).map(
                            ([type, count]) => {
                              // Max value for simple relative bar width calculation
                              const maxCount = Math.max(
                                ...Object.values(telemetry.localMetrics.stepTypeCounts)
                              );
                              const percent = Math.round((count / maxCount) * 100);
                              return (
                                <div key={type} className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span>{type}</span>
                                    <span className="font-mono">{count}</span>
                                  </div>
                                  <Progress value={percent} className="h-1.5" />
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Theme Gallery */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card className="bg-card/40 backdrop-blur-md border-white/10 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <MonitorSmartphone className="size-5 text-primary" />
                    Theme Gallery
                  </h2>
                </div>

                <div className="space-y-3">
                  {[
                    { id: 'dark', name: 'Dark', description: 'Deep blacks and subtle grays.' },
                    { id: 'light', name: 'Light', description: 'Clean, bright, and legible.' },
                    {
                      id: 'midnight',
                      name: 'Midnight',
                      description: 'Deep blue hues for night owls.',
                    },
                    {
                      id: 'solarized',
                      name: 'Solarized',
                      description: 'Warm, low-contrast precision.',
                    },
                    {
                      id: 'system',
                      name: 'System',
                      description: 'Matches your OS preferences automatically.',
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => changeTheme(t.id as UiTheme)}
                      className={`w-full flex items-center gap-6 p-4 rounded-xl border transition-all text-left ${theme === t.id ? 'border-primary bg-primary/5' : 'border-white/10 bg-background/50 hover:bg-muted/50'}`}
                    >
                      {/* Mini Preview using dynamic CSS variables */}
                      <div
                        className={`w-32 h-20 shrink-0 rounded-md border border-white/10 overflow-hidden flex flex-col ${t.id === 'system' ? '' : t.id}`}
                      >
                        <div className="bg-background text-foreground flex-1 flex flex-col pointer-events-none">
                          {/* Header */}
                          <div className="h-4 border-b border-border/50 bg-card flex items-center px-2">
                            <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
                          </div>
                          {/* Body */}
                          <div className="flex flex-1">
                            {/* Sidebar */}
                            <div className="w-7 border-r border-border/50 bg-muted/30 flex flex-col items-center py-1.5 space-y-1.5">
                              <div className="w-3.5 h-3.5 rounded-sm bg-primary/40" />
                              <div className="w-3 h-3 rounded-sm bg-foreground/10" />
                              <div className="w-3 h-3 rounded-sm bg-foreground/10" />
                            </div>
                            {/* Content */}
                            <div className="flex-1 p-2 space-y-1.5 flex flex-col bg-background/50">
                              <div className="flex gap-1.5">
                                <div className="h-5 flex-1 rounded bg-card border border-border/50 shadow-sm" />
                                <div className="h-5 flex-1 rounded bg-card border border-border/50 shadow-sm" />
                              </div>
                              <div className="h-3.5 w-12 rounded bg-primary mt-auto" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info & Selection */}
                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <div
                            className={`font-medium ${theme === t.id ? 'text-primary' : 'text-foreground'}`}
                          >
                            {t.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {t.description}
                          </div>
                        </div>
                        {theme === t.id && (
                          <div className="h-6 w-6 shrink-0 rounded-full bg-primary/20 flex items-center justify-center ml-4">
                            <Check className="size-3.5 text-primary" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
