'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  ChevronRight,
  GitBranch,
  Info,
  Lightbulb,
  MemoryStick,
  RefreshCw,
  TrendingUp,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';

import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, CardSkeleton, ListSkeleton } from '@/components/ui/skeletons';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type { GlobalInsights, Recommendation, WorkflowSummary } from '@/types/insights';

/* ─── helpers ─────────────────────────────────────────────────────────── */

function fmtMs(ms: number | null | undefined) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function healthColor(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-rose-500';
}

function healthLabel(score: number | null) {
  if (score == null) return 'Unknown';
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Moderate';
  return 'Critical';
}

function severityConfig(severity: Recommendation['severity']) {
  switch (severity) {
    case 'critical':
      return {
        icon: AlertTriangle,
        cls: 'border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400',
        badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        cls: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      };
    default:
      return {
        icon: Info,
        cls: 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400',
        badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
      };
  }
}

const stepChartConfig: ChartConfig = {
  successRate: { label: 'Success Rate', color: 'oklch(0.72 0.19 160)' },
};

/* ─── sub-components ──────────────────────────────────────────────────── */

function HealthGauge({ score }: { score: number | null }) {
  const color = healthColor(score);
  const pct = score ?? 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            className="text-muted/20"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            className={cn(color, 'transition-all duration-700')}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-3xl font-bold tabular-nums', color)}>
            {score != null ? score : '—'}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <Badge variant="secondary" className={cn('text-xs font-semibold', color)}>
        {healthLabel(score)}
      </Badge>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const cfg = severityConfig(rec.severity);
  const Icon = cfg.icon;
  return (
    <div className={cn('rounded-xl border p-4 flex gap-3', cfg.cls)}>
      <Icon className="size-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <Badge className={cn('text-[10px] font-semibold mb-1 capitalize', cfg.badge)}>
          {rec.severity}
        </Badge>
        <p className="text-sm leading-relaxed">{rec.message}</p>
      </div>
    </div>
  );
}

function WorkflowSummaryRow({ wf }: { wf: WorkflowSummary }) {
  const success = wf.successRate;
  const color =
    success >= 80 ? 'text-emerald-500' : success >= 60 ? 'text-amber-500' : 'text-rose-500';
  return (
    <Link
      href={`/insights/workflows/${wf.workflowId}`}
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl
                 border border-border/20 bg-card/20 hover:bg-card/40 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Activity className="size-4 text-primary" />
        </div>
        <span className="text-sm font-medium truncate font-mono">{wf.workflowId.slice(-8)}…</span>
      </div>
      <div className="flex items-center gap-6 text-sm tabular-nums">
        <span className="text-muted-foreground">{wf.totalRuns} runs</span>
        <span className={cn('font-semibold', color)}>{success.toFixed(1)}%</span>
        <span className="text-muted-foreground hidden sm:block">{fmtMs(wf.avgDurationMs)} avg</span>
      </div>
      <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </Link>
  );
}

/* ─── page ────────────────────────────────────────────────────────────── */

export default function InsightsSummaryPage() {
  const { data, loading, error, refetch } = useApi<GlobalInsights>('/insights/summary');

  const stepChartData = (data?.stepStats ?? [])
    .sort((a, b) => b.executions - a.executions)
    .slice(0, 10)
    .map((s) => ({
      name: s.stepId.length > 14 ? `${s.stepId.slice(0, 13)}…` : s.stepId,
      successRate: s.successRate,
      executions: s.executions,
    }));

  return (
    <AuthenticatedLayout>
      <PageContainer>
        <PageHeader
          title="Workflow Insights"
          description="Aggregate intelligence across all your workflows"
          actions={
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn('size-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          }
        />

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-5 py-4 text-sm text-rose-600 dark:text-rose-400">
            Failed to load insights: {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && data?.message && (
          <EmptyState
            icon={BarChart2}
            title="No execution history yet"
            description={data.message + ' Run some workflows to start generating insights.'}
          />
        )}

        {/* Content */}
        {(loading || (data && !data.message)) && (
          <div className="space-y-8">
            {/* ── Section 1: Health + KPIs ── */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="size-4" /> Overview
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Health gauge */}
                <Card className="col-span-1 flex flex-col items-center justify-center py-6 px-4 border-border/20 bg-gradient-to-br from-card/40 to-card/20">
                  {loading ? (
                    <CardSkeleton className="w-full h-40 border-0 shadow-none bg-transparent" />
                  ) : (
                    <>
                      <HealthGauge score={data?.healthScore ?? null} />
                      <p className="text-xs text-muted-foreground mt-3">Overall Health Score</p>
                    </>
                  )}
                </Card>

                {/* KPIs — using shared MetricCard */}
                <div className="col-span-1 lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <MetricCardSkeleton key={i} />)
                  ) : (
                    <>
                      <MetricCard
                        icon={Activity}
                        title="Total Runs"
                        value={data?.analysedRuns ?? 0}
                      />
                      <MetricCard
                        icon={CheckCircle2}
                        title="Success Rate"
                        value={`${data?.overallSuccessRate?.toFixed(1) ?? 0}%`}
                        subtitle={
                          (data?.overallSuccessRate ?? 0) >= 80 ? 'On track' : 'Needs attention'
                        }
                      />
                      <MetricCard
                        icon={GitBranch}
                        title="Workflows"
                        value={data?.workflowSummaries?.length ?? 0}
                        subtitle="tracked"
                      />
                      <MetricCard
                        icon={Zap}
                        title="Step Types"
                        value={data?.stepStats?.length ?? 0}
                        subtitle="unique steps"
                      />
                      <MetricCard
                        icon={Lightbulb}
                        title="Recommendations"
                        value={data?.recommendations?.length ?? 0}
                        subtitle="action items"
                      />
                      <MetricCard
                        icon={MemoryStick}
                        title="Avg Memory Sim."
                        value={data?.semanticMetrics?.memory?.avgSimilarity?.toFixed(3) ?? '—'}
                        subtitle={
                          data?.semanticMetrics?.memory?.lowRelevance ? '⚠ Low relevance' : '✓ Good'
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* ── Section 2: Step Performance Chart ── */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Zap className="size-4" /> Step Performance (top 10 by executions)
              </h2>
              <Card className="border-border/20 bg-card/20 p-4">
                {loading ? (
                  <CardSkeleton className="h-56 border-0 shadow-none bg-transparent" />
                ) : stepChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No step data available.
                  </p>
                ) : (
                  <ChartContainer config={stepChartConfig} className="h-[220px] w-full">
                    <BarChart
                      data={stepChartData}
                      margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="successRate" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stepChartData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.successRate >= 80
                                ? 'oklch(0.72 0.19 160)'
                                : entry.successRate >= 60
                                  ? 'oklch(0.78 0.19 80)'
                                  : 'oklch(0.65 0.25 25)'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </Card>
            </section>

            {/* ── Section 3: Workflow Summaries ── */}
            {(loading || (data?.workflowSummaries?.length ?? 0) > 0) && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <GitBranch className="size-4" /> Workflow Summaries
                </h2>
                {loading ? (
                  <ListSkeleton rows={3} />
                ) : (
                  <div className="space-y-2">
                    {data?.workflowSummaries?.map((wf) => (
                      <WorkflowSummaryRow key={wf.workflowId} wf={wf} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Section 4: Memory & RAG ── */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <MemoryStick className="size-4" /> Memory &amp; RAG Effectiveness
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {loading ? (
                  <>
                    <CardSkeleton />
                    <CardSkeleton />
                  </>
                ) : (
                  <>
                    {/* Memory */}
                    <Card className="border-border/20 bg-card/20 p-5 space-y-3">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <MemoryStick className="size-4 text-violet-500" />
                        Semantic Memory
                      </div>
                      <div className="space-y-2 text-sm">
                        <DataRow
                          label="Samples analysed"
                          value={data?.semanticMetrics?.memory?.sampleCount ?? 0}
                        />
                        <DataRow
                          label="Avg similarity"
                          value={data?.semanticMetrics?.memory?.avgSimilarity?.toFixed(3) ?? '—'}
                          highlight={
                            data?.semanticMetrics?.memory?.lowRelevance
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }
                        />
                        {data?.semanticMetrics?.memory?.lowRelevance && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mt-1">
                            ⚠ Memories appear weakly relevant. Consider pruning or retuning
                            embeddings.
                          </p>
                        )}
                      </div>
                    </Card>

                    {/* RAG */}
                    <Card className="border-border/20 bg-card/20 p-5 space-y-3">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Activity className="size-4 text-sky-500" />
                        Document RAG
                      </div>
                      <div className="space-y-2 text-sm">
                        <DataRow
                          label="Samples analysed"
                          value={data?.semanticMetrics?.rag?.sampleCount ?? 0}
                        />
                        <DataRow
                          label="Avg similarity"
                          value={data?.semanticMetrics?.rag?.avgSimilarity?.toFixed(3) ?? '—'}
                          highlight={
                            data?.semanticMetrics?.rag?.lowRelevance
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }
                        />
                        {data?.semanticMetrics?.rag?.lowRelevance && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mt-1">
                            ⚠ Low RAG relevance. Try increasing Top-K or improving document
                            chunking.
                          </p>
                        )}
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </section>

            {/* ── Section 5: Recommendations ── */}
            {(loading || (data?.recommendations?.length ?? 0) > 0) && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <Lightbulb className="size-4" /> Optimization Recommendations
                </h2>
                <div className="space-y-3">
                  {loading
                    ? Array.from({ length: 2 }).map((_, i) => (
                        <CardSkeleton key={i} className="h-16" />
                      ))
                    : data?.recommendations?.map((rec, i) => (
                        <RecommendationCard key={i} rec={rec} />
                      ))}
                </div>
              </section>
            )}
          </div>
        )}
      </PageContainer>
    </AuthenticatedLayout>
  );
}

function DataRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', highlight)}>{value}</span>
    </div>
  );
}
