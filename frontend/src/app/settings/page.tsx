"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useTheme } from "next-themes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

/* -------------------------
   Types
------------------------- */
type WorkerSettings = {
  pollIntervalMs: number;
  maxAttempts: number;
};

type UiTheme = "light" | "dark" | "system" | "midnight" | "solarized";

type SystemSettings = {
  worker: WorkerSettings;
  ui: {
    theme: UiTheme;
  };
};

const DEFAULT_SETTINGS: SystemSettings = {
  worker: {
    pollIntervalMs: 2000,
    maxAttempts: 3,
  },
  ui: {
    theme: "dark",
  },
};

/* -------------------------
   Theme transition helper
------------------------- */
function applyThemeWithTransition(
  setTheme: (theme: string) => void,
  theme: UiTheme
) {
  const root = document.documentElement;

  root.classList.add("theme-transition");
  root.getBoundingClientRect(); // force reflow

  setTheme(theme);

  setTimeout(() => {
    root.classList.remove("theme-transition");
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
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();

  /* -------------------------
     Env status
  ------------------------- */
  const [env, setEnv] = useState<{
    groq: boolean;
    openai: boolean;
    gemini: boolean;
    hf: boolean;
  } | null>(null);

  /* -------------------------
     Load settings
  ------------------------- */
  async function loadSettings() {
    try {
      const res = await fetch("http://localhost:5000/api/settings", {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json();

      if (data.ok && data.settings) {
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
        };

        setSettings(merged);
        setTheme(merged.ui.theme);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadEnv() {
    const res = await fetch("http://localhost:5000/api/system/env", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const data = await res.json();
    if (data.ok) setEnv(data.env);
  }

  /* -------------------------
     Save worker settings
  ------------------------- */
  async function saveWorkerSettings() {
    try {
      setSavingWorker(true);

      await fetch("http://localhost:5000/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          worker: settings.worker,
        }),
      });
      addToast({
        type: "success",
        title: "Worker Settings Saved",
        description: "Your Worker Settings were updated successfully",
      });
    } finally {
      setSavingWorker(false);
    }
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

    await fetch("http://localhost:5000/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({
        ui: { theme: value },
      }),
    });
    addToast({
      type: "success",
      title: "Theme Changed",
      description: `Theme changed to ${value}`,
    });
  }

  useEffect(() => {
    loadSettings();
    loadEnv();
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
            style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
          >
            <div className="p-8">
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="mb-8 text-muted-foreground">
                Manage your system preferences
              </p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Worker */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-4 space-y-4">
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

                    <Button
                      onClick={saveWorkerSettings}
                      disabled={savingWorker}
                    >
                      {savingWorker ? "Saving…" : "Save"}
                    </Button>
                  </Card>
                </motion.div>

                {/* Environment */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-2">
                    <h2 className="text-lg font-semibold">Environment</h2>
                    <p className="text-sm text-muted-foreground">
                      Secrets are managed via environment variables.
                    </p>

                    {env && (
                      <div className="space-y-1 text-sm">
                        <div>Groq API: {env.groq ? "✅" : "❌"}</div>
                        <div>OpenAI API: {env.openai ? "✅" : "❌"}</div>
                        <div>Gemini API: {env.gemini ? "✅" : "❌"}</div>
                        <div>HF API: {env.hf ? "✅" : "❌"}</div>
                      </div>
                    )}
                  </Card>
                </motion.div>

                {/* Appearance */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Appearance</h2>

                    <RadioGroup
                      value={theme}
                      onValueChange={changeTheme}
                      className="space-y-3"
                    >
                      <ThemeOption value="light" label="Light" />
                      <ThemeOption value="dark" label="Dark" />
                      <ThemeOption value="midnight" label="Midnight" />
                      <ThemeOption value="solarized" label="Solarized" />
                      <ThemeOption value="system" label="System" />
                    </RadioGroup>
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
