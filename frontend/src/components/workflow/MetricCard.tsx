import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  trend?: {
    value: ReactNode;
    isPositive?: boolean;
  };
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        'p-5 flex flex-col justify-between border-border bg-card shadow-sm rounded-xl',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </h3>
        {Icon && (
          <div className="text-muted-foreground">
            <Icon className="size-4" strokeWidth={2} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-foreground">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium',
              trend.isPositive ? 'text-emerald-500' : 'text-destructive'
            )}
          >
            {trend.value}
          </span>
        )}
        {subtitle && !trend && (
          <span className="text-xs text-muted-foreground font-medium">{subtitle}</span>
        )}
      </div>
    </Card>
  );
}
