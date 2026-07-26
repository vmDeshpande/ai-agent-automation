"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { apiUrl } from "@/lib/api";

/* ================= TYPES ================= */

export type AssistantMode = "online" | "offline";

/**
 * All pages where assistant can be active
 * (matches sidebar navigation)
 */
export type AssistantPage =
  | "dashboard"
  | "workflows"
  | "workflow-detail"
  | "workflow-builder"
  | "tasks"
  | "task-detail"
  | "schedules"
  | "agents"
  | "logs"
  | "settings"
  | "documents";

/**
 * Runtime context injected by pages
 * Keep this descriptive, not raw DB objects
 */
export interface AssistantRuntimeContext {
  /* -------- Page -------- */
  page?: AssistantPage;

  /* -------- Dashboard -------- */
  dashboardStats?: {
    workflows: number;
    tasks: number;
    runningTasks: number;
    agents: number;
    schedules: number;
  };

  recentActivity?: {
    type: "task" | "workflow" | "schedule";
    name: string;
    status?: string;
  }[];

  /* -------- Workflow -------- */
  workflowId?: string;
  workflowName?: string;
  status?: string;

  /* -------- Step (inside workflow) -------- */
  stepId?: string;
  stepName?: string;
  stepType?: string;
  stepDescription?: string;

  /* -------- Failed Step -------- */
  failedStep?: {
    stepId: string;
    name: string;
    type: string;
    output?: string;
  };

  /* -------- Workflow Builder -------- */
  builderSteps?: {
    id: string;
    name: string;
    type: "LLM" | "HTTP" | "Tool" | "Delay" | "Document" | "Condition" | "Switch";
    summary: string;
  }[];

  /* -------- Task -------- */
  taskId?: string;
  taskName?: string;
  taskStatus?: string;
  runningBy?: string;

  /* -------- Agent -------- */
  agentId?: string;
  agentName?: string;
  model?: string;
  temperature?: number;

  /* -------- Schedules (list view) -------- */
  schedules?: {
    scheduleId: string;
    scheduleName: string;
    cron?: string;
    enabled: boolean;
  }[];

  /* -------- Schedule (focused) -------- */
  scheduleId?: string;
  scheduleName?: string;
  cron?: string;
  enabled?: boolean;

  /* -------- Logs -------- */
  logScope?: "workflow" | "task" | "system";

  logsSummary?: {
    level: "info" | "success" | "warn" | "error";
    message: string;
    time: string;
  }[];

  /* -------- Documents -------- */
  documents?: {
    id: string;
    title: string;
    chunkCount: number;
    fileType?: string;
  }[];

  documentCount?: number;
}

/**
 * Chat message structure
 */
export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  meta?: {
    provider: string;
    model: string;
  };
};

/**
 * Context API
 */
export interface AssistantContextValue {
  /* Mode */
  mode: AssistantMode;
  setMode: (mode: AssistantMode) => void;

  /* Runtime context */
  context: AssistantRuntimeContext | null;
  setContext: (ctx: AssistantRuntimeContext | null) => void;
  clearContext: () => void;

  /* Chat */
  messages: AssistantMessage[];
  addMessage: (msg: AssistantMessage) => void;
  clearMessages: () => void;
}

/* ================= CONTEXT ================= */

const AssistantContext = createContext<AssistantContextValue | null>(null);

/* ================= PROVIDER ================= */

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AssistantMode>("offline");
  const [context, setContextState] = useState<AssistantRuntimeContext | null>(
    null,
  );
  const [messages, setMessages] = useState<AssistantMessage[]>([]);

  /* ---- Message helpers ---- */
  const addMessage = useCallback((msg: AssistantMessage) => {
    setMessages((prev) => {
      const cleaned = prev.filter((m) => !m.loading);
      return [...cleaned, msg];
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /* ---- Context helpers ---- */
  const setContext = useCallback((ctx: AssistantRuntimeContext | null) => {
    setContextState(ctx);
  }, []);

  const clearContext = useCallback(() => {
    setContextState(null);
  }, []);

  /* ---- Sync assistant mode from settings ---- */
  useEffect(() => {
    async function syncAssistantMode() {
      try {
        const res = await fetch(apiUrl("/settings"), {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
        });

        const data = await res.json();
        if (data.ok) {
          const enabled = data.settings?.assistant?.enabled;
          setMode(enabled ? "online" : "offline");
        }
      } catch {
        setMode("offline");
      }
    }

    syncAssistantMode();
  }, []);

  /* ---- Memoize the context value to prevent unnecessary re-renders ---- */
  const contextValue = useMemo(() => ({
    mode,
    setMode,
    context,
    setContext,
    clearContext,
    messages,
    addMessage,
    clearMessages,
  }), [mode, context, messages, setContext, clearContext, addMessage, clearMessages]);

  return (
    <AssistantContext.Provider value={contextValue}>
      {children}
    </AssistantContext.Provider>
  );
}

/* ================= HOOK ================= */

export function useAssistantContext() {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    throw new Error(
      "useAssistantContext must be used inside AssistantProvider",
    );
  }
  return ctx;
}
