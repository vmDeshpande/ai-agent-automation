"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { useRouter } from "next/navigation";
import { useAssistantContext } from "@/context/assistant-context";
import {
  Upload,
  Trash2,
  FileText,
  FileCode,
  File,
  Search,
  SearchX,
  MessageSquare,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";

type Document = {
  _id: string;
  title: string;
  fileType: string;
  chunkCount: number;
  size?: number;
  createdAt: string;
  status?: string;
  processingStep?: string;
  processedChunks?: number;
  totalChunks?: number;
  processingStartedAt?: string;
  processedAt?: string;
  processingError?: string;
};

function getDocumentProgress(document: Document) {
  if (document.status === "ready") return 100;

  if (document.status === "processing") {
    const processedChunks = document.processedChunks || 0;
    const totalChunks = document.totalChunks || 0;

    if (totalChunks > 0) {
      return Math.min(99, Math.round((processedChunks / totalChunks) * 100));
    }

    return 10;
  }

  if (document.status === "failed") {
    const processedChunks = document.processedChunks || 0;
    const totalChunks = document.totalChunks || 0;

    if (totalChunks > 0) {
      return Math.round((processedChunks / totalChunks) * 100);
    }
  }

  return 0;
}

function getProcessingLabel(document: Document) {
  if (document.status === "failed") return "Failed";

  const step = document.processingStep || "Processing";
  const processedChunks = document.processedChunks || 0;
  const totalChunks = document.totalChunks || 0;

  if (document.status === "processing" && totalChunks > 0) {
    return `${step} · ${processedChunks}/${totalChunks}`;
  }

  return document.status === "processing" ? "Processing..." : step;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  const router = useRouter();
  const { setContext, clearContext } = useAssistantContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { addToast } = useToast();

  const fetchDocuments = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setDocumentsLoading(true);
      }

      setDocumentsError("");

      const res = await fetch(apiUrl("/documents"), {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not load documents.");
      }

      setDocuments(data.documents || []);
    } catch {
      setDocumentsError(
        "Could not load documents. Make sure the backend server is running."
      );
    } finally {
      if (showLoader) {
        setDocumentsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const hasProcessingDocuments = documents.some(
      (document) => document.status === "processing"
    );

    if (!hasProcessingDocuments) return;

    const intervalId = window.setInterval(() => {
      fetchDocuments(false);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [documents, fetchDocuments]);

  useEffect(() => {
    setContext({
      page: "documents",
      documentCount: documents.length,
      documents: documents.map((d) => ({
        id: d._id,
        title: d.title,
        chunkCount: d.chunkCount,
        fileType: d.fileType,
      })),
    });

    return () => clearContext();
  }, [clearContext, documents, setContext]);

  async function uploadFile(file: File) {
    try {
      setUploading(true);

      const form = new FormData();
      form.append("file", file);

      const res = await fetch(apiUrl("/documents/upload"), {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: form,
      });

      const data = await res.json();

      if (data.ok) {
        addToast({
          type: "success",
          title: "Document uploaded",
        });

        fetchDocuments(false);
      }
    } catch {
      addToast({
        type: "error",
        title: "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id: string) {
    try {
      await fetch(apiUrl(`/documents/${id}`), {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      setDocuments((prev) => prev.filter((d) => d._id !== id));
      setSelectedDocumentIds((prev) =>
        prev.filter((selectedId) => selectedId !== id)
      );

      addToast({
        type: "success",
        title: "Document deleted",
      });
    } catch {
      addToast({
        type: "error",
        title: "Failed to delete",
      });
    }
  }

  function toggleDocumentSelection(id: string) {
    setSelectedDocumentIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((selectedId) => selectedId !== id);
      }

      return [...prev, id];
    });
  }

  function chatWithSelectedDocuments() {
    if (!selectedDocumentIds.length) return;

    router.push(`/documents/chat?ids=${selectedDocumentIds.join(",")}`);
  }

  function openDocument(id: string) {
    router.push(`/documents/${id}`);
  }

  function getFileIcon(type: string) {
    if (type === "pdf") return <FileText className="size-5 text-red-500" />;
    if (type === "md") return <FileCode className="size-5 text-blue-500" />;
    return <File className="size-5 text-muted-foreground" />;
  }

  function formatSize(bytes?: number) {
    if (!bytes) return null;

    const kb = bytes / 1024;

    if (kb < 1024) return `${kb.toFixed(1)} KB`;

    return `${(kb / 1024).toFixed(1)} MB`;
  }

  const filteredDocs = documents.filter((d) =>
    d.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />

        <main
          className="flex-1 transition-[padding] duration-300"
          style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
        >
          <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Documents</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Knowledge base used by AI workflows
                  </p>
                </div>

                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.json,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile(file);
                    }}
                  />

                  <Button
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="size-4" />
                    {uploading ? "Uploading..." : "Upload Document"}
                  </Button>
                </>
              </div>

              <div className="relative max-w-md">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {documentsLoading && (
              <div className="py-12 text-sm text-muted-foreground">
                Loading documents...
              </div>
            )}

            {documentsError && !documentsLoading && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">
                  {documentsError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDocuments()}
                  className="mt-3"
                >
                  Retry
                </Button>
              </div>
            )}

            {!documentsLoading && !documentsError && filteredDocs.length === 0 && (
              <div className="py-4 w-full">
                {documents.length > 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchX />
                      </EmptyMedia>
                      <EmptyTitle>No results found</EmptyTitle>
                      <EmptyDescription>
                        We couldn&apos;t find any matches for &quot;{search}
                        &quot;. Check your spelling or try another keyword.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearch("")}
                      >
                        Clear search filter
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileText />
                      </EmptyMedia>
                      <EmptyTitle>No documents uploaded</EmptyTitle>
                      <EmptyDescription>
                        Upload text, PDFs, or markdown knowledge elements to
                        enrich your automation environment vectors.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <Upload className="size-4" />
                        Upload Document
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}
              </div>
            )}

            {!documentsLoading && !documentsError && filteredDocs.length > 0 && (
              <div className="space-y-5">
                {selectedDocumentIds.length > 0 && (
                  <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Selected: {selectedDocumentIds.length}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Choose documents to chat with together
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        disabled={!selectedDocumentIds.length}
                        onClick={chatWithSelectedDocuments}
                        className="gap-2"
                      >
                        <MessageSquare className="size-4" />
                        Chat with Selected
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setSelectedDocumentIds([])}
                        className="gap-2"
                      >
                        <X className="size-4" />
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {filteredDocs.map((doc) => {
                    const isSelected = selectedDocumentIds.includes(doc._id);
                    const isProcessing = doc.status === "processing";
                    const isFailed = doc.status === "failed";
                    const progress = getDocumentProgress(doc);

                    return (
                      <Card
                        key={doc._id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${doc.title || "Untitled"}`}
                        onClick={() => openDocument(doc._id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDocument(doc._id);
                          }
                        }}
                        className={`p-5 flex flex-col justify-between cursor-pointer transition-all hover:border-primary hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/30"
                            : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-muted">
                            {getFileIcon(doc.fileType)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-3">
                              <p className="min-w-0 flex-1 truncate font-semibold">
                                {doc.title || "Untitled"}
                              </p>

                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                {isSelected && (
                                  <Badge
                                    variant="secondary"
                                    className="hidden text-xs sm:inline-flex"
                                  >
                                    Selected
                                  </Badge>
                                )}

                                <Checkbox
                                  checked={isSelected}
                                  aria-label={`Select ${doc.title || "Untitled"}`}
                                  onCheckedChange={() =>
                                    toggleDocumentSelection(doc._id)
                                  }
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {doc.status && (
                                <Badge
                                  variant={
                                    isFailed ? "destructive" : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {isFailed ? "Failed" : doc.status}
                                </Badge>
                              )}

                              <Badge variant="secondary" className="text-xs">
                                {doc.fileType}
                              </Badge>

                              <Badge
                                variant="outline"
                                className="text-xs font-mono"
                              >
                                {doc.chunkCount} chunks
                              </Badge>

                              {doc.size && (
                                <Badge variant="outline" className="text-xs">
                                  {formatSize(doc.size)}
                                </Badge>
                              )}
                            </div>

                            {(isProcessing || isFailed) && (
                              <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span
                                    className={
                                      isFailed
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {getProcessingLabel(doc)}
                                  </span>

                                  {!isFailed && (
                                    <span className="font-mono text-muted-foreground">
                                      {progress}%
                                    </span>
                                  )}
                                </div>

                                <Progress
                                  value={progress}
                                  className={`h-1.5 ${
                                    isFailed ? "[&>div]:bg-destructive" : ""
                                  }`}
                                />

                                {isFailed && doc.processingError && (
                                  <p className="line-clamp-2 text-xs text-muted-foreground">
                                    {doc.processingError}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-6">
                          <span className="text-xs text-muted-foreground">
                            {doc.createdAt.slice(0, 10)}
                          </span>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteDoc(doc._id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}