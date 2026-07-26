import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Cpu, Bot, Zap, Loader2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useEffect, useMemo } from 'react';
import type { TokenUsageResponse } from '@/types/dashboard';

/**
 * Issue #281 — live AI token usage analytics card.
 *
 * Replaces the placeholder UI (which rendered hardcoded `0 / 0` and
 * `--` per-provider counts) with a real fetch from
 * `GET /api/dashboard/token-usage`. The dashboard polls every 30s so
 * new LLM steps surface without a manual reload — long enough to avoid
 * hammering the backend while still giving the user a "live" feel
 * (token counts only change after a workflow's LLM step completes, so
 * polling faster would just be noise).
 *
 * Visual layout intentionally matches the redesigned card the issue
 * spec references:
 *
 *   ┌───────────────────────────────────────────┐
 *   │  Token Usage           124,582 / Unlimited │
 *   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  (right-aligned label)
 *   │  Inference Providers:                       │
 *   │  ● Groq 42,310  ● OpenAI 18,421  ● Gemini … │
 *   └───────────────────────────────────────────┘
 *
 * When `totalTokens === 0` we render a one-line empty-state
 * ("No token usage available — Run an AI workflow to populate usage
 * statistics.") per the issue spec.
 */

// Stable provider → icon map. Same order as the backend's
// `TOKEN_USAGE_PROVIDERS` constant.
const PROVIDER_ICONS: Record<string, { icon: typeof Zap; label: string }> = {
  groq: { icon: Zap, label: 'Groq' },
  openai: { icon: Cpu, label: 'OpenAI' },
  anthropic: { icon: Bot, label: 'Anthropic' },
  gemini: { icon: Bot, label: 'Gemini' },
  ollama: { icon: Cpu, label: 'Ollama' },
  huggingface: { icon: Bot, label: 'HuggingFace' },
};

// Polling interval — see file-header docstring for rationale.
const POLL_INTERVAL_MS = 30_000;

function formatTokens(n: number): string {
  if (n === 0) return '0';
  return n.toLocaleString('en-US');
}

export function TokenUsageCard() {
  const { data, loading, refetch } = useApi<TokenUsageResponse>('/dashboard/token-usage');

  // Auto-poll every 30s. Mirrors the pattern in workflows-status-card.tsx
  // (which polls /live-status every 5s) but at a slower cadence since
  // token usage only changes when an LLM step finishes — not on every
  // status transition.
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refetch]);

  // ── Derived view-model ──────────────────────────────────────────────
  const totalTokens = data?.totalTokens ?? 0;
  const limit = data?.limit ?? null;
  const progress = useMemo(() => {
    if (!limit || limit <= 0) return 0;
    return Math.min(100, Math.round((totalTokens / limit) * 100));
  }, [totalTokens, limit]);

  const limitLabel = limit == null ? 'Unlimited' : formatTokens(limit);
  const hasUsage = totalTokens > 0;

  // Pull the per-provider rows in stable order from the backend response.
  // Defensive against the backend omitting a provider (e.g. someone adds a
  // new one but forgets to update TOKEN_USAGE_PROVIDERS): we fall back to
  // "no_usage" with zeroes so the card layout stays stable.
  const providerRows = (data?.providers ?? []).map((p) => {
    const meta = PROVIDER_ICONS[p.provider] ?? {
      icon: Cpu,
      label: p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
    };
    return { ...p, ...meta };
  });

  return (
    <Card className="flex flex-col justify-center px-6 py-5 border-border/15 bg-card/20 shadow-sm rounded-xl min-h-[140px] w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground/90 tracking-tight">Token Usage</h3>
        <div className="flex items-center gap-1">
          {loading && <Loader2 className="size-3 animate-spin text-muted-foreground/50 mr-1.5" />}
          <span className="text-base font-medium text-foreground/90">
            {formatTokens(totalTokens)}
          </span>
          <span className="text-xs text-muted-foreground/60 mt-0.5">/ {limitLabel}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-5">
        <Progress value={progress} className="h-2.5 bg-muted/30" />
        <div className="flex justify-end w-full">
          <span className="text-[10px] text-muted-foreground/50 tracking-wider">
            {hasUsage
              ? limit
                ? `${progress}% of quota`
                : `${formatTokens(totalTokens)} tokens used`
              : 'No usage data'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-border/10 pt-4">
        <span className="text-[11px] text-muted-foreground/60 mr-2">Inference Providers:</span>
        <div className="flex items-center gap-4">
          {providerRows.map((p) => {
            // Per spec: "Only providers with usage should be highlighted."
            // `no_usage` rows render at 40% opacity (matches the old static
            // card's dimmed styling) — `active` and `inactive` render full.
            const dimmed = p.status === 'no_usage';
            const Icon = p.icon;
            const dot =
              p.status === 'active'
                ? 'bg-emerald-500/80'
                : p.status === 'inactive'
                  ? 'bg-amber-500/70'
                  : 'bg-muted-foreground/30';
            return (
              <div
                key={p.provider}
                className={`flex items-center gap-1.5 ${dimmed ? 'opacity-40' : ''}`}
                title={
                  p.status === 'no_usage'
                    ? `${p.label} — No Usage`
                    : p.status === 'active'
                      ? `${p.label} — Active (last call ${p.lastCallAt ? new Date(p.lastCallAt).toLocaleString() : '—'})`
                      : p.lastCallAt
                        ? `${p.label} — Inactive (last call ${new Date(p.lastCallAt).toLocaleString()})`
                        : `${p.label} — Inactive`
                }
              >
                <div className="size-4 rounded bg-muted/40 flex items-center justify-center">
                  <Icon className="size-2.5 text-muted-foreground" />
                </div>
                <span className="text-[11px] font-medium text-foreground/70">{p.label}</span>
                {/* Activity dot — green/amber/dim depending on status */}
                <span className={`inline-block size-1.5 rounded-full ${dot}`} aria-hidden />
                <span className="text-[10px] text-muted-foreground/50">
                  {p.calls > 0 ? `(${formatTokens(p.totalTokens)})` : '(--)'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state — per issue spec "If no AI requests have been executed" */}
      {!hasUsage && (
        <div className="mt-4 text-center text-[11px] text-muted-foreground/60 leading-relaxed">
          No token usage available
          <br />
          Run an AI workflow to populate usage statistics.
        </div>
      )}
    </Card>
  );
}
