'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { useRouter } from 'next/navigation';
import { useAssistantContext } from '@/context/assistant-context';
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
  Database,
  Layers,
  HardDrive,
  Activity,
  Clock,
  RefreshCcw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';

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
  if (document.status === 'ready') return 100;

  if (document.status === 'processing') {
    const processedChunks = document.processedChunks || 0;
    const totalChunks = document.totalChunks || 0;

    if (totalChunks > 0) {
      return Math.min(99, Math.round((processedChunks / totalChunks) * 100));
    }

    return 10;
  }

  if (document.status === 'failed') {
    const processedChunks = document.processedChunks || 0;
    const totalChunks = document.totalChunks || 0;

    if (totalChunks > 0) {
      return Math.round((processedChunks / totalChunks) * 100);
    }
  }

  return 0;
}

function getProcessingLabel(document: Document) {
  if (document.status === 'failed') return 'Failed';

  const step = document.processingStep || 'Processing';
  const processedChunks = document.processedChunks || 0;
  const totalChunks = document.totalChunks || 0;

  if (document.status === 'processing' && totalChunks > 0) {
    return `${step} · ${processedChunks}/${totalChunks}`;
  }

  return document.status === 'processing' ? 'Processing...' : step;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
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

      setDocumentsError('');

      const res = await fetch(apiUrl('/documents'), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Could not load documents.');
      }

      setDocuments(data.documents || []);
    } catch {
      setDocumentsError('Could not load documents. Make sure the backend server is running.');
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
    const hasProcessingDocuments = documents.some((document) => document.status === 'processing');

    if (!hasProcessingDocuments) return;

    const intervalId = window.setInterval(() => {
      fetchDocuments(false);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [documents, fetchDocuments]);

  useEffect(() => {
    setContext({
      page: 'documents',
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
      form.append('file', file);

      const res = await fetch(apiUrl('/documents/upload'), {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: form,
      });

      const data = await res.json();

      if (data.ok) {
        addToast({
          type: 'success',
          title: 'Document uploaded',
        });

        fetchDocuments(false);
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id: string) {
    try {
      await fetch(apiUrl(`/documents/${id}`), {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      setDocuments((prev) => prev.filter((d) => d._id !== id));
      setSelectedDocumentIds((prev) => prev.filter((selectedId) => selectedId !== id));

      addToast({
        type: 'success',
        title: 'Document deleted',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Failed to delete',
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

    router.push(`/documents/chat?ids=${selectedDocumentIds.join(',')}`);
  }

  function openDocument(id: string) {
    router.push(`/documents/${id}`);
  }

  function getFileIcon(type: string) {
    if (type === 'pdf') return <FileText className="size-5 text-red-500" />;
    if (type === 'md') return <FileCode className="size-5 text-blue-500" />;
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

  // Derived state for Knowledge Insights and Overview Cards
  const totalDocuments = documents.length;
  const storageUsedBytes = documents.reduce((acc, doc) => acc + (doc.size || 0), 0);
  const storageUsed = formatSize(storageUsedBytes);

  const processingCount = documents.filter((d) => d.status === 'processing').length;
  const failedCount = documents.filter((d) => d.status === 'failed').length;

  const recentUploads = [...documents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const fileCategories = documents.reduce(
    (acc, doc) => {
      acc[doc.fileType] = (acc[doc.fileType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <AuthenticatedLayout>
      <div className="flex flex-col gap-8 pb-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
            <p className="text-muted-foreground mt-1">
              Manage knowledge sources powering your AI workflows.
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              className="gap-2 shadow-sm"
            >
              {uploading ? (
                <RefreshCcw className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6 flex flex-col gap-2 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:bg-card hover:shadow-md hover:border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Documents</span>
              <div className="p-2 bg-primary/10 rounded-md">
                <Database className="size-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold">{totalDocuments > 0 ? totalDocuments : '-'}</div>
          </Card>

          <Card className="p-6 flex flex-col gap-2 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:bg-card hover:shadow-md hover:border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Indexed Sources</span>
              <div className="p-2 bg-primary/10 rounded-md">
                <Layers className="size-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold text-muted-foreground/50">-</div>
          </Card>

          <Card className="p-6 flex flex-col gap-2 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:bg-card hover:shadow-md hover:border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Storage Used</span>
              <div className="p-2 bg-primary/10 rounded-md">
                <HardDrive className="size-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold">{storageUsedBytes > 0 ? storageUsed : '-'}</div>
          </Card>

          <Card className="p-6 flex flex-col gap-2 bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:bg-card hover:shadow-md hover:border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Processing Status</span>
              <div className="p-2 bg-primary/10 rounded-md">
                <Activity className="size-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold">
              {processingCount > 0 ? (
                <span className="text-amber-500">{processingCount}</span>
              ) : failedCount > 0 ? (
                <span className="text-destructive">{failedCount}</span>
              ) : (
                <span className="text-muted-foreground/50">-</span>
              )}
            </div>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="grid gap-8 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_350px] items-start">
          {/* Document Library Column */}
          <div className="flex flex-col gap-6 w-full min-w-0">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search documents by name..."
                className="pl-12 h-12 text-base bg-background/50 border-border/50 hover:border-border focus-visible:ring-primary/20 shadow-sm transition-all rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {documentsLoading && (
              <div className="py-12 text-sm text-muted-foreground flex justify-center items-center">
                <RefreshCcw className="size-4 animate-spin mr-2" /> Loading documents...
              </div>
            )}

            {documentsError && !documentsLoading && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 shadow-sm">
                <p className="text-sm font-medium text-destructive">{documentsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDocuments()}
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Documents List or Empty State */}
            {!documentsLoading && !documentsError && filteredDocs.length === 0 && (
              <div className="py-4 w-full">
                {documents.length > 0 ? (
                  <EmptyState
                    className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm"
                    icon={SearchX}
                    title="No results found"
                    description={`We couldn't find any matches for "${search}". Check your spelling or try another keyword.`}
                    primaryAction={
                      <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                        Clear search filter
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm py-12"
                    icon={Database}
                    title="Your knowledge base is empty"
                    description="Upload documents to provide context to your AI agents. These sources will be automatically indexed and used across your automation workflows."
                    primaryAction={
                      <div className="mt-8 flex flex-col items-center gap-6">
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-2 px-8 h-12 rounded-full shadow-md hover:shadow-lg transition-all"
                          size="lg"
                        >
                          <Upload className="size-4" />
                          Upload First Document
                        </Button>

                        <div className="flex gap-2 justify-center">
                          <Badge variant="outline" className="px-3 py-1 bg-background/50">
                            PDF
                          </Badge>
                          <Badge variant="outline" className="px-3 py-1 bg-background/50">
                            TXT
                          </Badge>
                          <Badge variant="outline" className="px-3 py-1 bg-background/50">
                            Markdown
                          </Badge>
                          <Badge variant="outline" className="px-3 py-1 bg-background/50">
                            CSV
                          </Badge>
                        </div>
                      </div>
                    }
                  />
                )}
              </div>
            )}

            {!documentsLoading && !documentsError && filteredDocs.length > 0 && (
              <div className="space-y-5">
                {selectedDocumentIds.length > 0 && (
                  <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="default"
                        className="text-xs bg-primary text-primary-foreground"
                      >
                        Selected: {selectedDocumentIds.length}
                      </Badge>
                      <span className="text-sm text-primary/80 font-medium">
                        Choose documents to chat with together
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        disabled={!selectedDocumentIds.length}
                        onClick={chatWithSelectedDocuments}
                        className="gap-2"
                        size="sm"
                      >
                        <MessageSquare className="size-4" />
                        Chat with Selected
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setSelectedDocumentIds([])}
                        className="gap-2 border-primary/20 hover:bg-primary/5"
                        size="sm"
                      >
                        <X className="size-4" />
                        Clear
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {filteredDocs.map((doc) => {
                    const isSelected = selectedDocumentIds.includes(doc._id);
                    const isProcessing = doc.status === 'processing';
                    const isFailed = doc.status === 'failed';
                    const progress = getDocumentProgress(doc);

                    return (
                      <Card
                        key={doc._id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${doc.title || 'Untitled'}`}
                        onClick={() => openDocument(doc._id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDocument(doc._id);
                          }
                        }}
                        className={`p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl bg-card/60 backdrop-blur-sm border-border/60 ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/30'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`p-3 rounded-lg flex-shrink-0 ${isSelected ? 'bg-primary/20' : 'bg-muted/50'}`}
                          >
                            {getFileIcon(doc.fileType)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 truncate font-semibold text-base leading-tight mt-1">
                                {doc.title || 'Untitled'}
                              </p>

                              <div
                                className="flex items-center gap-2 flex-shrink-0"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                {isSelected && (
                                  <Badge
                                    variant="secondary"
                                    className="hidden text-xs sm:inline-flex bg-primary/20 text-primary hover:bg-primary/20"
                                  >
                                    Selected
                                  </Badge>
                                )}

                                <Checkbox
                                  checked={isSelected}
                                  aria-label={`Select ${doc.title || 'Untitled'}`}
                                  onCheckedChange={() => toggleDocumentSelection(doc._id)}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  className={
                                    isSelected
                                      ? 'border-primary data-[state=checked]:bg-primary'
                                      : ''
                                  }
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-3">
                              {doc.status && (
                                <Badge
                                  variant={isFailed ? 'destructive' : 'secondary'}
                                  className={`text-[10px] uppercase tracking-wider font-semibold ${
                                    isFailed
                                      ? ''
                                      : doc.status === 'ready'
                                        ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                        : ''
                                  }`}
                                >
                                  {isFailed ? 'Failed' : doc.status}
                                </Badge>
                              )}

                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase tracking-wider font-semibold bg-background/50"
                              >
                                {doc.fileType}
                              </Badge>

                              <Badge
                                variant="outline"
                                className="text-xs font-mono bg-background/50 text-muted-foreground"
                              >
                                {doc.chunkCount} chunks
                              </Badge>

                              {doc.size && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-background/50 text-muted-foreground"
                                >
                                  {formatSize(doc.size)}
                                </Badge>
                              )}
                            </div>

                            {(isProcessing || isFailed) && (
                              <div className="mt-5 space-y-2.5 bg-background/50 p-3 rounded-lg border border-border/50">
                                <div className="flex items-center justify-between gap-3 text-xs font-medium">
                                  <span
                                    className={
                                      isFailed ? 'text-destructive' : 'text-muted-foreground'
                                    }
                                  >
                                    {getProcessingLabel(doc)}
                                  </span>

                                  {!isFailed && (
                                    <span className="font-mono text-primary">{progress}%</span>
                                  )}
                                </div>

                                <Progress
                                  value={progress}
                                  className={`h-2 bg-muted ${
                                    isFailed ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'
                                  }`}
                                />

                                {isFailed && doc.processingError && (
                                  <p className="line-clamp-2 text-xs text-destructive/80 mt-1">
                                    {doc.processingError}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-border/40">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Clock className="size-3" />
                            {doc.createdAt.slice(0, 10)}
                          </span>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-8 transition-colors"
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

          {/* Knowledge Insights Sidebar */}
          <div className="flex flex-col gap-6 sticky top-6">
            <Card className="p-6 flex flex-col gap-6 bg-card/40 backdrop-blur-md border-border/50 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                <Activity className="size-5 text-primary" />
                Knowledge Insights
              </h3>

              <div className="space-y-6">
                {/* Recent Uploads */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider flex items-center justify-between">
                    Recent Uploads
                    <Badge variant="secondary" className="text-[10px] bg-background">
                      {recentUploads.length}
                    </Badge>
                  </h4>
                  {recentUploads.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {recentUploads.map((doc) => (
                        <div
                          key={`recent-${doc._id}`}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => openDocument(doc._id)}
                        >
                          <div className="p-2 rounded bg-background border border-border/50">
                            {getFileIcon(doc.fileType)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">
                              {doc.title || 'Untitled'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {doc.createdAt.slice(0, 10)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center bg-background/50 rounded-lg border border-dashed border-border/50">
                      <Clock className="size-8 text-muted-foreground/30 mb-3" />
                      <span className="text-sm text-muted-foreground font-medium">
                        No document activity yet
                      </span>
                      <span className="text-xs text-muted-foreground/70 mt-1">
                        Upload documents to see history
                      </span>
                    </div>
                  )}
                </div>

                {/* File Categories */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                    File Categories
                  </h4>
                  {Object.keys(fileCategories).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(fileCategories).map(([type, count]) => (
                        <div
                          key={type}
                          className="flex items-center gap-2 bg-background/50 border border-border/50 rounded-md px-3 py-2 text-sm"
                        >
                          <span className="uppercase font-medium text-foreground">{type}</span>
                          <span className="text-muted-foreground text-xs bg-muted px-1.5 py-0.5 rounded">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground bg-background/50 p-4 rounded-lg border border-border/50 text-center">
                      No categories available
                    </div>
                  )}
                </div>

                {/* Processing Activity */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                    Processing Activity
                  </h4>
                  {processingCount > 0 || failedCount > 0 ? (
                    <div className="flex flex-col gap-3">
                      {processingCount > 0 && (
                        <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-500 font-medium">
                          <span>Processing</span>
                          <span>
                            {processingCount} doc{processingCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {failedCount > 0 && (
                        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive font-medium">
                          <span>Failed</span>
                          <span>
                            {failedCount} doc{failedCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground bg-background/50 p-4 rounded-lg border border-border/50 text-center">
                      No active processing
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
