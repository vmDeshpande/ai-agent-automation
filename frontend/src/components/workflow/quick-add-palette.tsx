'use client';

import * as React from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import type { NodeDefinition } from '@/types/workflow';

export function QuickAddPalette({
  open,
  onOpenChange,
  nodeDefinitions = [],
  onSelectNode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeDefinitions: NodeDefinition[];
  onSelectNode: (nodeType: string) => void;
}) {
  return (
    <CommandDialog
      title="Add Node Type"
      description="Search workflow nodes to add to canvas"
      open={open}
      onOpenChange={onOpenChange}
    >
      <CommandInput placeholder="Search node type..." />
      <CommandList>
        <CommandEmpty>No matching node types found.</CommandEmpty>
        <CommandGroup heading="Workflow Nodes">
          {nodeDefinitions.map((def) => (
            <CommandItem
              key={def.id}
              value={def.name || def.id}
              onSelect={() => {
                onSelectNode(def.id);
                onOpenChange(false);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span>{def.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
                  {def.category || 'Logic'}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
