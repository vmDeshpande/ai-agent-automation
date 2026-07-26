import { Copy, Terminal, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { JsonViewer } from './JsonViewer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

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
  taskId?: string;
}

export function StepDetailsPane({ step, result, status, taskId }: StepDetailsPaneProps) {
  const [openInput, setOpenInput] = useState(true);
  const [openOutput, setOpenOutput] = useState(true);

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
      <div className="p-5 border-b border-border/50 shrink-0">
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

      <div className="flex-1 overflow-y-auto flex flex-col p-4 bg-muted/10 gap-3">
        {/* Input */}
        <Collapsible
          open={openInput}
          onOpenChange={setOpenInput}
          className="flex flex-col border border-border/50 rounded-md bg-card overflow-hidden shrink-0"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/50 group">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              {openInput ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              Input
            </CollapsibleTrigger>
            <Copy className="size-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
          </div>
          <CollapsibleContent>
            <div className="p-0 max-h-48 overflow-y-auto bg-[#1e1e1e]">
              <JsonViewer data={step} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Output */}
        <Collapsible
          open={openOutput}
          onOpenChange={setOpenOutput}
          className="flex flex-col border border-border/50 rounded-md bg-card overflow-hidden shrink-0"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/50 group">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              {openOutput ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              Output
            </CollapsibleTrigger>
            <Copy className="size-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
          </div>
          <CollapsibleContent>
            <div className="p-0 max-h-48 overflow-y-auto bg-[#1e1e1e]">
              <JsonViewer data={result?.output || null} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
