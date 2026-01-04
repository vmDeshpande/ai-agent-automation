import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AssistantHeader({
  mode,
  onClose,
}: {
  mode: "online" | "offline";
  onClose: () => void;
}) {
  const isOnline = mode === "online";

  return (
    <div className="flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            isOnline
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Sparkles className="h-4 w-4" />
        </div>

        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Assistant</span>
          <span className="text-xs text-muted-foreground">
            Context-aware analysis
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Status */}
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            isOnline
              ? "bg-blue-500/15 text-blue-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isOnline ? "bg-blue-400 animate-pulse" : "bg-muted-foreground"
            )}
          />
          {isOnline ? "Online" : "Offline"}
        </span>

        {/* Close */}
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Close assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
