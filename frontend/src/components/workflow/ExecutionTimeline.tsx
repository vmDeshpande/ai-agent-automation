import { CheckCircle2, Circle, XCircle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StepResult {
  stepId: string;
  success?: boolean;
  requiresApproval?: boolean;
  output?: unknown;
  timestamp?: string;
}

interface StepMetadata {
  name: string;
  stepId: string;
  type: string;
}

interface ExecutionTimelineProps {
  steps: StepMetadata[];
  results: StepResult[];
  status: string;
  onStepSelect: (stepId: string) => void;
  selectedStepId: string | null;
  taskCreatedAt?: string;
}

export function ExecutionTimeline({
  steps,
  results,
  status,
  onStepSelect,
  selectedStepId,
  taskCreatedAt,
}: ExecutionTimelineProps) {
  const getStepStatus = (stepId: string) => {
    const result = results.find((r) => r.stepId === stepId);
    if (!result) return 'pending';
    if (result.success === false) return 'failed';
    if (result.requiresApproval && status === 'pending_approval') return 'paused';
    if (result.success === true) return 'completed';
    return status === 'running' ? 'running' : 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />;
      case 'failed':
        return <XCircle className="size-4 text-destructive shrink-0" />;
      case 'running':
        return <Circle className="size-4 text-blue-500 animate-pulse shrink-0" />;
      case 'paused':
        return <ShieldCheck className="size-4 text-amber-500 shrink-0" />;
      default:
        return <Circle className="size-4 text-muted-foreground/30 shrink-0" />;
    }
  };

  // Determine if we have valid timestamps across the board to use proportional timing
  const hasValidTimestamps = results.length > 0 && results.some((r) => r.timestamp);

  // Calculate timings for the Gantt chart
  const stepTimings = new Map<
    string,
    { startPercent: number; widthPercent: number; durationStr: string }
  >();

  if (!hasValidTimestamps) {
    // Equal-width fallback
    const totalSteps = Math.max(1, steps.length);
    const stepWidth = 100 / totalSteps;

    steps.forEach((step, idx) => {
      const stepStatus = getStepStatus(step.stepId || (step as any).id);
      let isVisible = true;
      if (stepStatus === 'pending' && status !== 'running') isVisible = false;

      stepTimings.set(step.stepId || (step as any).id, {
        startPercent: idx * stepWidth,
        widthPercent: isVisible ? stepWidth * 0.95 : 0, // 95% to leave a tiny gap
        durationStr: stepStatus === 'pending' ? '-' : '...',
      });
    });
  } else {
    // Proportional timing based on timestamps
    const startMs = taskCreatedAt ? new Date(taskCreatedAt).getTime() : Date.now();
    let endMs = startMs;

    results.forEach((r) => {
      if (r.timestamp) {
        endMs = Math.max(endMs, new Date(r.timestamp).getTime());
      }
    });
    if (status === 'running') {
      endMs = Math.max(endMs, Date.now());
    }

    const totalDurationMs = Math.max(endMs - startMs, 1000); // minimum 1 second scale
    let currentStart = startMs;

    steps.forEach((step) => {
      const result = results.find((r) => r.stepId === (step.stepId || (step as any).id));
      let stepEnd = currentStart;
      let stepStatus = getStepStatus(step.stepId || (step as any).id);

      if (result && result.timestamp) {
        stepEnd = new Date(result.timestamp).getTime();
      } else if (stepStatus === 'running' || status === 'running') {
        const isFirstPending =
          !result &&
          !Array.from(stepTimings.values()).some(
            (t) =>
              t.startPercent + t.widthPercent > ((currentStart - startMs) / totalDurationMs) * 100
          );
        if (isFirstPending) {
          stepEnd = Date.now();
          stepStatus = 'running';
        }
      }

      const durationMs = Math.max(0, stepEnd - currentStart);
      const leftPercent = Math.min(
        100,
        Math.max(0, ((currentStart - startMs) / totalDurationMs) * 100)
      );
      const widthPercent = Math.min(
        100 - leftPercent,
        Math.max(0.5, (durationMs / totalDurationMs) * 100)
      );

      let durationStr = '-';
      if (durationMs > 0 || stepStatus !== 'pending') {
        durationStr = durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
      }

      stepTimings.set(step.stepId || (step as any).id, {
        startPercent: leftPercent,
        widthPercent: stepStatus === 'pending' && durationMs === 0 ? 0 : widthPercent,
        durationStr,
      });

      if (result && result.timestamp) {
        currentStart = stepEnd;
      }
    });
  }

  if (!steps || steps.length === 0) {
    return (
      <div className="flex flex-col h-full bg-card rounded-xl border border-border shadow-sm items-center justify-center text-muted-foreground p-8">
        <Circle className="size-8 mb-4 opacity-20" />
        <p>No steps available for this execution.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header / Axis */}
      <div className="flex items-center border-b border-border/50 bg-muted/5 text-xs font-medium text-muted-foreground">
        <div className="w-[45%] shrink-0 p-3 pl-4 border-r border-border/50 flex items-center justify-between">
          <span>Step Details</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <div className="size-1.5 rounded-full bg-emerald-500"></div>Success
            </span>
            <span className="flex items-center gap-1">
              <div className="size-1.5 rounded-full bg-destructive"></div>Failed
            </span>
            <span className="flex items-center gap-1">
              <div className="size-1.5 rounded-full bg-blue-500"></div>Run
            </span>
          </div>
        </div>
        <div className="flex-1 p-3 px-4 relative">
          <div className="absolute inset-0 flex justify-between px-4 items-center opacity-30 pointer-events-none">
            <div className="h-2 w-px bg-muted-foreground"></div>
            <div className="h-1 w-px bg-muted-foreground/50"></div>
            <div className="h-2 w-px bg-muted-foreground"></div>
            <div className="h-1 w-px bg-muted-foreground/50"></div>
            <div className="h-2 w-px bg-muted-foreground"></div>
          </div>
          <span className="relative z-10 bg-muted/5 px-1">Timeline</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {/* Subtle grid background for timeline area */}
        <div className="absolute top-0 bottom-0 right-0 left-[45%] pointer-events-none flex justify-between px-4 border-l border-border/50">
          <div className="w-px h-full bg-border/30"></div>
          <div className="w-px h-full bg-border/10"></div>
          <div className="w-px h-full bg-border/30"></div>
          <div className="w-px h-full bg-border/10"></div>
          <div className="w-px h-full bg-border/30"></div>
        </div>

        <div className="flex flex-col">
          {steps.map((step, idx) => {
            let stepStatus = getStepStatus(step.stepId || (step as any).id);
            const timing = stepTimings.get(step.stepId || (step as any).id);

            if (
              status === 'running' &&
              stepStatus === 'pending' &&
              timing &&
              timing.widthPercent > 0
            ) {
              stepStatus = 'running';
            }

            const isSelected = selectedStepId === (step.stepId || (step as any).id);

            return (
              <div
                key={step.stepId || (step as any).id}
                className={cn(
                  'flex relative cursor-pointer border-b border-border/30 last:border-none transition-colors group',
                  isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                )}
                onClick={() => onStepSelect(step.stepId || (step as any).id)}
              >
                {/* Left Column: Details */}
                <div
                  className={cn(
                    'w-[45%] shrink-0 p-3 pl-4 flex items-center gap-3 relative z-10',
                    isSelected
                      ? 'border-r-2 border-r-primary border-l-2 border-l-primary'
                      : 'border-r border-border/50 border-l-2 border-l-transparent'
                  )}
                >
                  <div className="w-5 text-xs text-muted-foreground/60 font-mono text-right">
                    {idx + 1}
                  </div>

                  {getStatusIcon(stepStatus)}

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm truncate font-medium',
                          isSelected
                            ? 'text-primary'
                            : 'text-foreground group-hover:text-primary transition-colors'
                        )}
                      >
                        {step.name || step.stepId || (step as any).id}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 px-1.5 bg-muted/20 text-muted-foreground tracking-wide font-mono shrink-0 uppercase"
                      >
                        {step.type}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Right Column: Gantt Bar */}
                <div className="flex-1 relative py-2.5 px-4 min-h-[44px]">
                  {timing && timing.widthPercent > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-4 rounded-full group-hover:h-5 transition-all duration-300 shadow-sm"
                      style={{
                        left: `calc(1rem + ${timing.startPercent} * (100% - 2rem) / 100)`,
                        width: `calc(${timing.widthPercent} * (100% - 2rem) / 100)`,
                        minWidth: stepStatus === 'running' ? '20px' : '8px',
                      }}
                    >
                      <div
                        className={cn(
                          'w-full h-full rounded-full opacity-90',
                          stepStatus === 'completed'
                            ? 'bg-emerald-500'
                            : stepStatus === 'failed'
                              ? 'bg-destructive'
                              : stepStatus === 'running'
                                ? 'bg-blue-500 animate-pulse'
                                : 'bg-muted-foreground/20'
                        )}
                      >
                        {/* Decorative inner gradient removed */}
                      </div>
                    </div>
                  )}

                  {/* Duration Tooltip-like label */}
                  {timing && timing.widthPercent > 0 && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                      style={{
                        left: `calc(1rem + ${timing.startPercent + timing.widthPercent} * (100% - 2rem) / 100 + 8px)`,
                      }}
                    >
                      {timing.durationStr}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
