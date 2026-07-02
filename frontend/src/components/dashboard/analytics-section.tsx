import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AnalyticsSectionProps {
  stats: any;
  loading: boolean;
}

export function AnalyticsSection({ stats, loading }: AnalyticsSectionProps) {
  // Empty state since backend doesn't have historical execution endpoints yet
  const chartData: any[] = []; 
  const hasData = chartData && chartData.length > 0;

  return (
    <div className="w-full mb-6">
      
      {/* Execution Trend Chart Card */}
      <Card className="p-5 sm:p-6 border-border/15 bg-card/20 shadow-sm rounded-xl flex flex-col min-h-[350px]">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-medium text-foreground/90 tracking-tight">Workflow Executions (Last 7 Days)</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-xs">
               <div className="flex items-center gap-1.5 text-muted-foreground/70">
                 <div className="size-2 rounded-full bg-primary/80" />
                 <span>Executions <span className="font-semibold text-foreground/90 ml-1">-</span></span>
               </div>
               <div className="flex items-center gap-1.5 text-muted-foreground/70">
                 <div className="size-2 rounded-full bg-emerald-500/80" />
                 <span>Success <span className="font-semibold text-foreground/90 ml-1">-%</span></span>
               </div>
               <div className="flex items-center gap-1.5 text-muted-foreground/70">
                 <div className="size-2 rounded-full bg-muted-foreground/40" />
                 <span>Avg dur. <span className="font-semibold text-foreground/90 ml-1">-</span></span>
               </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 relative w-full h-full min-h-[220px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/30" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground/60"
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground/60"
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border)/0.2)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="executions" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="success" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/20 bg-muted/5">
               <div className="size-10 rounded-full bg-muted/20 flex items-center justify-center mb-3">
                 <Activity className="size-5 text-muted-foreground/40" />
               </div>
               <p className="text-sm font-medium text-foreground/80">No execution history available</p>
               <p className="text-xs text-muted-foreground/50 mt-1">Run your first workflow to populate analytics</p>
            </div>
          )}
        </div>
      </Card>
      
    </div>
  );
}
