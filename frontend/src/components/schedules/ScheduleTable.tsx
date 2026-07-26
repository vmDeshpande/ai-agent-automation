'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Trash, Clock, Calendar, Zap, Power } from 'lucide-react';
import { CronExpressionParser } from 'cron-parser';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { apiUrl } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import CreateScheduleDialog from '@/components/schedules/CreateScheduleDialog';

type Schedule = {
  _id: string;
  workflowName: string;
  name?: string;
  cron: string;
  enabled: boolean;
  timezone?: string;
};

type ScheduleTableProps = {
  schedules: Schedule[];
  loading: boolean;
  onChange: () => void;
};

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatCountdown(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());

  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `in ${minutes}m ${seconds}s`;
  }

  return `in ${seconds}s`;
}

function getNextRun(cron: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cron, {
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    return interval.next().toDate();
  } catch {
    return null;
  }
}

function cronToHuman(cron: string) {
  if (cron.startsWith('*/')) {
    const n = cron.split('*/')[1].split(' ')[0];
    return `Every ${n} minute(s)`;
  }
  if (cron.startsWith('0 */')) {
    const n = cron.split('0 */')[1].split(' ')[0];
    return `Every ${n} hour(s)`;
  }
  return 'Custom schedule';
}

export default function ScheduleTable({ schedules, loading, onChange }: ScheduleTableProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const { addToast } = useToast();

  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function toggle(id: string, enabled: boolean) {
    try {
      setTogglingId(id);
      await fetch(apiUrl(`/schedules/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({ enabled }),
      });
      onChange();
      addToast({
        type: 'info',
        title: 'Schedule Updated',
        description: `Your schedule is now ${enabled ? 'Active' : 'Paused'}`,
      });
    } finally {
      setTogglingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this schedule?')) return;
    await fetch(apiUrl(`/schedules/${id}`), {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
    });
    onChange();
    addToast({
      type: 'success',
      title: 'Schedule Deleted',
      description: 'Your schedule was deleted successfully',
    });
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 mt-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
            <div className="space-y-3 mt-2">
              <Skeleton className="h-8 w-full" />
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!schedules.length) {
    return (
      <EmptyState
        className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm py-12"
        icon={Calendar}
        title="No automations scheduled"
        description="Set up recurring schedules to automatically trigger your workflows. Create daily reports, weekly data syncs, or custom pipelines."
        primaryAction={
          <div className="flex flex-col items-center gap-6">
            <CreateScheduleDialog onCreated={onChange} />
            <div className="flex gap-2 justify-center">
              <Badge variant="outline" className="px-3 py-1 bg-background/50">
                Daily Report
              </Badge>
              <Badge variant="outline" className="px-3 py-1 bg-background/50">
                Weekly Sync
              </Badge>
              <Badge variant="outline" className="px-3 py-1 bg-background/50">
                Data Pipeline
              </Badge>
            </div>
          </div>
        }
      />
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {schedules.map((s) => {
        const next = getNextRun(s.cron);

        return (
          <Card
            key={s._id}
            className={`p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-lg rounded-xl bg-card/60 backdrop-blur-sm border-border/60 ${
              s.enabled ? 'hover:border-primary/50' : 'opacity-80 hover:opacity-100 grayscale-[0.2]'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`p-2.5 rounded-lg flex-shrink-0 ${s.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  <Clock className="size-5" />
                </div>
                <div className="min-w-0 mt-0.5">
                  <h3 className="font-semibold text-base truncate pr-2">
                    {s.name || s.workflowName}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Zap className="size-3" />
                    <span className="truncate">{s.workflowName}</span>
                  </div>
                </div>
              </div>
              <Switch
                checked={s.enabled}
                disabled={togglingId === s._id}
                onCheckedChange={(value) => toggle(s._id, value)}
                className="flex-shrink-0 ml-2"
              />
            </div>

            <div className="flex flex-col gap-3 bg-background/50 p-3 rounded-lg border border-border/50 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Frequency</span>
                <Badge
                  variant="secondary"
                  className="font-mono text-[10px] uppercase tracking-wider bg-background"
                >
                  {s.cron}
                </Badge>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Next Run</span>
                {next ? (
                  <div className="text-right">
                    <div className="font-medium text-foreground">{formatTime(next)}</div>
                    <div
                      className={`text-xs ${s.enabled ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                    >
                      {formatCountdown(next)}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-destructive">Invalid cron</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/40">
              <Badge
                variant="outline"
                className={
                  s.enabled
                    ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5 text-xs font-semibold uppercase tracking-wider'
                    : 'border-border text-muted-foreground bg-muted/20 text-xs font-semibold uppercase tracking-wider'
                }
              >
                {s.enabled ? (
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Power className="size-3" />
                    Paused
                  </span>
                )}
              </Badge>

              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-8 transition-colors"
                onClick={() => remove(s._id)}
                title="Delete Schedule"
              >
                <Trash className="size-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
