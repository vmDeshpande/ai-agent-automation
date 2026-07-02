import React from "react";
import { Card } from "@/components/ui/card";
import { Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPIBarProps {
  stats: any;
  loading: boolean;
}

export function KPIBar({ stats, loading }: KPIBarProps) {
  const kpis = [
    { label: "workflows", value: stats?.workflows ?? 0, icon: Workflow, sub: "--", hasIcon: true },
    { label: "tasks", value: stats?.tasks ?? 0, icon: null, sub: "--" },
    { label: "running", value: stats?.runningTasks ?? 0, icon: null, sub: "--", highlighted: true },
    { label: "agents healthy", value: stats?.agents ?? 0, icon: null, sub: "--" },
    { label: "scheduled", value: stats?.schedules ?? 0, icon: null, sub: "--" },
  ];

  return (
    <Card className="flex flex-col justify-center px-4 md:px-6 py-5 border-border/15 bg-card/20 shadow-sm rounded-xl min-h-[110px] w-full">
      <div className="flex overflow-x-auto no-scrollbar items-center justify-between gap-6 md:gap-8 w-full pb-1 -mb-1">
        <div className="flex flex-nowrap items-center justify-between gap-6 md:gap-8 min-w-max w-full">
          {kpis.map((kpi, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-start shrink-0">
                <div className="flex items-center mb-2 h-8">
                  <div className={cn("flex items-center gap-2", kpi.highlighted && "bg-foreground text-background px-3 py-1 rounded-full")}>
                    {kpi.icon && <kpi.icon className="size-4 text-muted-foreground/60 shrink-0" />}
                    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <span className={cn("text-lg font-medium", kpi.highlighted ? "text-background" : "text-foreground/90")}>
                        {loading ? '-' : kpi.value}
                      </span>
                      <span className={cn("text-sm font-medium", kpi.highlighted ? "text-background/90" : "text-muted-foreground/80")}>
                        {kpi.label}
                      </span>
                    </div>
                  </div>
                </div>
                
                <span className={cn(
                   "text-[11px] font-medium tracking-wider whitespace-nowrap", 
                   kpi.highlighted ? "text-foreground/80 font-semibold px-3" : "text-muted-foreground/50",
                   kpi.hasIcon && !kpi.highlighted ? "pl-6" : "" 
                 )}>
                   {kpi.sub}
                </span>
              </div>
              
              {/* The dot separator */}
              {i < kpis.length - 1 && (
                <div className="flex items-center justify-center shrink-0">
                  <div className="size-[3px] rounded-full bg-border/40" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Card>
  );
}
