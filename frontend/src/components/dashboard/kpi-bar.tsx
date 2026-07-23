import React from "react";
import { Card } from "@/components/ui/card";
import { Workflow, ListChecks, Activity, Bot, Calendar, Database, Server, HardDrive, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types/dashboard";

interface KPIBarProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function KPIBar({ stats, loading }: KPIBarProps) {
  const kpis = [
    { id: "workflows", label: "Workflows", value: stats?.workflows ?? 0, icon: Workflow },
    { id: "tasks", label: "Tasks", value: stats?.tasks?.total ?? 0, icon: ListChecks },
    { id: "running", label: "Running", value: stats?.tasks?.running ?? 0, icon: Activity, highlighted: true },
    { id: "agents", label: "Agents", value: stats?.agents?.total ?? 0, icon: Bot },
    { id: "schedules", label: "Scheduled", value: stats?.schedules?.enabled ?? 0, icon: Calendar },
  ];

  const systems = [
    { name: "API", status: stats?.health?.api || "offline", icon: Server },
    { name: "Database", status: stats?.health?.database || "offline", icon: Database },
    { name: "Queue", status: stats?.health?.queue || "offline", icon: ListChecks },
    { name: "Storage", status: stats?.health?.storage || "offline", icon: HardDrive },
    { name: "Workers", status: stats?.health?.workers || "offline", icon: Box },
  ];

  const getHealthColor = (status: string) => {
    if (status === "operational") return "bg-emerald-500/80";
    if (status === "degraded") return "bg-amber-500/80";
    return "bg-destructive/80";
  };

  return (
    <Card className="flex flex-col border-border/15 bg-card/20 shadow-sm rounded-xl w-full">
      <div className="flex overflow-x-auto no-scrollbar items-center justify-between gap-6 md:gap-8 w-full px-4 md:px-6 py-5">
        <div className="flex flex-nowrap items-center justify-between gap-6 md:gap-8 min-w-max w-full">
          {kpis.map((kpi, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-start shrink-0">
                <div className="flex items-center mb-2 h-8">
                  <div className={cn("flex items-center gap-2", kpi.highlighted && "bg-foreground text-background px-3 py-1 rounded-full")}>
                    {kpi.icon && <kpi.icon className={cn("size-4 shrink-0", kpi.highlighted ? "text-background/80" : "text-muted-foreground/60")} />}
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
                
                <div className={cn(
                   "flex items-center gap-1.5 whitespace-nowrap min-h-[16px]",
                   kpi.highlighted ? "pl-3" : "pl-6"
                 )}>
                   {kpi.id === "workflows" && (
                     <span className="text-[11px] font-medium tracking-wider text-emerald-500/90">
                       +{stats?.workflowTrend ?? 0} this week
                     </span>
                   )}
                   
                   {kpi.id === "tasks" && (
                     stats?.tasks && stats.tasks.total > 0 ? (
                       <div className="flex flex-col gap-1 w-20 ml-0.5">
                         <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                           <div className="bg-emerald-500" style={{ width: `${(stats.tasks.completed / stats.tasks.total) * 100}%` }} title="Completed" />
                           <div className="bg-amber-500" style={{ width: `${(stats.tasks.running / stats.tasks.total) * 100}%` }} title="Running" />
                           <div className="bg-destructive" style={{ width: `${(stats.tasks.failed / stats.tasks.total) * 100}%` }} title="Failed" />
                         </div>
                       </div>
                     ) : (
                       <span className="text-[11px] font-medium tracking-wider text-muted-foreground/40">
                         No status data
                       </span>
                     )
                   )}
                   
                   {kpi.id === "running" && (
                     kpi.value > 0 ? (
                       <>
                         <div className="relative flex h-1.5 w-1.5 items-center justify-center">
                           <div className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></div>
                           <div className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                         </div>
                         <span className="text-[11px] font-medium tracking-wider text-amber-500/90">
                           Active
                         </span>
                       </>
                     ) : (
                       <>
                         <div className="size-1.5 rounded-full bg-muted-foreground/30" />
                         <span className="text-[11px] font-medium tracking-wider text-muted-foreground/50">
                           Idle
                         </span>
                       </>
                     )
                   )}
                   
                   {kpi.id === "agents" && (
                     stats?.agents && stats.agents.total > 0 ? (
                       <div className="flex items-center gap-1.5 ml-0.5">
                         <div className="flex h-1.5 w-12 overflow-hidden rounded-full bg-muted/30">
                           <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(stats.agents.active / stats.agents.total) * 100}%` }} />
                         </div>
                         <span className="text-[10px] text-emerald-500/90 font-medium">{Math.round((stats.agents.active / stats.agents.total) * 100)}% active</span>
                       </div>
                     ) : (
                       <span className="text-[11px] font-medium tracking-wider text-muted-foreground/40">
                         No agents found
                       </span>
                     )
                   )}
                   
                   {kpi.id === "schedules" && (
                     stats?.schedules && (stats.schedules.enabled > 0 || stats.schedules.disabled > 0) ? (
                       <>
                         <div className={cn("size-1.5 rounded-full", stats.schedules.enabled > 0 ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                         <span className={cn("text-[11px] font-medium tracking-wider", stats.schedules.enabled > 0 ? "text-emerald-500/90" : "text-muted-foreground/70")}>
                           {stats.schedules.enabled} Active / {stats.schedules.disabled} Disabled
                         </span>
                       </>
                     ) : (
                       <span className="text-[11px] font-medium tracking-wider text-muted-foreground/40">
                         No schedule data
                       </span>
                     )
                   )}
                </div>
              </div>
              
              {i < kpis.length - 1 && (
                <div className="flex items-center justify-center shrink-0">
                  <div className="size-[3px] rounded-full bg-border/40" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6 py-3 border-t border-border/10 bg-muted/5">
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/50 uppercase">System Status</span>
          <div className="flex items-center gap-4">
            {systems.map((sys, i) => (
              <div key={i} className="flex items-center gap-1.5 opacity-80" title={sys.status}>
                <sys.icon className="size-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground/80 font-medium tracking-wider">{sys.name}</span>
                <div className={cn("size-1.5 rounded-full ml-0.5", getHealthColor(sys.status))} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}