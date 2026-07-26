import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useApi } from '@/hooks/useApi';
import { useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import Link from 'next/link';

type Task = {
  _id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  metadata?: {
    runningBy?: string;
  };
};

type LiveStatusResponse = {
  ok: boolean;
  running: Task[];
  failed: Task[];
};

export function WorkflowsStatusCard() {
  const { data, loading, refetch } = useApi<LiveStatusResponse>(`/dashboard/live-status`);
  const [tab, settab] = useState<'Running' | 'Failed'>('Running');

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const tasks = tab === 'Running' ? (data?.running ?? []) : (data?.failed ?? []);
  const hasData = tasks.length > 0;

  return (
    <Card className="flex flex-col p-5 sm:p-6 border-border/15 bg-card/20 shadow-sm rounded-xl h-full min-h-75">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base font-medium text-foreground/90 tracking-tight">
          Workflows Status
        </h3>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex items-center gap-6 border-b border-border/10 px-1">
        {(['Running', 'Failed'] as const).map((t) => (
          <div
            key={t}
            className={`pb-2.5 border-b-2 cursor-pointer ${tab === t ? 'border-primary' : 'border-transparent'} text-sm font-medium text-foreground/90 -mb-px transition-all`}
            onClick={() => settab(t)}
          >
            {t}
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col pt-6 overflow-y-auto">
        <div className="w-full space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-60">
              <Loader2 className="size-8 mb-3 animate-spin text-muted-foreground/30" />
              <p className="text-sm font-medium">Loading workflows...</p>
            </div>
          ) : hasData ? (
            tasks.map((item: Task) => (
              <Link href={`/tasks/${item._id}`} key={item._id} className="block">
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/10 hover:bg-muted/10 transition-colors">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {item.metadata?.runningBy ?? 'System'} • Started:{' '}
                    {new Date(item.startedAt).toLocaleTimeString()}
                  </p>
                  <Progress value={tab === 'Running' ? 50 : 100} className="h-1" />
                </div>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-10 opacity-60">
              <Activity className="size-8 mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium">
                {tab === 'Running'
                  ? 'No workflows are currently running.'
                  : 'No recent workflow failures.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
