import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

interface WorkflowMetadataCardProps {
  creatorName?: string;
  createdAt?: string | Date;
  triggerType?: string;
  environment?: string;
}

export function WorkflowMetadataCard({
  creatorName,
  createdAt,
  triggerType = 'Webhook',
  environment = 'Production',
}: WorkflowMetadataCardProps) {
  return (
    <Card className="p-5 flex flex-col gap-6 bg-card border-border shadow-sm rounded-xl">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Workflow Metadata
      </h3>

      <div className="flex flex-col gap-5">
        <div>
          <h4 className="text-xs text-muted-foreground mb-1.5">Created By</h4>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-primary">
                {creatorName ? creatorName.charAt(0).toUpperCase() : '?'}
              </span>
            </div>
            <span className="text-sm font-medium">{creatorName || '-'}</span>
          </div>
        </div>

        <div>
          <h4 className="text-xs text-muted-foreground mb-1.5">Date Created</h4>
          <span className="text-sm font-medium">
            {createdAt ? format(new Date(createdAt), 'MMMM d, yyyy') : '-'}
          </span>
        </div>

        <div>
          <h4 className="text-xs text-muted-foreground mb-1.5">Trigger Type</h4>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{triggerType}</span>
          </div>
        </div>

        <div>
          <h4 className="text-xs text-muted-foreground mb-1.5">Environment</h4>
          <span className="text-sm font-medium">{environment}</span>
        </div>
      </div>
    </Card>
  );
}
