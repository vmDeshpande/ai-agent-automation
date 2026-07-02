import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 mb-8", className)} aria-hidden="true">
      <Skeleton className="h-9 w-64 rounded-md" />
      <Skeleton className="h-5 w-96 rounded-md" />
    </div>
  );
}

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("px-5 py-4 flex flex-col justify-center border-border/20 bg-card/10 shadow-sm rounded-xl min-h-[88px]", className)} aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded-md shrink-0" />
        <div className="flex items-center gap-2 w-full">
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <Skeleton className="h-3 w-28 mt-2 ml-8" />
    </Card>
  );
}

export function TableSkeleton({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/30 bg-card/20 overflow-hidden", className)} aria-hidden="true">
      <div className="flex items-center gap-4 border-b border-border/20 bg-muted/10 p-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border/20">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col w-full divide-y divide-border/20", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4 px-4 w-full">
          <Skeleton className="size-8 rounded-full shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("flex flex-col p-5 border-border/30 bg-card/20 shadow-sm rounded-xl", className)} aria-hidden="true">
      <Skeleton className="h-6 w-2/3 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-6" />
      <div className="mt-auto pt-4 flex gap-3 border-t border-border/20">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    </Card>
  );
}
