"use client";

import { AssistantPanel } from "./assistant-panel";

export function AssistantShell({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[380px] border-l border-border bg-background shadow-xl">
      <AssistantPanel onClose={onClose} />
    </div>
  );
}
