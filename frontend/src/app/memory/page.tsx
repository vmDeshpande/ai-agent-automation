'use client';

import { useEffect, useRef, useState } from 'react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { apiUrl } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Brain,
  Search,
  Trash2,
  Bot,
  User,
  Database,
  SearchX,
  Workflow,
  Cpu,
  Calendar,
  Layers,
} from 'lucide-react';

type Memory = {
  _id: string;
  content: string;
  agentId?: { name?: string };
  metadata?: {
    taskId?: string;
    workflowId?: string;
    type?: string;
  };
  embeddingProvider?: string;
  embeddingModel?: string;
  embedding?: number[];
  createdAt: string;
};

// Visual Sparkline for Embeddings
function EmbeddingSparkline({ embedding }: { embedding?: number[] }) {
  if (!embedding || embedding.length === 0) return null;

  // Use first 48 dimensions for the visualization
  const sample = embedding.slice(0, 48);
  const max = Math.max(...sample.map(Math.abs), 0.001); // avoid div by 0

  return (
    <div className="flex items-end gap-[2px] h-12 w-full mt-3 overflow-hidden rounded-md bg-muted/20 p-2 border border-border/30">
      {sample.map((val, i) => {
        const heightPct = (Math.abs(val) / max) * 100;
        return (
          <div
            key={i}
            className="w-full flex-1 bg-primary/70 rounded-[1px] hover:bg-primary transition-colors"
            style={{ height: `${Math.max(5, heightPct)}%` }}
            title={`Dim ${i}: ${val.toFixed(4)}`}
          />
        );
      })}
    </div>
  );
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null);

  async function fetchMemories() {
    try {
      const url = apiUrl('/memory?search=') + encodeURIComponent(search);
      const res = await fetch(url, {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();
      if (data.ok) setMemories(data.memories);
    } catch (error) {
      console.warn('Failed to fetch memories:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchMemories();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (inspectorScrollRef.current) {
      inspectorScrollRef.current.scrollTop = 0;
    }
  }, [selectedMemory]);

  async function deleteMemory(id: string) {
    await fetch(apiUrl(`/memory/${id}`), {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
    });

    setMemories((prev) => prev.filter((m) => m._id !== id));
  }

  function parseMemory(content: string) {
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto pb-12">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                <Brain className="size-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Memory Explorer</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Inspect the persistent semantic memory layer captured across your multi-agent
              workflows.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-10 relative max-w-2xl group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="size-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
          </div>
          <Input
            placeholder="Search semantic memory..."
            className="pl-12 h-14 bg-background border-border/60 text-base shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 rounded-2xl transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Memory Feed List */}
        <div className="space-y-4 max-w-4xl">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/40 bg-card p-6 flex flex-col gap-4"
              >
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            ))}

          {!loading && memories.length === 0 && (
            <div className="py-16 rounded-2xl border border-dashed border-border/50 bg-background/20">
              {search ? (
                <EmptyState
                  className="border-none bg-transparent"
                  icon={SearchX}
                  title="No memories found"
                  description={`Your filter for "${search}" returned no semantic matches.`}
                  primaryAction={
                    <Button size="sm" variant="outline" onClick={() => setSearch('')}>
                      Clear Search
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  className="border-none bg-transparent"
                  icon={Database}
                  title="Database empty"
                  description="Semantic memories will appear here once agents begin execution."
                />
              )}
            </div>
          )}

          {!loading &&
            memories.map((m) => {
              const parsed = parseMemory(m.content);

              return (
                <div
                  key={m._id}
                  onClick={() => {
                    setSelectedMemory(m);
                    setInspectorOpen(true);
                  }}
                  className="group relative flex flex-col rounded-2xl border border-border/50 bg-card hover:bg-muted/10 hover:border-border/80 transition-all cursor-pointer shadow-sm hover:shadow-md overflow-hidden"
                >
                  {/* Visual Header */}
                  <div className="px-5 py-3 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="size-4 text-primary/70" />
                      <span className="font-semibold text-xs uppercase tracking-widest text-foreground/80">
                        Semantic Memory
                      </span>
                    </div>
                    {m.embedding?.length && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono bg-background border-border/60 text-muted-foreground"
                      >
                        [{m.embedding.length}D VECTOR]
                      </Badge>
                    )}
                  </div>

                  <div className="p-5 flex-1 space-y-4">
                    {/* Content Preview */}
                    <div className="space-y-3">
                      {parsed.user && (
                        <div className="flex gap-3">
                          <User className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                          <p className="text-sm text-foreground/90 line-clamp-2 leading-relaxed font-sans">
                            {parsed.user}
                          </p>
                        </div>
                      )}

                      {parsed.assistant && (
                        <div className="flex gap-3">
                          <Bot className="size-4 mt-0.5 text-primary/70 shrink-0" />
                          <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed font-sans">
                            {parsed.assistant}
                          </p>
                        </div>
                      )}

                      {parsed.raw && (
                        <div className="flex gap-3">
                          <Database className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                          <p className="text-sm text-foreground/80 line-clamp-3 leading-relaxed font-mono bg-muted/30 p-2 rounded-lg border border-border/30 w-full">
                            {parsed.raw}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Metadata Row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-border/40 text-[11px] font-mono text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="size-3 opacity-70" />
                        <span className="truncate max-w-[120px]">
                          {m.agentId?.name || 'unknown_agent'}
                        </span>
                      </div>

                      {m.metadata?.workflowId && (
                        <div className="flex items-center gap-1.5">
                          <Workflow className="size-3 opacity-70" />
                          <span className="truncate max-w-[100px]" title={m.metadata.workflowId}>
                            WKF_{m.metadata.workflowId.substring(0, 6)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 ml-auto">
                        <Calendar className="size-3 opacity-70" />
                        {new Date(m.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Hover Delete Action */}
                  <div className="absolute right-4 top-14 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMemory(m._id);
                      }}
                      className="size-8 text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-sm rounded-full"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Database-style Inspector Sheet */}
        <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
          <SheetContent className="w-[min(640px,100vw)] p-0 h-screen flex flex-col bg-background border-l-border/50 shadow-2xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Memory Inspector</SheetTitle>
              <SheetDescription>Database record inspector</SheetDescription>
            </SheetHeader>

            {selectedMemory && (
              <>
                {/* HEADER */}
                <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between shrink-0 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Database className="size-4 text-primary" />
                    <h2 className="font-semibold tracking-tight text-sm">Memory Inspector</h2>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    ID: {selectedMemory._id.substring(0, 8)}...
                  </Badge>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div ref={inspectorScrollRef} className="flex-1 overflow-y-auto">
                  {/* METADATA SECTION */}
                  <div className="px-6 py-6 border-b border-border/50 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                      Metadata
                    </h3>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                          Agent
                        </p>
                        <div className="flex items-center gap-1.5 font-mono text-xs bg-background border border-border/50 px-2 py-1 rounded w-fit">
                          <Bot className="size-3 text-primary" />
                          {selectedMemory.agentId?.name || 'Unknown'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                          Type
                        </p>
                        <p className="font-mono text-xs">
                          {selectedMemory.metadata?.type || 'conversation'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                          Workflow Link
                        </p>
                        <p className="font-mono text-xs text-foreground/80 break-all bg-muted/30 px-1 rounded">
                          {selectedMemory.metadata?.workflowId || 'N/A'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                          Task Link
                        </p>
                        <p className="font-mono text-xs text-foreground/80 break-all bg-muted/30 px-1 rounded">
                          {selectedMemory.metadata?.taskId || 'N/A'}
                        </p>
                      </div>
                      <div className="col-span-2 space-y-1 pt-2 border-t border-border/30">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                          Created Timestamp
                        </p>
                        <p className="font-mono text-xs">
                          {new Date(selectedMemory.createdAt).toISOString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* VECTOR SECTION */}
                  {selectedMemory.embedding && (
                    <div className="px-6 py-6 border-b border-border/50 bg-background">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                        <Layers className="size-3" />
                        Vector Data
                      </h3>

                      <div className="flex items-end justify-between mb-2">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                            Provider / Model
                          </p>
                          <p className="font-mono text-xs">
                            <span className="text-foreground/60">
                              {selectedMemory.embeddingProvider || 'N/A'}
                            </span>
                            {' / '}
                            <span className="text-foreground/90">
                              {selectedMemory.embeddingModel || 'N/A'}
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-mono font-bold text-foreground">
                            {selectedMemory.embedding.length}
                          </p>
                          <p className="text-[10px] uppercase text-muted-foreground">Dimensions</p>
                        </div>
                      </div>

                      <EmbeddingSparkline embedding={selectedMemory.embedding} />
                    </div>
                  )}

                  {/* CONTENT SECTION */}
                  <div className="px-6 py-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                      Payload
                    </h3>

                    <Tabs defaultValue="structured" className="w-full">
                      <TabsList className="w-full bg-muted/30 p-1 rounded-lg h-9">
                        <TabsTrigger
                          value="structured"
                          className="rounded-md text-[11px] font-medium uppercase tracking-wider w-1/2"
                        >
                          Structured
                        </TabsTrigger>
                        <TabsTrigger
                          value="raw"
                          className="rounded-md text-[11px] font-medium uppercase tracking-wider w-1/2"
                        >
                          Raw JSON
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="structured" className="mt-4">
                        {(() => {
                          try {
                            const parsed = JSON.parse(selectedMemory.content);
                            return (
                              <div className="space-y-4">
                                {parsed.user && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                                      User
                                    </span>
                                    <div className="bg-muted/40 border border-border/40 text-sm rounded-lg px-4 py-3 font-sans text-foreground/90">
                                      {parsed.user}
                                    </div>
                                  </div>
                                )}

                                {parsed.assistant && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-primary/70 tracking-widest">
                                      Assistant
                                    </span>
                                    <div className="bg-primary/5 border border-primary/10 text-sm rounded-lg px-4 py-3 font-sans text-foreground">
                                      {parsed.assistant}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          } catch {
                            return (
                              <div className="bg-background border border-border/50 rounded-lg p-4 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                                {selectedMemory.content}
                              </div>
                            );
                          }
                        })()}
                      </TabsContent>

                      <TabsContent value="raw" className="mt-4">
                        <div className="rounded-lg border border-border/50 bg-background p-4 overflow-x-auto">
                          <pre className="text-[11px] font-mono text-muted-foreground/90">
                            {JSON.stringify(selectedMemory, null, 2)}
                          </pre>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="border-t border-border/50 p-4 bg-muted/10 shrink-0">
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border border-transparent hover:border-destructive/20 transition-all text-xs uppercase tracking-wider"
                    onClick={async () => {
                      await deleteMemory(selectedMemory._id);
                      setInspectorOpen(false);
                    }}
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete Record
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AuthenticatedLayout>
  );
}
