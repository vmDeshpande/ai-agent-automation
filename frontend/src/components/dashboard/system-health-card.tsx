import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

export function SystemHealthCard() {
  const systems = [
    { name: "API", status: "operational" },
    { name: "Database", status: "operational" },
    { name: "Queue", status: "operational" },
    { name: "Storage", status: "operational" },
    { name: "Workers", status: "operational" },
  ];

  return (
    <Card className="flex flex-col justify-between px-6 py-5 border-border/15 bg-card/20 shadow-sm rounded-xl min-h-[110px] h-full">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-foreground/90 tracking-tight">System Health</h3>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <span className="text-[11px] font-semibold tracking-wider">Status Unavailable</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/40 mb-3 tracking-wide">Pending health checks</p>
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        {systems.map((sys, i) => (
          <div key={i} className="flex items-center gap-1.5 opacity-40">
            <div className="size-1.5 rounded-full bg-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/70 font-medium tracking-wider">{sys.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
