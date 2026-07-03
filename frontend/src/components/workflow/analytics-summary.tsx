import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricData {
  label: string;
  value: string | number | ReactNode;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
}

interface AnalyticsSummaryProps {
  metrics: MetricData[];
  className?: string;
}

export function AnalyticsSummary({ metrics, className }: AnalyticsSummaryProps) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {metrics.map((metric, index) => (
        <Card
          key={index}
          className="overflow-hidden border-border/50 shadow-sm bg-card/50 backdrop-blur-sm transition-colors hover:bg-card"
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
                <span className="text-2xl font-bold tracking-tight">{metric.value}</span>
              </div>
              {metric.icon && (
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  {metric.icon}
                </div>
              )}
            </div>
            {metric.trend && (
              <div className="mt-4 text-xs font-medium flex items-center gap-1.5">
                <span
                  className={cn(
                    metric.trendDirection === 'up' && 'text-emerald-500',
                    metric.trendDirection === 'down' && 'text-red-500',
                    metric.trendDirection === 'neutral' && 'text-muted-foreground'
                  )}
                >
                  {metric.trend}
                </span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
