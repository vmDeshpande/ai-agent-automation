'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  Clock,
  GitBranch,
  Info,
  Lightbulb,
  MemoryStick,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, PieChart, Pie } from 'recharts';

import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { MetricCardSkeleton, CardSkeleton, TableSkeleton } from '@/components/ui/skeletons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type { WorkflowInsights, StepStat, BranchRouting, Recommendation } from '@/types/insights';

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

function healthBg(score: number | null) {
  if (score == null) return 'from-card/40 to-card/20';
  if (score >= 80) return 'from-emerald-500/5 to-card/20';
  if (score >= 60) return 'from-amber-500/5 to-card/20';
  return 'from-rose-500/5 to-card/20';
}

const BRANCH_COLORS = [
  'oklch(0.72 0.19 160)',
  'oklch(0.70 0.18 250)',
  'oklch(0.78 0.19 80)',
  'oklch(0.65 0.20 300)',
  'oklch(0.65 0.25 25)',
];

function buildBranchChartConfig(branch: BranchRouting): ChartConfig {
  return Object.fromEntries(
    branch.outcomes.map((o, i) => [
      o.label,
      { label: o.label, color: BRANCH_COLORS[i % BRANCH_COLORS.length] },
    ])
  );
}

function severityConfig(severity: Recommendation['severity']) {
  if (severity === 'critical')
    return {
      icon: AlertTriangle,
      cls: 'border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    };
  if (severity === 'warning')
    return {
      icon: AlertTriangle,
      cls: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    };
  return {
    icon: Info,
    cls: 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  };
}

const stepChartConfig: ChartConfig = {
  successRate: { label: 'Success Rate %', color: 'oklch(0.72 0.19 160)' },
};

/* ─── sub-components ──────────────────────────────────────────────────── */

function HealthScoreCard({ score }: { score: number | null }) {
  const color = healthColor(score);
  const bg = healthBg(score);
  const pct = score ?? 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Card
      className={cn('border-border/20 bg-gradient-to-br p-6 flex flex-col items-center gap-3', bg)}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Workflow Health Score
      </p>
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            className="text-muted/20"
            stroke="currentColor"
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
          <span className={cn('text-3xl font-bold', color)}>{score ?? '—'}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
    </Card>
  );
}

function StepPerformanceSection({ steps }: { steps: StepStat[] }) {
  const chartData = [...steps]
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 12)
    .map((s) => ({
      name: s.stepId.length > 12 ? `${s.stepId.slice(0, 11)}…` : s.stepId,
      successRate: s.successRate,
    }));

  return (
    <Card className="border-border/20 bg-card/20 p-5 space-y-5">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Zap className="size-4 text-primary" /> Step Performance
      </h3>

      {/* Reuse ui/table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Step</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Runs</TableHead>
            <TableHead className="text-right">Success Rate</TableHead>
            <TableHead className="text-right">Avg Duration</TableHead>
            <TableHead>Common Errors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {steps.map((s) => {
            const srColor =
              s.successRate >= 80
                ? 'text-emerald-500'
                : s.successRate >= 60
                  ? 'text-amber-500'
                  : 'text-rose-500';
            const slowStep = s.avgDurationMs > 10000;
            return (
              <TableRow key={s.stepId}>
                <TableCell className="font-mono text-xs max-w-[160px] truncate">
                  {s.stepId}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px]">
                    {s.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {s.executions}
                </TableCell>
                <TableCell className={cn('text-right tabular-nums font-semibold', srColor)}>
                  {s.successRate.toFixed(1)}%
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    slowStep && 'text-amber-500 font-semibold'
                  )}
                >
                  {fmtMs(s.avgDurationMs)}
                  {slowStep && <span className="text-[10px] ml-1">⚠</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {s.commonErrors.length > 0 ? s.commonErrors.slice(0, 2).join('; ') : '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Reuse ChartContainer */}
      {chartData.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">Success Rate by Step (slowest-first)</p>
          <ChartContainer config={stepChartConfig} className="h-[180px] w-full">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="successRate" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {chartData.map((e) => (
                  <Cell
                    key={e.name}
                    fill={
                      e.successRate >= 80
                        ? 'oklch(0.72 0.19 160)'
                        : e.successRate >= 60
                          ? 'oklch(0.78 0.19 80)'
                          : 'oklch(0.65 0.25 25)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </Card>
  );
}

function BranchCard({ branch }: { branch: BranchRouting }) {
  const config = buildBranchChartConfig(branch);
  const pieData = branch.outcomes.map((o) => ({
    name: o.label,
    value: o.count,
    pct: o.pct,
    fill: config[o.label]?.color ?? BRANCH_COLORS[0],
  }));

  return (
    <Card className="border-border/20 bg-card/20 p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-primary" />
          <span className="font-mono text-sm font-medium truncate max-w-[180px]">
            {branch.stepId}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {branch.type}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {branch.isSkewed && (
            <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400">
              ⚠ Skewed
            </Badge>
          )}
          {branch.deadBranches.length > 0 && (
            <Badge className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400">
              {branch.deadBranches.length} dead branch{branch.deadBranches.length > 1 ? 'es' : ''}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {/* Reuse ChartContainer for pie */}
        {pieData.length > 0 && (
          <ChartContainer config={config} className="w-full sm:w-52 h-[160px] shrink-0">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                paddingAngle={2}
                nameKey="name"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, props) => [
                      `${value} (${props.payload?.pct?.toFixed(1)}%)`,
                      name,
                    ]}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        )}

        {/* Reuse Progress component for bars */}
        <div className="flex-1 space-y-3 w-full">
          {branch.outcomes.map((o, i) => (
            <div key={o.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: BRANCH_COLORS[i % BRANCH_COLORS.length] }}
                  />
                  {o.label}
                </span>
                <span className="font-semibold tabular-nums">{o.pct.toFixed(1)}%</span>
              </div>
              <Progress value={o.pct} className="h-1.5" />
            </div>
          ))}
          {branch.deadBranches.length > 0 && (
            <p className="text-xs text-rose-500 dark:text-rose-400 mt-2">
              Dead: {branch.deadBranches.join(', ')}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{branch.totalTraversals} total traversals</p>
    </Card>
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

/* ─── page ────────────────────────────────────────────────────────────── */

export default function WorkflowInsightsPage() {
  const params = useParams<{ workflowId: string }>();
  const { data, loading, error, refetch } = useApi<WorkflowInsights>(
    `/insights/workflows/${params.workflowId}`
  );

  return (
    <AuthenticatedLayout>
      <PageContainer>
        {/* header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/insights">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">Workflow Insights</h1>
            <p className="text-xs text-muted-foreground font-mono truncate">{params.workflowId}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
            className="ml-auto shrink-0"
          >
            <RefreshCw className={cn('size-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {error && !loading && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-5 py-4 text-sm text-rose-600 dark:text-rose-400 mb-6">
            Failed to load insights: {error}
          </div>
        )}

        {!loading && !error && data?.message && (
          <EmptyState
            icon={BarChart2}
            title="No execution history yet"
            description={data.message + ' Run this workflow to start generating insights.'}
          />
        )}

        {(loading || (data && !data.message)) && (
          <div className="space-y-8">
            {/* Row 1: Health score + Execution KPIs */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-1">
                {loading ? (
                  <CardSkeleton className="h-52" />
                ) : (
                  <HealthScoreCard score={data?.healthScore ?? null} />
                )}
              </div>
              <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3 content-start">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <MetricCardSkeleton key={i} />)
                  : data?.runStats && (
                      <>
                        <MetricCard
                          icon={Activity}
                          title="Total Runs"
                          value={data.runStats.totalRuns}
                        />
                        <MetricCard
                          icon={CheckCircle2}
                          title="Successful"
                          value={data.runStats.completedRuns}
                          subtitle={`${data.runStats.successRate.toFixed(1)}% rate`}
                        />
                        <MetricCard
                          icon={XCircle}
                          title="Failed"
                          value={data.runStats.failedRuns}
                        />
                        <MetricCard
                          icon={TrendingUp}
                          title="Success Rate"
                          value={`${data.runStats.successRate.toFixed(1)}%`}
                        />
                        <MetricCard
                          icon={Clock}
                          title="Avg Duration"
                          value={fmtMs(data.runStats.avgDurationMs)}
                        />
                        <MetricCard
                          icon={TrendingDown}
                          title="Min Duration"
                          value={fmtMs(data.runStats.minDurationMs)}
                        />
                        <MetricCard
                          icon={TrendingUp}
                          title="Max Duration"
                          value={fmtMs(data.runStats.maxDurationMs)}
                        />
                        <MetricCard
                          icon={Activity}
                          title="Analysed Runs"
                          value={data.analysedRuns}
                        />
                      </>
                    )}
              </div>
            </div>

            {/* Step Performance */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Zap className="size-4" /> Step Performance Analytics
              </h2>
              {loading ? (
                <TableSkeleton rows={5} columns={6} />
              ) : (data?.stepStats?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={Zap}
                  title="No step data"
                  description="No step results recorded yet for this workflow."
                />
              ) : (
                <StepPerformanceSection steps={data!.stepStats} />
              )}
            </section>

            {/* Branch Analytics */}
            {(loading || (data?.branchRouting?.length ?? 0) > 0) && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <GitBranch className="size-4" /> Branch Analytics
                </h2>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CardSkeleton className="h-52" />
                    <CardSkeleton className="h-52" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data!.branchRouting.map((b) => (
                      <BranchCard key={b.stepId} branch={b} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Memory & RAG */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <MemoryStick className="size-4" /> Memory &amp; RAG Effectiveness
              </h2>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CardSkeleton />
                  <CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="border-border/20 bg-card/20 p-5 space-y-3">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <MemoryStick className="size-4 text-violet-500" /> Semantic Memory
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
                        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                          ⚠ Avg {data.semanticMetrics.memory.avgSimilarity.toFixed(3)} — memories
                          appear weakly relevant.
                        </p>
                      )}
                    </div>
                  </Card>
                  <Card className="border-border/20 bg-card/20 p-5 space-y-3">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <Activity className="size-4 text-sky-500" /> Document RAG
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
                        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                          ⚠ Avg {data.semanticMetrics.rag.avgSimilarity.toFixed(3)} — low RAG
                          relevance.
                        </p>
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </section>

            {/* Recommendations */}
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
