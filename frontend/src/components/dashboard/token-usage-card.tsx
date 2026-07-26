import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Cpu, Bot, Zap } from "lucide-react"; 

export function TokenUsageCard() {
  return (
    <Card className="flex flex-col justify-center px-6 py-5 border-border/15 bg-card/20 shadow-sm rounded-xl min-h-[140px] w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground/90 tracking-tight">Token Usage</h3>
        <div className="flex items-center gap-1">
          <span className="text-base font-medium text-foreground/90">0</span>
          <span className="text-xs text-muted-foreground/60 mt-0.5">/ 0</span>
        </div>
      </div>
      
      <div className="flex flex-col gap-1.5 mb-5">
        <Progress value={0} className="h-2.5 bg-muted/30" />
        <div className="flex justify-end w-full">
          <span className="text-[10px] text-muted-foreground/50 tracking-wider">No usage data</span>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-border/10 pt-4">
        <span className="text-[11px] text-muted-foreground/60 mr-2">Inference Providers:</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 opacity-40">
             <div className="size-4 rounded bg-muted/40 flex items-center justify-center">
               <Zap className="size-2.5 text-muted-foreground" />
             </div>
             <span className="text-[11px] font-medium text-foreground/70">Groq</span>
             <span className="text-[10px] text-muted-foreground/50">(--)</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-40">
             <div className="size-4 rounded bg-muted/40 flex items-center justify-center">
               <Cpu className="size-2.5 text-muted-foreground" />
             </div>
             <span className="text-[11px] font-medium text-foreground/70">OpenAI</span>
             <span className="text-[10px] text-muted-foreground/50">(--)</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-40">
             <div className="size-4 rounded bg-muted/40 flex items-center justify-center">
               <Bot className="size-2.5 text-muted-foreground" />
             </div>
             <span className="text-[11px] font-medium text-foreground/70">Anthropic</span>
             <span className="text-[10px] text-muted-foreground/50">(--)</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
