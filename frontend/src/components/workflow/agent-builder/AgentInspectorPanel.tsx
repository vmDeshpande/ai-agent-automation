import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Check } from 'lucide-react';
import type { AgentTeamNodeData } from './AgentNode';

export function AgentInspectorPanel({
  selectedNodeId,
  nodes,
  availableWorkflows,
  onUpdateNode,
  onClose,
}: {
  selectedNodeId: string | null;
  nodes: { id: string; data: AgentTeamNodeData }[];
  availableWorkflows: { _id: string; name: string }[];
  onUpdateNode: (nodeId: string, patch: Partial<AgentTeamNodeData>) => void;
  onClose: () => void;
}) {
  if (!selectedNodeId) return null;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return null;

  const data = selectedNode.data;

  const toggleWorkflow = (workflowId: string) => {
    const current = data.allowedWorkflows || [];
    const updated = current.includes(workflowId)
      ? current.filter((id) => id !== workflowId)
      : [...current, workflowId];
    onUpdateNode(selectedNodeId, { allowedWorkflows: updated });
  };

  return (
    <div className="absolute top-0 right-0 h-full w-[350px] bg-card border-l shadow-2xl flex flex-col z-20">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold">Agent Configuration</h3>
          <p className="text-xs text-muted-foreground">Specialized Node</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-md">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Agent Name</Label>
          <Input
            value={data.label}
            onChange={(e) => onUpdateNode(selectedNodeId, { label: e.target.value })}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Role</Label>
          <Input
            value={data.role}
            onChange={(e) => onUpdateNode(selectedNodeId, { role: e.target.value })}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase">System Prompt</Label>
          <Textarea
            value={data.systemPrompt || ''}
            onChange={(e) => onUpdateNode(selectedNodeId, { systemPrompt: e.target.value })}
            placeholder="Define instructions for this agent..."
            className="min-h-[120px] bg-background resize-y"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Allowed Workflows (Phase 4 Bridge)</Label>
          <div className="flex flex-col gap-2 mt-2">
            {availableWorkflows.map((wf) => {
              const isSelected = (data.allowedWorkflows || []).includes(wf._id);
              return (
                <button
                  key={wf._id}
                  onClick={() => toggleWorkflow(wf._id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-md border text-sm transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  <span className="font-medium truncate">{wf.name}</span>
                  {isSelected && <Check className="size-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}