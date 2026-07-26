import { Handle, Position } from 'reactflow';
import { Bot, Network } from 'lucide-react';

export interface AgentTeamNodeData {
  id: string;
  label: string;
  role: string;
  systemPrompt?: string;
  allowedWorkflows: string[];
}

export function AgentNode({ data, selected }: { data: AgentTeamNodeData; selected: boolean }) {
  return (
    <div
      className={`relative min-w-[280px] bg-card border-2 rounded-xl shadow-sm transition-all ${
        selected ? 'border-indigo-500 shadow-md shadow-indigo-500/20' : 'border-border'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 border-2 border-background bg-indigo-500"
      />
      
      <div className="flex items-center gap-4 p-4 border-b border-border/50 bg-muted/30">
        <div className="flex items-center justify-center size-10 rounded-lg bg-indigo-500/10 text-indigo-500">
          <Bot className="size-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {data.role || 'Agent'}
          </span>
          <span className="text-base font-semibold text-foreground">
            {data.label}
          </span>
        </div>
      </div>

      <div className="p-3 bg-card rounded-b-xl flex items-center gap-2 text-xs text-muted-foreground">
        <Network className="size-3.5" />
        <span>A2A Communication</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 border-2 border-background bg-indigo-500"
      />
    </div>
  );
}