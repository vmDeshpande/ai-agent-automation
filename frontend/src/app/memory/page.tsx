"use client";

import { useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { apiUrl } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Brain,
  Search,
  Trash2,
  Clock,
  Bot,
  User,
  Info,
  Database,
  SearchX,
} from "lucide-react";

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

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null);

  async function fetchMemories() {
    const url = apiUrl("/memory?search=") + encodeURIComponent(search);
    const res = await fetch(url, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });
   
    const data = await res.json();
    if (data.ok) setMemories(data.memories);
    setLoading(false);
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
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
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
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />

        <main
          className="flex-1 transition-[padding] duration-300"
          style={{ paddingLeft: "var(--sidebar-width,256px)" }}
        >
          <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Brain className="size-6 text-primary" />
                  Agent Memory
                </h1>

                <p className="text-sm text-muted-foreground mt-1">
                  Persistent semantic memory stored by AI agents
                </p>
              </div>

              <Badge variant="secondary">{memories.length} memories</Badge>
            </div>

            {/* Search */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search memory content..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Memory Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="size-4" />
                  Memory Feed
                </CardTitle>
              </CardHeader>

              <Separator />

              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="p-6 space-y-6">
                    {loading && (
                      <>
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </>
                    )}

                    {!loading && memories.length === 0 && (
                      <div className="py-6">
                        {search ? (
                          <Empty className="border-none bg-transparent">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <SearchX />
                              </EmptyMedia>
                              <EmptyTitle>No memories found</EmptyTitle>
                              <EmptyDescription>
                                Your filter parameter for &quot;{search}&quot; returned no historical semantic matches.
                              </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                              <Button size="sm" variant="outline" onClick={() => setSearch("")}>
                                Reset Filter
                              </Button>
                            </EmptyContent>
                          </Empty>
                        ) : (
                          <Empty className="border-none bg-transparent">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Brain />
                              </EmptyMedia>
                              <EmptyTitle>No memories captured</EmptyTitle>
                              <EmptyDescription>
                                Agent memory instances will display here continuously once your multi-agent pipelines begin running.
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        )}
                      </div>
                    )}

                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="p-4">
                          <div className="space-y-4">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-2/3" />
                          </div>
                        </Card>
                     ))
                   ) : (
                      memories.map((m) => {
                      const parsed = parseMemory(m.content);

                      return (
                        <Card
                          key={m._id}
                          className="p-4 hover:border-primary transition cursor-pointer"
                          onClick={() => {
                            setSelectedMemory(m);
                            setInspectorOpen(true);
                          }}
                        >
                          <div className="flex justify-between items-start gap-6">
                            <div className="flex-1 space-y-4">
                              {/* User */}
                              {parsed.user && (
                                <div className="flex gap-3">
                                  <User className="size-4 mt-1 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">User</p>
                                    <p className="text-sm whitespace-pre-wrap">{parsed.user}</p>
                                  </div>
                                </div>
                              )}

                              {/* Assistant */}
                              {parsed.assistant && (
                                <div className="flex gap-3">
                                  <Bot className="size-4 mt-1 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Assistant</p>
                                    <p className="text-sm whitespace-pre-wrap">{parsed.assistant}</p>
                                  </div>
                                </div>
                              )}

                              {/* Raw fallback */}
                              {parsed.raw && (
                                <p className="text-sm whitespace-pre-wrap">{parsed.raw}</p>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-3 text-xs">
                                <Badge variant="secondary" className="gap-1">
                                  <Bot className="size-3" />
                                  {m.agentId?.name || "agent"}
                                </Badge>

                                <Badge variant="outline" className="gap-1">
                                  <Clock className="size-3" />
                                  {new Date(m.createdAt).toLocaleString()}
                                </Badge>
                              </div>
                            </div>

                            {/* Actions */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMemory(m._id);
                              }}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </Card>
                      );
                    }))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </main>

        <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
          <SheetContent className="w-[min(720px,90vw)] p-0 h-screen flex flex-col">
            <SheetHeader className="sr-only">
              <SheetTitle>Memory Inspector</SheetTitle>
              <SheetDescription>
                Inspect stored semantic memory and embeddings
              </SheetDescription>
            </SheetHeader>
            {selectedMemory && (
              <>
                {/* HEADER */}
                <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Brain className="size-5 text-primary" />
                    </div>

                    <div>
                      <p className="font-semibold">Memory Inspector</p>
                      <p className="text-xs text-muted-foreground">
                        Inspect stored semantic memory and embeddings
                      </p>
                    </div>
                  </div>

                  <Badge variant="secondary">
                    {selectedMemory.metadata?.type || "conversation"}
                  </Badge>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div
                  ref={inspectorScrollRef}
                  className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
                >
                  {/* MEMORY PREVIEW */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Bot className="size-4" />
                        Memory Conversation
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {(() => {
                        try {
                          const parsed = JSON.parse(selectedMemory.content);

                          return (
                            <>
                              {/* USER */}
                              <div className="flex gap-3 items-start">
                                <Avatar className="size-7 shrink-0">
                                  <AvatarFallback>U</AvatarFallback>
                                </Avatar>

                                <div className="bg-muted text-sm rounded-md px-3 py-2 break-words max-w-[85%]">
                                  {parsed.user}
                                </div>
                              </div>

                              {/* ASSISTANT */}
                              <div className="flex gap-3 items-start">
                                <Avatar className="size-7 shrink-0">
                                  <AvatarFallback>A</AvatarFallback>
                                </Avatar>

                                <div className="bg-primary/5 border text-sm rounded-md px-3 py-2 break-words max-w-[85%]">
                                  {parsed.assistant}
                                </div>
                              </div>
                            </>
                          );
                        } catch {
                          return (
                            <pre className="text-sm whitespace-pre-wrap break-words">
                              {selectedMemory.content}
                            </pre>
                          );
                        }
                      })()}
                    </CardContent>
                  </Card>

                  {/* METADATA */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Info className="size-4" />
                        Metadata
                      </CardTitle>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Agent</p>
                          <p className="font-medium">
                            {selectedMemory.agentId?.name || "Unknown"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Type</p>
                          <p className="font-medium">
                            {selectedMemory.metadata?.type || "conversation"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Workflow</p>
                          <p className="font-mono text-xs break-all">
                            {selectedMemory.metadata?.workflowId || "N/A"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Task</p>
                          <p className="font-mono text-xs break-all">
                            {selectedMemory.metadata?.taskId || "N/A"}
                          </p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Created</p>
                          <p>
                            {new Date(selectedMemory.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* EMBEDDING INFO */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Database className="size-4" />
                        Embedding Vector
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Provider</p>
                          <Badge variant="outline">
                            {selectedMemory.embeddingProvider || "unknown"}
                          </Badge>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Model</p>
                          <p className="font-mono text-xs">
                            {selectedMemory.embeddingModel || "unknown"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Vector Size</p>
                          <p className="font-semibold">
                            {selectedMemory.embedding?.length || 0}
                          </p>
                        </div>
                      </div>

                      <Progress
                        value={Math.min(
                          ((selectedMemory.embedding?.length || 0) / 4096) * 100,
                          100,
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* RAW DATA */}
                  <Tabs defaultValue="content">
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="content">Memory Content</TabsTrigger>
                      <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                    </TabsList>

                    <TabsContent value="content">
                      <Card>
                        <CardContent className="p-4">
                          <pre className="text-sm whitespace-pre-wrap break-words">
                            {selectedMemory.content}
                          </pre>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="raw">
                      <Card>
                        <CardContent className="p-4">
                          <pre className="text-xs overflow-auto break-words max-h-[260px]">
                            {JSON.stringify(selectedMemory, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* FOOTER */}
                <div className="border-t p-4 shrink-0">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={async () => {
                      await deleteMemory(selectedMemory._id);
                      setInspectorOpen(false);
                    }}
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete Memory
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AuthGuard>
  );
}
