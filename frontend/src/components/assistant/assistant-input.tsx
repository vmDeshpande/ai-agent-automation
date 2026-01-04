"use client";

import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AssistantInput({
  onSend,
}: {
  onSend: (message: string) => void;
}) {
  const [value, setValue] = useState("");

  function send() {
    const trimmed = value.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-border bg-background px-3 py-3">
      {/* Hint */}
      <div className="mb-1 text-[11px] text-muted-foreground">
        Press <span className="font-mono">Ctrl + Enter</span> to send
      </div>

      <div className="flex items-end gap-2">
        {/* Input */}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the current state or errors…"
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-md bg-muted",
            "px-3 py-2 text-sm leading-relaxed",
            "outline-none focus:ring-2 focus:ring-primary",
            "whitespace-pre-wrap break-words",
            "overflow-hidden"
          )}
          style={{
            minHeight: "36px",
            maxHeight: "120px",
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "36px";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
        />

        {/* Send */}
        <Button
          size="icon"
          onClick={send}
          aria-label="Send message"
          disabled={!value.trim()}
          className="h-9 w-9 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
