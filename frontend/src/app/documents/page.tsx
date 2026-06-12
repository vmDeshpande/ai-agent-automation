"use client";

import { useEffect, useState, useRef } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import Link from "next/link";
import { useAssistantContext } from "@/context/assistant-context";
import {
  Upload,
  Trash2,
  FileText,
  FileCode,
  File,
  Search,
  SearchX
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
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { setContext, clearContext } = useAssistantContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { addToast } = useToast();

  async function fetchDocuments() {
    try {
      setLoading(true);
      const res = await fetch(apiUrl("/documents"), {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });
      
      const data = await res.json();
      if (data.ok) {
        setDocuments(data.documents || []);
      }
      } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
}
  useEffect(() => {
    fetchDocuments();
  }, []);

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
  }, [documents]);

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
        fetchDocuments();
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
            {/* Header */}
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

              {/* Search */}
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

            {/* Empty state conditional */}
            {filteredDocs.length === 0 && (
              <div className="py-4 w-full">
                {documents.length > 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchX />
                      </EmptyMedia>
                      <EmptyTitle>No results found</EmptyTitle>
                      <EmptyDescription>
                        We couldn&apos;t find any matches for &quot;{search}&quot;. Check your spelling or try another keyword.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button variant="outline" size="sm" onClick={() => setSearch("")}>
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
                        Upload text, PDFs, or markdown knowledge elements to enrich your automation environment vectors.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                        <Upload className="size-4" />
                        Upload Document
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}
              </div>
            )}

            {/* Document Grid */}
           {loading ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-5">
                  <div className="space-y-4">
                   <Skeleton className="h-10 w-10" />
                   <Skeleton className="h-5 w-3/4" />
                   <Skeleton className="h-4 w-full" />
                   <Skeleton className="h-4 w-2/3" />
                   <Skeleton className="h-8 w-24" />
                  </div>
                </Card>
             ))}
           </div>
        ) : filteredDocs.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredDocs.map((doc) => ( (
              <Link key={doc._id} href={`/documents/${doc._id}`}>

                    <Card className="p-5 flex flex-col justify-between cursor-pointer transition-all hover:border-primary hover:shadow-lg hover:-translate-y-0.5">
                      {/* Top */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-md bg-muted">
                          {getFileIcon(doc.fileType)}
                        </div>

                        <div className="flex-1">
                          <p className="font-semibold truncate">
                            {doc.title || "Untitled"}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {doc.fileType}
                            </Badge>

                            <Badge variant="outline" className="text-xs font-mono">
                              {doc.chunkCount} chunks
                            </Badge>

                            {doc.size && (
                              <Badge variant="outline" className="text-xs">
                                {formatSize(doc.size)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom */}
                      <div className="flex justify-between items-center mt-6">
                        <span className="text-xs text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
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
                  </Link>
                )))}

              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
