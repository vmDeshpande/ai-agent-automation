import { Card } from '@/components/ui/card';
import { Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Variable {
  name: string;
  value: string;
  isSecret?: boolean;
}

interface VariablesCardProps {
  variables?: Variable[];
}

export function VariablesCard({ variables = [] }: VariablesCardProps) {
  return (
    <Card className="p-0 bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col">
      <div className="p-5 flex items-center justify-between border-b border-border/50">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Variables
        </h3>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
        >
          Manage
        </Button>
      </div>

      <div className="p-4 flex flex-col gap-3 max-h-[300px] overflow-y-auto">
        {variables.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No variables configured
          </div>
        ) : (
          variables.map((v, i) => (
            <div key={i} className="rounded-lg border border-border/50 p-3 bg-muted/10 relative">
              <div className="text-xs font-mono font-semibold mb-1">{v.name}</div>
              {v.isSecret ? (
                <div className="text-xs text-muted-foreground">Encrypted Secret</div>
              ) : (
                <div className="text-xs text-muted-foreground font-mono">{v.value}</div>
              )}
              {v.isSecret && (
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              )}
            </div>
          ))
        )}

        <Button variant="outline" size="sm" className="mt-2 w-full border-dashed">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Variable
        </Button>
      </div>
    </Card>
  );
}
