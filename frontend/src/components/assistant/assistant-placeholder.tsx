export function AssistantPlaceholder({
  mode,
}: {
  mode: "online" | "offline";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <div className="mb-2 font-medium text-foreground">
        Assistant Ready
      </div>

      <ul className="space-y-1 text-muted-foreground">
        <li>• Analyze workflow state</li>
        <li>• Explain step failures</li>
        <li>• Diagnose task and log errors</li>
        <li>• Suggest concrete fixes</li>
      </ul>

      <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
        {mode === "offline" ? (
          <>
            Running in <span className="font-medium">offline mode</span>.  
            Responses are based on current UI context only.
          </>
        ) : (
          <>
            Running in <span className="font-medium">online mode</span>.  
            Full AI-powered analysis enabled.
          </>
        )}
      </div>
    </div>
  );
}
