"use client";

import { useAssistantContext } from "@/context/assistant-context";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function AssistantContextPreview() {
  const { context } = useAssistantContext();
  const [open, setOpen] = useState(false);

  if (!context) return null;

  return (
    <div className="border-b border-border bg-background/70 px-4 py-2">
      {/* Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Info className="h-3.5 w-3.5" />
        <span className="font-medium">Assistant Context</span>
      </button>

      {/* Content */}
      {open && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          {/* High-level */}
          <Section title="Scope">
            <ContextItem label="Page" value={context.page} />
            <ContextItem label="Status" value={context.status} />
          </Section>

          {/* Workflow */}
          {(context.workflowId || context.workflowName) && (
            <Section title="Workflow">
              <ContextItem label="Name" value={context.workflowName} />
              <ContextItem label="ID" value={context.workflowId} mono />
            </Section>
          )}

          {/* Step */}
          {(context.stepId || context.stepName) && (
            <Section title="Step">
              <ContextItem label="Name" value={context.stepName} />
              <ContextItem label="Type" value={context.stepType} />
              <ContextItem
                label="Description"
                value={context.stepDescription}
                multiline
              />
            </Section>
          )}

          {/* Task */}
          {(context.taskId || context.taskName) && (
            <Section title="Task">
              <ContextItem label="Name" value={context.taskName} />
              <ContextItem label="Status" value={context.taskStatus} />
              <ContextItem label="ID" value={context.taskId} mono />
            </Section>
          )}

          {/* Agent */}
          {(context.agentName || context.model) && (
            <Section title="Agent">
              <ContextItem label="Name" value={context.agentName} />
              <ContextItem label="Model" value={context.model} />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------
   UI helpers
------------------------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ContextItem({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div
        className={cn(
          "rounded-md bg-background/60 px-2 py-1.5 text-xs text-foreground",
          "break-words whitespace-pre-wrap",
          mono && "font-mono",
          multiline && "max-h-32 overflow-y-auto"
        )}
      >
        {value}
      </div>
    </div>
  );
}
