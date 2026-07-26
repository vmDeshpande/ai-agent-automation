import { Card } from '@/components/ui/card';
import { Activity, Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ExecutionTrendPoint, ExecutionTrendSummary } from '@/types/dashboard';

// ── Props ───────────────────────────────────────────────────────────────────────
interface AnalyticsSectionProps {
  /** 7-point trend array (one entry per day) */
  trend: ExecutionTrendPoint[];
  /** Aggregated summary across the 7-day window */
  summary: ExecutionTrendSummary | null;
  /** True while the API call is in flight */
  loading: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Convert milliseconds to a human-readable string like "2m 15s" or "3.2s" */
function formatDuration(ms: number): string {
  if (ms <= 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) {
    // Return with 1 decimal place, e.g. 3.2s (or truncate trailing .0)
    const formatted = seconds.toFixed(1);
    return formatted.endsWith('.0') ? `${Math.round(seconds)}s` : `${formatted}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

/** Custom recharts tooltip */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const point: ExecutionTrendPoint | undefined = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border/20 bg-card px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground/90 mb-1.5">{point.dateKey}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-primary/80" />
          <span className="text-muted-foreground">Executions:</span>
          <span className="font-semibold text-foreground/90 ml-auto">{point.executions}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-500/80" />
          <span className="text-muted-foreground">Success:</span>
          <span className="font-semibold text-foreground/90 ml-auto">{point.success}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-destructive/80" />
          <span className="text-muted-foreground">Failed:</span>
          <span className="font-semibold text-foreground/90 ml-auto">{point.failed}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-muted-foreground/40" />
          <span className="text-muted-foreground">Avg duration:</span>
          <span className="font-semibold text-foreground/90 ml-auto">
            {formatDuration(point.avgDurationMs)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────────
export function AnalyticsSection({ trend, summary, loading }: AnalyticsSectionProps) {
  const hasData = trend.some((d) => d.executions > 0);

  return (
    <div className="w-full">
      {/* Execution Trend Chart Card */}
      <Card className="p-5 sm:p-6 border-border/15 bg-card/20 shadow-sm rounded-xl flex flex-col min-h-[350px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-medium text-foreground/90 tracking-tight">
              Workflow Executions (Last 7 Days)
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {loading && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground/50" />
            )}
            <div className="hidden sm:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground/70">
                <div className="size-2 rounded-full bg-primary/80" />
                <span>
                  Executions{' '}
                  <span className="font-semibold text-foreground/90 ml-1">
                    {summary ? summary.total : '-'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground/70">
                <div className="size-2 rounded-full bg-emerald-500/80" />
                <span>
                  Success{' '}
                  <span className="font-semibold text-foreground/90 ml-1">
                    {summary ? `${summary.successRate}%` : '-'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground/70">
                <div className="size-2 rounded-full bg-muted-foreground/40" />
                <span>
                  Avg dur.{' '}
                  <span className="font-semibold text-foreground/90 ml-1">
                    {summary ? formatDuration(summary.avgDurationMs) : '-'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full" style={{ height: 220 }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-border/30"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground/60"
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground/60"
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="executions"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                />
                <Line
                  type="monotone"
                  dataKey="success"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center rounded-lg border border-dashed border-border/20 bg-muted/5">
              <div className="size-10 rounded-full bg-muted/20 flex items-center justify-center mb-3">
                <Activity className="size-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground/80">
                No execution history available
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Run your first workflow to populate analytics
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
