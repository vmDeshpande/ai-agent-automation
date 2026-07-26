import type { NodeDefinition } from '@/types/workflow';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import {
  MessageSquare,
  Globe,
  Clock,
  Blocks,
  FileText,
  GitBranch,
  Split,
  GitMerge,
  CheckSquare,
  PenTool,
} from 'lucide-react';

interface BuilderToolbarProps {
  nodeDefinitions: NodeDefinition[];
  onAddNode: (type: string, def?: NodeDefinition) => void;
  onQuickAdd?: () => void;
}

function getIconForType(type: string) {
  switch (type.toLowerCase()) {
    case 'llm':
      return <MessageSquare className="size-4" />;
    case 'http':
      return <Globe className="size-4" />;
    case 'delay':
      return <Clock className="size-4" />;
    case 'mcp':
      return <Blocks className="size-4" />;
    case 'document_query':
    case 'document':
      return <FileText className="size-4" />;
    case 'condition':
      return <GitBranch className="size-4" />;
    case 'switch':
      return <Split className="size-4" />;
    case 'parallel':
      return <Split className="size-4" />; // Or a better icon
    case 'join':
      return <GitMerge className="size-4" />;
    case 'approval':
      return <CheckSquare className="size-4" />;
    case 'tool':
      return <PenTool className="size-4" />;
    default:
      return <Blocks className="size-4" />;
  }
}

export function BuilderToolbar({ nodeDefinitions, onAddNode, onQuickAdd }: BuilderToolbarProps) {
  if (!nodeDefinitions || nodeDefinitions.length === 0) {
    return null;
  }

  return (
    <Card className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2 p-2 shadow-xl border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center mb-1">
        Nodes
      </div>
      <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto no-scrollbar pb-1">
        {nodeDefinitions.map((def) => (
          <Tooltip key={def.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start rounded-xl hover:bg-primary/10 hover:text-primary transition-colors px-3 py-2 h-10"
                onClick={(e) => {
                  console.log('Toolbar clicked! def.id:', def.id);
                  e.preventDefault();
                  e.stopPropagation();
                  onAddNode(def.id, def);
                }}
              >
                {getIconForType(def.id)}
                <span className="ml-2 font-medium truncate">{def.name}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Add {def.name}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {onQuickAdd && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-center rounded-xl text-xs font-semibold mt-1 gap-1.5"
              onClick={onQuickAdd}
            >
              <span>⌘K</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Quick Add (⌘K)
          </TooltipContent>
        </Tooltip>
      )}
    </Card>
  );
}
