import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle, XCircle, ShieldCheck, Copy, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JsonViewer } from './JsonViewer';
import { Button } from '@/components/ui/button';

interface StepResult {
  stepId: string;
  type: string;
  success?: boolean;
  requiresApproval?: boolean;
  output?: unknown;
  timestamp?: string;
}

interface StepMetadata {
  name: string;
  stepId: string;
  type: string;
  [key: string]: any;
}

interface StepDetailsPaneProps {
  step: StepMetadata | null;
  result: StepResult | null;
  status: string;
}

export function StepDetailsPane({ step, result, status }: StepDetailsPaneProps) {
  if (!step) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-card border border-border shadow-sm rounded-xl p-8 text-center">
        <Terminal className="size-8 mb-4 opacity-20" />
        <h3 className="font-medium text-foreground mb-1">No Step Selected</h3>
        <p className="text-sm">Select a step from the timeline to view its execution details.</p>
      </div>
    );
  }

  const getStepStatus = () => {
    if (!result) return 'pending';
    if (result.success === false) return 'failed';
    if (result.requiresApproval && status === 'pending_approval') return 'paused';
    if (result.success === true) return 'completed';
    return status === 'running' ? 'running' : 'pending';
  };

  const stepStatus = getStepStatus();

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{step.name || step.type}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs bg-muted/20">
                {step.type}
              </Badge>
              {stepStatus === 'completed' && (
                <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
                  Success
                </Badge>
              )}
              {stepStatus === 'failed' && (
                <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
                  Failed
                </Badge>
              )}
              {stepStatus === 'running' && (
                <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">
                  Running
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground font-mono">
            <div>Started: -</div>
            <div>
              Ended: {result?.timestamp ? new Date(result.timestamp).toLocaleTimeString() : '-'}
            </div>
            <div>Duration: -</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mt-6">
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Agent</div>
            <div className="font-medium">-</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
              Tokens Used
            </div>
            <div className="font-medium">-</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-4 bg-muted/10">
        <Tabs defaultValue="output" className="w-full flex-1 flex flex-col">
          <TabsList className="w-full justify-start bg-transparent border-b rounded-none p-0 h-auto">
            <TabsTrigger
              value="input"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              Input
            </TabsTrigger>
            <TabsTrigger
              value="output"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              Output
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="input"
            className="flex-1 mt-4 overflow-hidden rounded-md border border-border/50"
          >
            <JsonViewer data={step} />
          </TabsContent>

          <TabsContent
            value="output"
            className="flex-1 mt-4 overflow-hidden rounded-md border border-border/50"
          >
            <JsonViewer data={result?.output || null} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
