'use client';

import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import {
  History,
  Calendar,
  User,
  ArrowRight,
  RotateCcw,
  FileText,
  AlertTriangle,
  Play,
  HelpCircle,
  Cpu,
} from 'lucide-react';
import type { BackendStep, WorkflowEdge } from '@/types/workflow';

type VersionHistoryDialogProps = {
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRollbackSuccess: () => void;
};

type WorkflowSnapshot = {
  name: string;
  description?: string;
  agentId?: string | null;
  metadata?: {
    steps?: BackendStep[];
    edges?: WorkflowEdge[];
  };
};

type CreatorInfo = {
  name?: string;
  email?: string;
};

type WorkflowVersion = {
  _id: string;
  workflowId: string;
  versionNumber: number;
  workflowSnapshot: WorkflowSnapshot;
  note?: string;
  createdBy?: CreatorInfo | null;
  createdAt: string;
};

function normalizeStepType(type: string) {
  switch (type.toLowerCase()) {
    case 'llm':
      return 'LLM';
    case 'delay':
      return 'Delay';
    case 'http':
      return 'HTTP';
    case 'document_query':
      return 'Document';
    case 'email':
    case 'file':
    case 'browser':
      return 'Tool';
    default:
      return type.toUpperCase();
  }
}

function getStepDescription(step: BackendStep) {
  const type = (step.type || '').toLowerCase();

  if (step.prompt) return step.prompt.slice(0, 100);
  if (step.url && step.method) return `${step.method} ${step.url}`;
  if (step.seconds) return `Wait for ${step.seconds} seconds`;
  if (type === 'document_query')
    return step.query ? `Query: ${step.query.slice(0, 100)}` : 'Document Query';
  if (type === 'email') return `Email to: ${step.to || 'recipient'}`;
  if (type === 'file') return `File ${step.action || 'action'}: ${step.path || 'path'}`;
  if (type === 'browser') return `Browser ${step.action || 'action'} ${step.url || ''}`;

  return 'No summary configured';
}

export default function VersionHistoryDialog({
  workflowId,
  open,
  onOpenChange,
  onRollbackSuccess,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<WorkflowVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const { addToast } = useToast();

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl(`/workflows/${workflowId}/versions`), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load versions');
      }
      setVersions(data.versions || []);
      if (data.versions && data.versions.length > 0) {
        setSelectedVersion(data.versions[0]);
      } else {
        setSelectedVersion(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (open && workflowId) {
      fetchVersions();
      setShowConfirm(false);
    }
  }, [open, workflowId, fetchVersions]);

  async function handleRollback() {
    if (!selectedVersion) return;
    setRollbackLoading(true);
    try {
      const res = await fetch(apiUrl(`/workflows/${workflowId}/rollback/${selectedVersion._id}`), {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Rollback failed');
      }

      addToast({
        type: 'success',
        title: 'Workflow Rolled Back',
        description: `Successfully restored version v${selectedVersion.versionNumber}`,
      });

      onRollbackSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Rollback Failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setRollbackLoading(false);
      setShowConfirm(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden bg-background border border-border shadow-2xl rounded-xl">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <History className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Workflow Version History
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                View previous snapshots of this workflow pipeline and roll back to restore them
              </p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading version history...
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="size-10 text-destructive" />
            <p className="font-semibold text-destructive">Error Loading History</p>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchVersions}>
              Try Again
            </Button>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6">
            <History className="size-10 text-muted-foreground/50" />
            <p className="font-semibold text-muted-foreground">No Version History Available</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Make config changes to steps or properties to generate version snapshots
              automatically.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex divide-x divide-border min-h-0">
            {/* Left Column: Version List */}
            <div className="w-[40%] flex flex-col bg-muted/5">
              <div className="px-4 py-2 border-b border-border bg-muted/10">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Versions Available ({versions.length})
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {versions.map((version) => {
                    const isActive = selectedVersion?._id === version._id;
                    const dateFormatted = new Date(version.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    });

                    return (
                      <button
                        key={version._id}
                        onClick={() => {
                          setSelectedVersion(version);
                          setShowConfirm(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isActive
                            ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                            : 'border-transparent hover:bg-muted text-foreground/80 hover:text-foreground'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <Badge
                            variant="outline"
                            className={`font-mono text-xs ${
                              isActive
                                ? 'border-primary/40 bg-primary/20 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            v{version.versionNumber}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                            <Calendar className="size-3" />
                            {dateFormatted}
                          </span>
                        </div>
                        {version.note && (
                          <p className="text-sm mt-1.5 font-medium line-clamp-1 break-all">
                            {version.note}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <User className="size-3" />
                          <span>
                            {version.createdBy?.name || version.createdBy?.email || 'System User'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Right Column: Version Detail Snapshot */}
            <div className="w-[60%] flex flex-col bg-background">
              {selectedVersion ? (
                <div className="flex-1 flex flex-col min-h-0 relative">
                  {/* Summary */}
                  <div className="p-6 border-b border-border bg-muted/5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-foreground">
                        {selectedVersion.workflowSnapshot.name || 'Unnamed Workflow'}
                      </h3>
                      <Badge
                        variant="outline"
                        className="border-primary/20 bg-primary/5 text-primary font-mono font-semibold px-2 py-0.5"
                      >
                        v{selectedVersion.versionNumber} details
                      </Badge>
                    </div>
                    {selectedVersion.workflowSnapshot.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {selectedVersion.workflowSnapshot.description}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full border border-border">
                        <Calendar className="size-3 text-muted-foreground/80" />
                        <span>Created: {new Date(selectedVersion.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full border border-border">
                        <Cpu className="size-3 text-muted-foreground/80" />
                        <span>
                          Agent ID:{' '}
                          {selectedVersion.workflowSnapshot.agentId
                            ? selectedVersion.workflowSnapshot.agentId.slice(-6).toUpperCase()
                            : 'None Assigned'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Steps list */}
                  <ScrollArea className="flex-1 p-6">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                      Steps Pipeline (
                      {selectedVersion.workflowSnapshot.metadata?.steps?.length || 0})
                    </h4>

                    <div className="space-y-3">
                      {selectedVersion.workflowSnapshot.metadata?.steps &&
                      selectedVersion.workflowSnapshot.metadata.steps.length > 0 ? (
                        selectedVersion.workflowSnapshot.metadata.steps.map((step, index) => {
                          const stepsCount =
                            selectedVersion.workflowSnapshot.metadata?.steps?.length || 0;

                          return (
                            <div key={step.stepId || index}>
                              <div className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-card">
                                <div className="flex items-center justify-center size-6 rounded-full bg-muted text-xs font-mono font-bold text-muted-foreground select-none">
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-sm text-card-foreground">
                                      {step.name || 'Unnamed Step'}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-medium py-0 px-1.5 uppercase font-mono bg-muted/50"
                                    >
                                      {normalizeStepType(step.type)}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2 italic font-mono font-light break-all">
                                    {getStepDescription(step)}
                                  </p>
                                </div>
                              </div>
                              {index < stepsCount - 1 && (
                                <div className="flex justify-center my-1.5">
                                  <ArrowRight className="size-4 text-muted-foreground rotate-90" />
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground italic">
                          No steps defined in this snapshot
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Action Bar or Confirm Overlay */}
                  <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
                    {!showConfirm ? (
                      <Button
                        onClick={() => setShowConfirm(true)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5"
                      >
                        <RotateCcw className="size-4" />
                        Rollback to v{selectedVersion.versionNumber}
                      </Button>
                    ) : (
                      <div className="w-full flex flex-col gap-3 p-3 rounded-lg border border-warning/30 bg-warning/5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="size-5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <h5 className="font-semibold text-sm text-foreground">
                              Confirm Rollback
                            </h5>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Are you sure you want to revert the workflow pipeline to version{' '}
                              <strong>v{selectedVersion.versionNumber}</strong>? Your current layout
                              will be saved as a new version, so this operation remains fully
                              reversible.
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowConfirm(false)}
                            disabled={rollbackLoading}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={rollbackLoading}
                            onClick={handleRollback}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                          >
                            {rollbackLoading ? 'Restoring...' : 'Yes, Restore Version'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  Select a version to inspect details and roll back
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
