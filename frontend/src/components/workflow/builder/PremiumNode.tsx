import { Handle, Position } from 'reactflow';
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
  Settings,
  MoreVertical,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PremiumNodeData {
  label: string;
  type: string;
  onDelete?: () => void;
  selected?: boolean;
  hasError?: boolean;
}

function getIconForType(type?: string) {
  switch ((type || '').toLowerCase()) {
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
      return <Split className="size-4" />;
    case 'join':
      return <GitMerge className="size-4" />;
    case 'approval':
      return <CheckSquare className="size-4" />;
    case 'tool':
      return <PenTool className="size-4" />;
    default:
      return <Settings className="size-4" />;
  }
}

function getColorClassesForType(type?: string) {
  switch ((type || '').toLowerCase()) {
    case 'llm':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50';
    case 'http':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50';
    case 'delay':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50';
    case 'condition':
    case 'switch':
    case 'parallel':
    case 'join':
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50';
    case 'mcp':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/50';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
}

export function PremiumNode({ data, selected }: { data: PremiumNodeData; selected: boolean }) {
  const colorClass = getColorClassesForType(data.type);

  return (
    <div
      className={cn(
        'relative group min-w-[260px] max-w-[260px] rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200',
        selected
          ? 'ring-2 ring-primary border-primary shadow-md scale-[1.02]'
          : 'hover:border-primary/50 hover:shadow-md',
        data.hasError && 'border-destructive ring-1 ring-destructive hover:border-destructive'
      )}
    >
      {/* Target Handle (Top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-4 h-4 bg-background border-2 border-primary -top-2 rounded-full transition-transform hover:scale-125 hover:bg-primary"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/20 rounded-t-xl">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div
            className={cn('flex items-center justify-center size-7 rounded-md border', colorClass)}
          >
            {getIconForType(data.type)}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
              {data.type}
            </span>
            <span className="text-sm font-medium truncate leading-tight">{data.label}</span>
          </div>
        </div>

        {/* Actions (Delete) */}
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1"
          onClick={(e) => {
            e.stopPropagation();
            if (data.onDelete) {
              data.onDelete();
            } else {
              const nodeId = (data as any).id; // wait, data doesn't have id, the node does. We can just use the CustomEvent with id if we pass it, but better to just pass id to data.
              const deleteEvent = new CustomEvent('delete-workflow-node', {
                detail: { nodeId: (data as any).id },
              });
              window.dispatchEvent(deleteEvent);
            }
          }}
        >
          <X className="size-3" />
        </Button>
      </div>

      {/* Node Body (Optional configuration summary could go here) */}
      {/* <div className="p-3 text-xs text-muted-foreground border-b border-border/50">
        Config summary...
      </div> */}

      {/* Source Handle (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-4 h-4 bg-background border-2 border-primary -bottom-2 rounded-full transition-transform hover:scale-125 hover:bg-primary"
      />
    </div>
  );
}
