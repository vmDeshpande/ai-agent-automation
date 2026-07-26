'use client';

import { useEffect, useState } from 'react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import ScheduleTable from '@/components/schedules/ScheduleTable';
import CreateScheduleDialog from '@/components/schedules/CreateScheduleDialog';
import { useAssistantContext } from '@/context/assistant-context';
import { apiUrl } from '@/lib/api';
import { Clock, Activity, Calendar, PlayCircle } from 'lucide-react';
import { CronExpressionParser } from 'cron-parser';

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const { setContext, clearContext } = useAssistantContext();

  async function fetchSchedules() {
    const res = await fetch(apiUrl('/schedules'), {
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (data.ok) setSchedules(data.schedules);
    setLoading(false);
  }

  useEffect(() => {
    async function loadSchedules() {
      await fetchSchedules();
    }
    loadSchedules();
  }, []);

  useEffect(() => {
    if (loading) return;

    setContext({
      page: 'schedules',
      status: `${schedules.length} schedule(s) configured`,
      schedules: schedules.map((s: any) => ({
        scheduleId: s._id,
        scheduleName: s.name ?? 'Unnamed schedule',
        cron: s.cron ?? 'Not set',
        enabled: Boolean(s.enabled),
      })),
    });

    return () => {
      clearContext();
    };
  }, [loading, schedules.length]);

  // Metrics calculation
  const activeCount = schedules.filter((s: any) => s.enabled).length;

  let nextExecution: Date | null = null;
  schedules.forEach((s: any) => {
    if (s.enabled && s.cron) {
      try {
        const interval = CronExpressionParser.parse(s.cron, {
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        const next = interval.next().toDate();
        if (!nextExecution || next < nextExecution) {
          nextExecution = next;
        }
      } catch (e) {
        // ignore invalid cron
      }
    }
  });

  const nextExecutionFormatted = nextExecution
    ? new Date(nextExecution as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '-';

  // Timeline representation (7 days)
  const today = new Date();
  const timelineDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      date: d,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      hasRuns: false,
    };
  });

  if (schedules.some((s: any) => s.enabled)) {
    schedules.forEach((s: any) => {
      if (s.enabled && s.cron) {
        try {
          const interval = CronExpressionParser.parse(s.cron, {
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
          // check next 10 runs
          for (let i = 0; i < 10; i++) {
            const run = interval.next().toDate();
            const diffDays = Math.floor((run.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < 7) {
              timelineDays[diffDays].hasRuns = true;
            }
          }
        } catch (e) {}
      }
    });
  }

  return (
    <AuthenticatedLayout>
      <div className="flex flex-col gap-8 pb-8 animate-in fade-in duration-500">
        <PageHeader
          title="Schedules"
          description="Automate recurring workflow executions."
          actions={<CreateScheduleDialog onCreated={fetchSchedules} />}
        />

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6 flex flex-col gap-2 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:bg-card hover:shadow-md hover:border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Active Schedules</span>
              <div className="p-2 bg-primary/10 rounded-md">
                <Activity className="size-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold">{activeCount > 0 ? activeCount : '-'}</div>
          </Card>

          <Card className="p-6 flex flex-col gap-2 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:bg-card hover:shadow-md hover:border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Next Execution</span>
              <div className="p-2 bg-primary/10 rounded-md">
                <Clock className="size-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold">{nextExecutionFormatted}</div>
          </Card>

          <Card className="p-6 flex flex-col gap-2 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:bg-card hover:shadow-md hover:border-primary/20 justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Runs</span>
              <div className="p-2 bg-primary/10 rounded-md">
                <PlayCircle className="size-4 text-primary" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground/70 font-medium mt-1">
              Waiting for execution data
            </div>
          </Card>

          <Card className="p-6 flex flex-col gap-2 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:bg-card hover:shadow-md hover:border-primary/20 justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Success Rate</span>
              <div className="p-2 bg-primary/10 rounded-md">
                <Calendar className="size-4 text-primary" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground/70 font-medium mt-1">
              Waiting for execution data
            </div>
          </Card>
        </div>

        {/* Schedule Timeline */}
        <Card className="p-6 bg-card/40 backdrop-blur-md border-border/50 rounded-xl shadow-sm">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground mb-6">
            <Calendar className="size-5 text-primary" />
            Upcoming Executions
          </h3>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {timelineDays.map((day, i) => (
              <div
                key={i}
                className={`flex flex-col items-center justify-center flex-1 min-w-[60px] p-3 rounded-lg border ${day.hasRuns ? 'bg-primary/10 border-primary/30' : 'bg-background/50 border-border/50'}`}
              >
                <span
                  className={`text-xs font-semibold ${day.hasRuns ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {day.dayName}
                </span>
                <div
                  className={`mt-3 size-2 rounded-full ${day.hasRuns ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]' : 'bg-muted-foreground/30'}`}
                ></div>
              </div>
            ))}
          </div>
          {!schedules.some((s: any) => s.enabled) && (
            <p className="text-sm text-muted-foreground mt-4 text-center bg-background/50 py-2 rounded-lg border border-border/50">
              No upcoming scheduled runs
            </p>
          )}
        </Card>

        <div className="mt-2">
          <ScheduleTable schedules={schedules} loading={loading} onChange={fetchSchedules} />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
