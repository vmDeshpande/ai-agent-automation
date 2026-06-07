"use client";

import { Card } from "@/components/ui/card";

export function WorkflowList({
  workflows,
  loading,
}: {
  workflows: any[];
  loading: boolean;
}) {
  if (loading) {
    return <p>Loading workflows...</p>;
  }

  if (!workflows || workflows.length === 0) {
    return <p>No workflows found.</p>;
  }

  return (
    <div className="space-y-3">
      {workflows.map((workflow) => (
        <Card key={workflow._id ?? workflow.id}>
          <div>{workflow.name ?? "Unnamed workflow"}</div>
        </Card>
      ))}
    </div>
  );
}