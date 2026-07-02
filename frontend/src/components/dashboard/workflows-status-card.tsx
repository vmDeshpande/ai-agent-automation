import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function WorkflowsStatusCard() {
  return (
    <Card className="flex flex-col p-5 sm:p-6 border-border/15 bg-card/20 shadow-sm rounded-xl h-full min-h-[300px]">
      <div className="mb-6">
        <h3 className="text-base font-medium text-foreground/90 tracking-tight">Workflows Status</h3>
        <div className="flex items-center gap-6 mt-5 border-b border-border/10 px-1">
          <div className="pb-2.5 border-b-2 border-primary text-sm font-medium text-foreground/90 -mb-[1px]">Running</div>
          <div className="pb-2.5 border-b-2 border-transparent text-sm font-medium text-muted-foreground/50 -mb-[1px]">Failed</div>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center items-center opacity-40">
        <div className="w-full space-y-7">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <div className="h-2.5 w-32 bg-muted/50 rounded" />
                <div className="h-2.5 w-8 bg-muted/50 rounded" />
              </div>
              <Progress value={0} className="h-1 bg-muted/30" />
            </div>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground/60 mt-8 tracking-wider">Status data unavailable</span>
      </div>
    </Card>
  );
}
