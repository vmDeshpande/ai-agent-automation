'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Copy, Send, Bot, User } from 'lucide-react';
import { useAssistantContext } from '@/context/assistant-context';
import { apiUrl } from '@/lib/api';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function DocumentChatPage() {
  const { id } = useParams();
  const [documentName, setDocumentName] = useState<string>('');
  const { setContext } = useAssistantContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  /* Auto scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    async function loadDocument() {
      try {
        const res = await fetch(apiUrl(`/documents/${id}`), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });

        const data = await res.json();

        if (data.ok) {
          setDocumentName(data.document.title);
        }
      } catch (err) {
        console.error('Failed to load document info', err);
      }
    }

    loadDocument();
  }, [id]);

  /* Assistant context */
  useEffect(() => {
    setContext({
      page: 'documents',
    });
  }, []);

  async function sendMessage() {
    if (!input.trim()) return;

    const question = input;

    const userMessage: Message = {
      role: 'user',
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/documents/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({
          documentId: id,
          question,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        const reply: Message = {
          role: 'assistant',
          content: data.answer,
        };

        setMessages((prev) => [...prev, reply]);
      }
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <AuthenticatedLayout layout="panel">
      <div className="flex flex-col flex-1 min-h-0 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold">Document Chat</h1>

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {documentName || 'Loading document...'}
                </span>

                <Badge variant="outline" className="text-xs font-mono">
                  {id}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Chat container */}
        <Card className="flex flex-col flex-1 bg-muted/20 border-border">
          <ScrollArea className="flex-1 px-6 py-6">
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <Bot className="size-8 opacity-70" />
                <p className="text-sm">Ask questions about this document</p>
                <p className="text-xs opacity-70">Example: “What projects are mentioned?”</p>
              </div>
            )}

            <div className="space-y-8">
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';

                return (
                  <div key={i} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <Avatar className="mt-1">
                        <AvatarFallback>
                          <Bot size={16} />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className="flex flex-col max-w-2xl">
                      {/* Message bubble */}
                      <div
                        className={`rounded-xl px-5 py-4 text-sm leading-relaxed transition-all ${
                          isUser
                            ? 'bg-primary/10 border border-primary/20'
                            : 'bg-background border border-border'
                        }`}
                      >
                        <div className="prose prose-invert max-w-none text-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      </div>

                      {/* Copy button */}
                      {!isUser && (
                        <div className="mt-2 flex justify-start">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyText(msg.content)}
                            className="h-7 w-7 opacity-60 hover:opacity-100"
                          >
                            <Copy size={14} />
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

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-4">
                  <Avatar>
                    <AvatarFallback>
                      <Bot size={16} />
                    </AvatarFallback>
                  </Avatar>

                  <div className="rounded-xl px-5 py-4 text-sm border bg-background">
                    <div className="flex gap-1">
                      <span className="animate-bounce">.</span>
                      <span className="animate-bounce delay-150">.</span>
                      <span className="animate-bounce delay-300">.</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t border-border p-4 bg-background">
            <div className="flex gap-3">
              <Input
                value={input}
                placeholder="Ask about this document..."
                disabled={loading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage();
                }}
              />

              <Button onClick={sendMessage} disabled={loading}>
                <Send size={16} />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
