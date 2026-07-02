import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  trend?: {
    value: number | string;
    isPositive?: boolean;
    label?: string;
  };
  footer?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  footer,
  loading,
  className,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={cn("px-5 py-4 flex flex-col justify-center border-border/20 bg-card/10 shadow-sm rounded-xl min-h-[88px]", className)}>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 bg-muted/30 animate-pulse rounded-md shrink-0" />
          <div className="flex items-center gap-2 w-full">
            <div className="h-7 w-10 bg-muted/30 animate-pulse rounded" />
            <div className="h-4 w-20 bg-muted/30 animate-pulse rounded" />
          </div>
        </div>
        <div className="h-3 w-28 bg-muted/20 animate-pulse rounded mt-2 ml-8" />
      </Card>
    );
  }

  return (
    <Card className={cn(
      "group relative px-5 py-4 flex flex-col justify-center border-border/15 bg-card/20 shadow-sm rounded-xl min-h-[88px]",
      "transition-all duration-300 hover:bg-card/40 hover:border-border/30",
      className
    )}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex items-center justify-center text-muted-foreground/60 transition-colors duration-300 group-hover:text-foreground/80 shrink-0">
            <Icon className="size-4.5" aria-hidden="true" />
          </div>
        )}
        <div className="flex items-baseline gap-2 flex-wrap leading-none">
          <span className="text-2xl font-medium tracking-tight text-foreground/95 group-hover:text-foreground transition-colors">
            {value}
          </span>
          <h3 className="text-sm font-medium text-muted-foreground/70 tracking-tight group-hover:text-muted-foreground transition-colors">
            {title}
          </h3>
          
          {trend && (
            <span className={cn(
              "text-xs font-medium ml-1",
              trend.isPositive ? "text-success/90" : "text-destructive/90"
            )}>
              <span className="sr-only">{trend.isPositive ? "Increased by" : "Decreased by"}</span>
              <span aria-hidden="true">{trend.isPositive ? "+" : ""}</span>
              {trend.value}
            </span>
          )}
        </div>
      </div>

      {(subtitle || trend?.label) && (
        <div className="mt-1.5 ml-7">
          <p className="text-xs text-muted-foreground/50 font-medium">
            {subtitle} {trend?.label && <span className="ml-1">{trend.label}</span>}
          </p>
        </div>
      )}

      {footer && (
        <div className="mt-3 pt-3 border-t border-border/10 text-xs text-muted-foreground/50 ml-7">
          {footer}
        </div>
      )}
    </Card>
  );
}
