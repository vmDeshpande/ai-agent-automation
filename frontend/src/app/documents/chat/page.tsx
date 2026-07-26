'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Bot,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';

import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAssistantContext } from '@/context/assistant-context';
import { apiUrl } from '@/lib/api';

type DocumentMeta = {
  _id: string;
  title: string;
  fileType?: string;
  chunkCount?: number;
  size?: number;
  status?: string;
  processingStep?: string;
  processedChunks?: number;
  totalChunks?: number;
  processingStartedAt?: string;
  processedAt?: string;
  processingError?: string;
};

type RagSource = {
  documentId: string;
  title: string;
  chunkIndex: number;
  score?: number;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSource[];
};

type SourceGroup = {
  documentId: string;
  title: string;
  chunkIndexes: number[];
  excerptCount: number;
  bestScore?: number;
};

const suggestedPrompts = [
  'Summarize the selected documents',
  'Compare the main differences',
  'Find contradictions or gaps',
];

function parseDocumentIds(idsParam: string | null) {
  return [
    ...new Set(
      (idsParam || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];
}

function formatSize(bytes?: number) {
  if (!bytes) return null;

  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatScore(score?: number) {
  if (typeof score !== 'number') return null;
  return score.toFixed(2);
}

function groupSourcesByDocument(sources: RagSource[] = []) {
  const groups = new Map<string, SourceGroup & { seenChunks: Set<number> }>();

  for (const source of sources) {
    const groupKey = source.documentId || source.title || 'unknown-source';
    const existingGroup = groups.get(groupKey);
    const group = existingGroup || {
      documentId: source.documentId,
      title: source.title || 'Untitled',
      chunkIndexes: [],
      excerptCount: 0,
      bestScore: undefined,
      seenChunks: new Set<number>(),
    };

    if (!group.seenChunks.has(source.chunkIndex)) {
      group.seenChunks.add(source.chunkIndex);
      group.chunkIndexes.push(source.chunkIndex);
      group.excerptCount += 1;
    }

    if (
      typeof source.score === 'number' &&
      (typeof group.bestScore !== 'number' || source.score > group.bestScore)
    ) {
      group.bestScore = source.score;
    }

    groups.set(groupKey, group);
  }

  return Array.from(groups.values()).map(({ seenChunks, ...group }) => group);
}

function formatSourceMeta(document: DocumentMeta) {
  const status =
    document.status === 'failed' ? 'Failed' : document.status === 'ready' ? 'Ready' : 'Processing';
  const type = document.fileType?.toUpperCase();
  const size = formatSize(document.size);

  const details =
    document.status === 'ready'
      ? [
          status,
          typeof document.chunkCount === 'number' ? `${document.chunkCount} chunks` : null,
          size,
        ]
      : [status, type, size];

  return details.filter(Boolean).join(' · ');
}

function getDocumentProgress(document: DocumentMeta) {
  if (document.status === 'ready') return 100;

  const processedChunks = document.processedChunks || 0;
  const totalChunks = document.totalChunks || 0;

  if (totalChunks > 0) {
    return Math.round((processedChunks / totalChunks) * 100);
  }

  return document.status === 'processing' ? 10 : 0;
}

function getProcessingLabel(document: DocumentMeta) {
  if (document.status === 'failed') return 'Failed';

  const step = document.processingStep || 'Processing';
  const processedChunks = document.processedChunks || 0;
  const totalChunks = document.totalChunks || 0;

  if (document.status === 'processing' && totalChunks > 0) {
    return `${step} · ${processedChunks}/${totalChunks}`;
  }

  return document.status === 'processing' ? 'Processing...' : step;
}

function MultiDocumentChatContent() {
  const searchParams = useSearchParams();
  const selectedDocumentIds = useMemo(
    () => parseDocumentIds(searchParams.get('ids')),
    [searchParams]
  );
  const selectedDocumentIdKey = selectedDocumentIds.join(',');

  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [missingDocumentIds, setMissingDocumentIds] = useState<string[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { setContext, clearContext } = useAssistantContext();
  const nonReadyDocuments = useMemo(
    () => documents.filter((document) => document.status && document.status !== 'ready'),
    [documents]
  );

  useEffect(() => {
    setContext({
      page: 'documents',
    });

    return () => clearContext();
  }, [clearContext, setContext]);

  useEffect(() => {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({ behavior: isReducedMotion ? 'auto' : 'smooth' });
  }, [messages, chatLoading]);

  const loadDocuments = useCallback(
    async (showLoader = true) => {
      if (!selectedDocumentIds.length) {
        setDocuments([]);
        setMissingDocumentIds([]);
        return;
      }

      try {
        if (showLoader) {
          setMetadataLoading(true);
        }
        setMetadataError('');

        const res = await fetch(apiUrl('/documents'), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });

        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || 'Failed to load documents');
        }

        const allDocuments = (data.documents || []) as DocumentMeta[];
        const byId = new Map(allDocuments.map((document) => [document._id, document]));
        const selectedDocuments = selectedDocumentIds
          .map((id) => byId.get(id))
          .filter(Boolean) as DocumentMeta[];

        setDocuments(selectedDocuments);
        setMissingDocumentIds(selectedDocumentIds.filter((id) => !byId.has(id)));
      } catch {
        setMetadataError(
          'Could not load selected document details. Make sure the backend server is running.'
        );
      } finally {
        if (showLoader) {
          setMetadataLoading(false);
        }
      }
    },
    [selectedDocumentIds]
  );

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const hasProcessingDocuments = documents.some((document) => document.status === 'processing');

    if (!hasProcessingDocuments) return;

    const intervalId = window.setInterval(() => {
      loadDocuments(false);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [documents, loadDocuments]);

  async function submitQuestion(questionOverride?: string) {
    const question = (questionOverride || input).trim();
    if (!question || chatLoading || !selectedDocumentIds.length) return;

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: question,
      },
    ]);
    setInput('');
    setChatError('');
    setChatLoading(true);

    try {
      const res = await fetch(apiUrl('/documents/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({
          documentIds: selectedDocumentIds,
          question,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'The document chat request failed.');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            data.answer || 'I could not find relevant information in the selected document(s).',
          sources: Array.isArray(data.sources) ? data.sources : [],
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'The document chat request failed.');
    } finally {
      setChatLoading(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (!selectedDocumentIds.length) {
    return (
      <AuthenticatedLayout layout="panel">
        <div className="flex flex-1 min-h-0 items-center justify-center p-6">
          <EmptyState
            icon={FileText}
            title="No documents selected"
            description="Go back to Documents and select files to chat with."
            primaryAction={
              <Button asChild className="gap-2">
                <Link href="/documents">
                  <ArrowLeft className="size-4" />
                  Back to Documents
                </Link>
              </Button>
            }
          />
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout layout="panel">
      <div className="flex flex-col flex-1 min-h-0 gap-5 p-6 overflow-hidden">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit gap-2">
              <Link href="/documents">
                <ArrowLeft className="size-4" />
                Documents
              </Link>
            </Button>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Multi-document Chat</h1>
              <p className="text-sm text-muted-foreground">
                Ask questions across selected documents
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="size-3" />
              {selectedDocumentIds.length} sources selected
            </Badge>
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMessages([]);
                  setChatError('');
                }}
                className="gap-2"
              >
                <X className="size-4" />
                Clear chat
              </Button>
            )}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)] overflow-hidden">
          <aside className="min-h-0">
            <Card className="flex h-full flex-col overflow-hidden border-border/70 bg-muted/10 shadow-sm">
              <div className="border-b border-border/70 px-5 py-5">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight">Sources</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedDocumentIds.length} documents selected
                  </p>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-3.5 p-5">
                  {metadataLoading && (
                    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2.5 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading sources...
                    </div>
                  )}

                  {metadataError && (
                    <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                      {metadataError}
                    </div>
                  )}

                  {missingDocumentIds.length > 0 && (
                    <div className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2.5 text-sm text-warning-foreground">
                      {missingDocumentIds.length} selected document(s) could not be loaded or are
                      not accessible.
                    </div>
                  )}

                  {nonReadyDocuments.length > 0 && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center">
                        <Zap className="w-4 h-4 text-primary mr-1" /> Preparing{' '}
                      </span>{' '}
                      {nonReadyDocuments.length} source
                      {nonReadyDocuments.length === 1 ? '' : 's'}. Answers may improve once
                      processing finishes.
                    </div>
                  )}

                  {documents.map((document) => {
                    const isProcessing = document.status === 'processing';
                    const isFailed = document.status === 'failed';
                    const progress = getDocumentProgress(document);

                    return (
                      <Link
                        key={document._id}
                        href={`/documents/${document._id}`}
                        className="block rounded-xl border border-border/70 bg-background/70 p-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-background"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="mt-0.5 rounded-md bg-muted/80 p-1.5">
                            <FileText className="size-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-[15px] font-medium leading-snug">
                                {document.title || 'Untitled'}
                              </p>
                              <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground/70" />
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatSourceMeta(document)}
                            </p>
                            {(isProcessing || isFailed) && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span
                                    className={
                                      isFailed ? 'text-destructive' : 'text-muted-foreground'
                                    }
                                  >
                                    {getProcessingLabel(document)}
                                  </span>
                                  {!isFailed && (
                                    <span className="font-mono text-muted-foreground">
                                      {progress}%
                                    </span>
                                  )}
                                </div>
                                <Progress
                                  value={progress}
                                  className={`h-1 ${isFailed ? '[&>div]:bg-destructive' : ''}`}
                                />
                                {isFailed && document.processingError && (
                                  <p className="line-clamp-2 text-xs text-muted-foreground">
                                    {document.processingError}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          </aside>

          <Card className="flex min-h-0 flex-col overflow-hidden border-border bg-muted/20">
            <div className="border-b border-border bg-background/70 px-5 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <MessageSquare className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Workspace chat</h2>
                  <p className="text-xs text-muted-foreground">
                    Answers cite the selected source documents
                  </p>
                </div>
              </div>
            </div>

            <div
              ref={chatScrollRef}
              className="flex-1 min-h-0 overflow-y-auto px-5 py-5 scroll-smooth no-scrollbar"
            >
              {messages.length === 0 && !chatLoading && (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <div className="mb-4 rounded-full border border-primary/20 bg-primary/10 p-3 text-primary">
                    <Bot className="size-7" />
                  </div>
                  <h3 className="text-lg font-semibold">Start with your sources</h3>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Ask for a summary, compare themes, or look for gaps across the selected
                    documents.
                  </p>

                  <div className="mt-6 grid w-full max-w-3xl gap-3 md:grid-cols-3">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="rounded-lg border border-border bg-background/80 p-4 text-left text-sm transition-colors hover:border-primary/60 hover:bg-primary/10"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-7">
                {messages.map((message, index) => {
                  const isUser = message.role === 'user';
                  const groupedSources = groupSourcesByDocument(message.sources || []);

                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <Avatar className="mt-1">
                          <AvatarFallback>
                            <Bot size={16} />
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={`flex max-w-3xl flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`rounded-xl border px-5 py-4 text-sm leading-relaxed ${
                            isUser
                              ? 'border-primary/20 bg-primary/10'
                              : 'border-border bg-background'
                          }`}
                        >
                          <div className="prose prose-invert max-w-none text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        </div>

                        {!isUser && (
                          <div className="mt-3 flex w-full flex-col gap-3">
                            {groupedSources.length > 0 && (
                              <div className="rounded-lg border border-border bg-background/70 p-3">
                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Sources used
                                </p>
                                <div className="grid gap-2">
                                  {groupedSources.map((sourceGroup) => (
                                    <Link
                                      key={sourceGroup.documentId || sourceGroup.title}
                                      href={`/documents/${sourceGroup.documentId}`}
                                      className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs transition-colors hover:border-primary/50 hover:bg-primary/10"
                                    >
                                      <span className="block truncate font-medium">
                                        {sourceGroup.title || 'Untitled'}
                                      </span>
                                      <span className="mt-1 block text-muted-foreground">
                                        {sourceGroup.excerptCount}{' '}
                                        {sourceGroup.excerptCount === 1 ? 'excerpt' : 'excerpts'}
                                        {formatScore(sourceGroup.bestScore)
                                          ? ` · Best score ${formatScore(sourceGroup.bestScore)}`
                                          : ''}
                                      </span>
                                      <span className="mt-1 block text-muted-foreground">
                                        {sourceGroup.chunkIndexes.length === 1 ? 'Chunk' : 'Chunks'}{' '}
                                        {sourceGroup.chunkIndexes.join(', ')}
                                      </span>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyText(message.content)}
                              className="w-fit gap-2 opacity-70 hover:opacity-100"
                            >
                              <Copy className="size-3.5" />
                              Copy
                            </Button>
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <Avatar className="mt-1">
                          <AvatarFallback>
                            <User size={16} />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}

                {chatLoading && (
                  <div className="flex gap-4">
                    <Avatar>
                      <AvatarFallback>
                        <Bot size={16} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-xl border border-border bg-background px-5 py-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Reading across selected sources...
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} aria-hidden="true" className="h-px" />
              </div>
            </div>

            {chatError && (
              <div className="border-t border-destructive/30 bg-destructive/10 px-5 py-3 text-sm text-destructive shrink-0">
                {chatError}
              </div>
            )}

            <div className="shrink-0 border-t border-border/60 bg-background/80 backdrop-blur-md p-4 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
              <label htmlFor="multi-document-question" className="sr-only">
                Ask a question across selected documents
              </label>
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <Textarea
                  id="multi-document-question"
                  value={input}
                  disabled={chatLoading}
                  placeholder="Compare the key ideas across these documents..."
                  className="max-h-40 min-h-20 resize-none"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      submitQuestion();
                    }
                  }}
                />
                <Button
                  onClick={() => submitQuestion()}
                  disabled={chatLoading || !input.trim()}
                  className="gap-2 md:h-20 md:px-5"
                >
                  {chatLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

export default function MultiDocumentChatPage() {
  return (
    <Suspense fallback={null}>
      <MultiDocumentChatContent />
    </Suspense>
  );
}
