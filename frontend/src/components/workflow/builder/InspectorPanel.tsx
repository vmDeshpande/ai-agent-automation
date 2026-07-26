import type { NodeDefinition, WorkflowNode } from '@/types/workflow';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FieldRenderer } from '@/components/workflow/field-renderer';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InspectorPanelProps {
  selectedNodeId: string | null;
  steps: WorkflowNode[];
  nodeDefinitions: NodeDefinition[];
  onUpdateStep: (stepId: string, patch: Partial<WorkflowNode>) => void;
  onClose: () => void;
}

export function InspectorPanel({
  selectedNodeId,
  steps,
  nodeDefinitions,
  onUpdateStep,
  onClose,
}: InspectorPanelProps) {
  if (!selectedNodeId) return null;

  const step = steps.find((s) => s.id === selectedNodeId);
  if (!step) return null;

  const def = nodeDefinitions.find((d) => d.id === step.type);

  return (
    <Card className="absolute right-4 top-4 bottom-4 w-80 z-10 flex flex-col shadow-xl border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-sm">Node Configuration</h3>
          <p className="text-xs text-muted-foreground">{step.type}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
            Step Name
          </Label>
          <Input
            value={step.name || ''}
            onChange={(e) => onUpdateStep(step.id, { name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="e.g. Extract Data"
            className="h-8 text-sm"
          />
        </div>

        {def && def.fields.length > 0 && (
          <div className="space-y-4 pt-2 border-t">
            {def.fields.map((field) => (
              <div key={field.name}>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block flex justify-between">
                  {field.label || field.name}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                <div className="inspector-field-wrapper">
                  <FieldRenderer
                    field={field}
                    value={step.config?.[field.name] ?? (step as any)[field.name]}
                    onChange={(val) => {
                      onUpdateStep(step.id, {
                        config: { ...(step.config || {}), [field.name]: val },
                      });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {(!def || def.fields.length === 0) && (
          <div className="text-sm text-muted-foreground text-center py-8">
            No configuration needed for this node.
          </div>
        )}
      </div>
    </Card>
  );
}
