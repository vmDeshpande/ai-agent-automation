'use client';

import { useEffect, useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthGuard } from '@/components/auth/auth-guard';
import { useTheme } from 'next-themes';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { useAssistantContext } from '@/context/assistant-context';
import { useToast } from '@/hooks/use-toast';
import { ChevronRightIcon, Key, Trash2, Copy, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuContent,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
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
      console.error('Failed to fetch API keys:', err);
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
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEnv() {
    const res = await fetch(apiUrl('/system/env'), {
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
    });

    const data = await res.json();
    if (data.ok) setEnv(data.env);
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
      console.error('Failed to load telemetry', err);
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

  return (
    <AuthGuard>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex min-h-screen">
          <AppSidebar />
          <main
            className="flex-1 transition-[padding] duration-300"
            style={{ paddingLeft: 'var(--sidebar-width, 256px)' }}
          >
            <div className="p-8">
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="mb-8 text-muted-foreground">Manage your system preferences</p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
                {/* Worker */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 flex flex-col">
                    <div className="space-y-4 flex-1">
                      <h2 className="text-lg font-semibold">Worker</h2>

                      <div>
                        <Label>Poll Interval (ms)</Label>
                        <Input
                          type="number"
                          value={settings.worker.pollIntervalMs}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              worker: {
                                ...settings.worker,
                                pollIntervalMs: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label>Max Attempts</Label>
                        <Input
                          type="number"
                          value={settings.worker.maxAttempts}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              worker: {
                                ...settings.worker,
                                maxAttempts: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                    </div>

                    <Button
                      onClick={saveWorkerSettings}
                      disabled={savingWorker}
                      className="w-full md:w-auto"
                    >
                      {savingWorker ? 'Saving…' : 'Save'}
                    </Button>
                  </Card>
                </motion.div>

                {/* Environment */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Environment</h2>
                    <p className="text-sm text-muted-foreground">
                      Secrets are managed via environment variables.
                    </p>

                    {env && (
                      <div className="space-y-1 text-sm">
                        <div>Groq API: {env.groq ? '✅' : '❌'}</div>
                        <div>Ollama API: {env.ollama ? '✅' : '❌'}</div>
                        <div>OpenAI API: {env.openai ? '✅' : '❌'}</div>
                        <div>Gemini API: {env.gemini ? '✅' : '❌'}</div>
                        <div>HF API: {env.hf ? '✅' : '❌'}</div>
                      </div>
                    )}
                  </Card>
                </motion.div>

                {/* API Keys */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Key className="size-5 text-primary" />
                      API Keys
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Generate keys to authenticate requests when calling published workflow
                      endpoints.
                    </p>

                    {/* Key generation form */}
                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Key name (e.g. My App)"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                        />
                        <Button
                          onClick={handleGenerateKey}
                          disabled={generatingKey || !newKeyName.trim()}
                        >
                          Generate
                        </Button>
                      </div>
                    </div>

                    {/* Success dialog */}
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

                    {/* API keys list */}
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {loadingKeys ? (
                        <p className="text-xs text-muted-foreground animate-pulse">
                          Loading keys...
                        </p>
                      ) : apiKeys.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No API keys created yet.
                        </p>
                      ) : (
                        apiKeys.map((key) => (
                          <div
                            key={key._id}
                            className="flex items-center justify-between border p-2.5 rounded-lg bg-muted/10 text-xs"
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
                        ))
                      )}
                    </div>
                  </Card>
                </motion.div>

                {/* Appearance */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Appearance</h2>

                    <RadioGroup value={theme} onValueChange={changeTheme} className="space-y-3">
                      <ThemeOption value="light" label="Light" />
                      <ThemeOption value="dark" label="Dark" />
                      <ThemeOption value="midnight" label="Midnight" />
                      <ThemeOption value="solarized" label="Solarized" />
                      <ThemeOption value="system" label="System" />
                    </RadioGroup>
                  </Card>
                </motion.div>
                {/* AI Assistance */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">AI Assistance</h2>

                    <p className="text-sm text-muted-foreground">
                      Select which LLM provider should power in-app assistant.
                    </p>

                    {/* Enable Switch */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Enable AI Assistant</div>
                        <div className="text-xs text-muted-foreground">
                          Must select provider below
                        </div>
                      </div>

                      <Switch
                        checked={!!settings.assistant?.enabled}
                        disabled={!settings.assistant?.provider}
                        onCheckedChange={async (checked) => {
                          const updated = {
                            ...settings,
                            assistant: {
                              ...settings.assistant,
                              enabled: checked,
                            },
                          };

                          setSettings(updated);

                          await fetch(apiUrl('/settings'), {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'Bearer ' + localStorage.getItem('token'),
                            },
                            body: JSON.stringify({
                              assistant: updated.assistant,
                            }),
                          });
                        }}
                      />
                    </div>

                    {/* Provider Select */}
                    <div>
                      <Label className="mb-2 block">Provider</Label>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-full border rounded-md px-3 py-2 bg-background text-left flex items-center justify-between">
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
                                assistant: {
                                  ...settings.assistant,
                                  provider,
                                },
                              };

                              setSettings(updated);

                              await fetch(apiUrl('/settings'), {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: 'Bearer ' + localStorage.getItem('token'),
                                },
                                body: JSON.stringify({
                                  assistant: updated.assistant,
                                }),
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

                    {/* Model Input */}
                    <div>
                      <Label className="mb-2 block">Model (Optional Override)</Label>
                      <Input
                        placeholder="Leave empty for default"
                        value={settings.assistant?.model ?? ''}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            assistant: {
                              ...prev.assistant,
                              model: e.target.value || null,
                            },
                          }))
                        }
                        onBlur={async () => {
                          await fetch(apiUrl('/settings'), {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'Bearer ' + localStorage.getItem('token'),
                            },
                            body: JSON.stringify({
                              assistant: settings.assistant,
                            }),
                          });
                        }}
                      />
                    </div>
                  </Card>
                </motion.div>
                {/* Document Chat */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Document Chat</h2>

                    <p className="text-sm text-muted-foreground">
                      Configure AI used for document question answering.
                    </p>

                    {/* Enable Switch */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Enable Document Chat</div>
                        <div className="text-xs text-muted-foreground">
                          Must select provider below
                        </div>
                      </div>

                      <Switch
                        checked={!!settings.documentChat?.enabled}
                        disabled={!settings.documentChat?.provider}
                        onCheckedChange={async (checked) => {
                          const updated = {
                            ...settings,
                            documentChat: {
                              ...settings.documentChat,
                              enabled: checked,
                            },
                          };

                          setSettings(updated);

                          await fetch(apiUrl('/settings'), {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'Bearer ' + localStorage.getItem('token'),
                            },
                            body: JSON.stringify({
                              documentChat: updated.documentChat,
                            }),
                          });
                        }}
                      />
                    </div>

                    {/* Provider Select */}
                    <div>
                      <Label className="mb-2 block">Provider</Label>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-full border rounded-md px-3 py-2 bg-background text-left flex items-center justify-between">
                            <span>
                              {settings.documentChat?.provider
                                ? PROVIDER_LABELS[
                                    settings.documentChat.provider as AssistantProvider
                                  ]
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
                                documentChat: {
                                  ...settings.documentChat,
                                  provider,
                                },
                              };

                              setSettings(updated);

                              await fetch(apiUrl('/settings'), {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: 'Bearer ' + localStorage.getItem('token'),
                                },
                                body: JSON.stringify({
                                  documentChat: updated.documentChat,
                                }),
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

                    {/* Model Input */}
                    <div>
                      <Label className="mb-2 block">Model (Optional Override)</Label>

                      <Input
                        placeholder="Leave empty for default"
                        value={settings.documentChat?.model ?? ''}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            documentChat: {
                              ...prev.documentChat,
                              model: e.target.value || null,
                            },
                          }))
                        }
                        onBlur={async () => {
                          await fetch(apiUrl('/settings'), {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'Bearer ' + localStorage.getItem('token'),
                            },
                            body: JSON.stringify({
                              documentChat: settings.documentChat,
                            }),
                          });
                        }}
                      />
                    </div>

                    {/* Top-K */}
                    <div>
                      <Label>Top-K Retrieval</Label>

                      <Input
                        type="number"
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
                        onBlur={async () => {
                          await fetch(apiUrl('/settings'), {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'Bearer ' + localStorage.getItem('token'),
                            },
                            body: JSON.stringify({
                              documentChat: settings.documentChat,
                            }),
                          });
                        }}
                      />
                    </div>

                    {/* Temperature */}
                    <div>
                      <Label>Temperature</Label>

                      <Input
                        type="number"
                        step="0.1"
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
                        onBlur={async () => {
                          await fetch(apiUrl('/settings'), {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'Bearer ' + localStorage.getItem('token'),
                            },
                            body: JSON.stringify({
                              documentChat: settings.documentChat,
                            }),
                          });
                        }}
                      />
                    </div>
                  </Card>
                </motion.div>

                {/* Telemetry */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Telemetry</h2>

                    <p className="text-sm text-muted-foreground">
                      Optional anonymous telemetry is local-first and opt-in. No prompts, documents,
                      or user data are collected.
                    </p>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Enable anonymous telemetry</div>
                        <div className="text-xs text-muted-foreground">
                          Use a random instance ID and minimal system metadata.
                        </div>
                      </div>
                      <Switch checked={telemetry.enabled} onCheckedChange={saveTelemetryEnabled} />
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        Instance ID:{' '}
                        <span className="font-mono">
                          {telemetry.instanceId || 'not generated yet'}
                        </span>
                      </div>
                      <div>
                        Heartbeat:{' '}
                        {telemetry.lastHeartbeatAt
                          ? new Date(telemetry.lastHeartbeatAt).toLocaleString()
                          : 'not sent yet'}
                      </div>
                      <div>Endpoint configured: {telemetry.endpointConfigured ? 'Yes' : 'No'}</div>
                      <div>
                        <div>Workflow executions: {telemetry.localMetrics.workflowExecutions}</div>
                        <div>
                          Average task duration:{' '}
                          {telemetry.localMetrics.taskRuns > 0
                            ? Math.round(
                                telemetry.localMetrics.totalTaskDurationMs /
                                  telemetry.localMetrics.taskRuns
                              )
                            : 0}{' '}
                          ms
                        </div>
                        <div>Step executions: {telemetry.localMetrics.totalStepExecutions}</div>
                        {Object.entries(telemetry.localMetrics.stepTypeCounts).length > 0 && (
                          <div>
                            Step type usage:
                            <ul className="ml-4 list-disc">
                              {Object.entries(telemetry.localMetrics.stepTypeCounts).map(
                                ([type, count]) => (
                                  <li key={type}>
                                    {type}: {count}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>

                {/* MCP */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="md:col-span-2 lg:col-span-3"
                >
                  <Card className="p-6 space-y-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">MCP Servers</h2>
                        <p className="text-sm text-muted-foreground">
                          Configure local stdio and remote streamable HTTP MCP servers for workflow
                          steps.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs text-muted-foreground">
                          <div>Env enabled: {mcpRuntime.envEnabled ? 'Yes' : 'No'}</div>
                          <div>
                            Env config:
                            {mcpRuntime.configPath
                              ? ` ${mcpRuntime.configPath}`
                              : mcpRuntime.hasConfigJson || mcpRuntime.hasServerUrl
                                ? ' inline'
                                : ' none'}
                          </div>
                        </div>
                        <Switch
                          checked={!!settings.mcp.enabled}
                          onCheckedChange={(checked) =>
                            setSettings((prev) => ({
                              ...prev,
                              mcp: {
                                ...prev.mcp,
                                enabled: checked,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button type="button" variant="outline" onClick={addMcpServer}>
                        Add Server
                      </Button>
                      <Button type="button" onClick={saveMcpSettings} disabled={savingMcp}>
                        {savingMcp ? 'Saving…' : 'Save MCP Settings'}
                      </Button>
                    </div>

                    {settings.mcp.servers.length === 0 && (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        No MCP servers configured yet.
                      </div>
                    )}

                    <div className="space-y-4">
                      {settings.mcp.servers.map((server) => (
                        <div key={server.id} className="rounded-xl border p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{server.name || server.id}</div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => removeMcpServer(server.id)}
                            >
                              Remove
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <Label>ID</Label>
                              <Input
                                value={server.id}
                                onChange={(e) => updateMcpServer(server.id, { id: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Name</Label>
                              <Input
                                value={server.name}
                                onChange={(e) =>
                                  updateMcpServer(server.id, { name: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Transport</Label>
                              <select
                                className="w-full border rounded-md px-3 py-2 bg-background"
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
                            <div>
                              <Label>Timeout (ms)</Label>
                              <Input
                                type="number"
                                value={server.timeoutMs}
                                onChange={(e) =>
                                  updateMcpServer(server.id, {
                                    timeoutMs: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </div>

                          {server.transport === 'stdio' ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <Label>Command</Label>
                                <Input
                                  value={server.command}
                                  onChange={(e) =>
                                    updateMcpServer(server.id, {
                                      command: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Args (space-separated)</Label>
                                <Input
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
                            <div>
                              <Label>URL</Label>
                              <Input
                                value={server.url}
                                onChange={(e) =>
                                  updateMcpServer(server.id, { url: e.target.value })
                                }
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <Label>Headers</Label>
                              <textarea
                                className="w-full min-h-[120px] border rounded-md px-3 py-2 bg-background font-mono text-xs"
                                value={toKeyValueText(server.headers)}
                                onChange={(e) =>
                                  updateMcpServer(server.id, {
                                    headers: fromKeyValueText(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label>Environment</Label>
                              <textarea
                                className="w-full min-h-[120px] border rounded-md px-3 py-2 bg-background font-mono text-xs"
                                value={toKeyValueText(server.env)}
                                onChange={(e) =>
                                  updateMcpServer(server.id, {
                                    env: fromKeyValueText(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={server.enabled}
                                onChange={(e) =>
                                  updateMcpServer(server.id, {
                                    enabled: e.target.checked,
                                  })
                                }
                              />
                              Enabled
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={server.autoDiscover}
                                onChange={(e) =>
                                  updateMcpServer(server.id, {
                                    autoDiscover: e.target.checked,
                                  })
                                }
                              />
                              Auto-discover tools
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              </div>
            </div>
          </main>
        </div>
      </motion.div>
    </AuthGuard>
  );
}
