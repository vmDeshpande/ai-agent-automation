import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardStatSkeleton() {
  return (
    <Card className="p-6">
      <Skeleton className="h-10 w-10 rounded-lg" />

      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}