'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { runAgentTeam } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Zap, Send, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

interface Message {
  id: string;
  role: 'user' | 'agent';
  agentName?: string;
  content: string;
  workflowExecution?: {
    workflowId: string;
    workflowName: string;
    status: 'success' | 'failed';
  };
}

export default function WarRoomChat() {
  const params = useParams();
  const teamId = params.id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('jwt');
      if (token) {
        socket.emit('join_war_room', { teamId, token });
      } else {
        console.error('🚨 AUTH ERROR on load: Missing token.');
      }
    });
    socket.on('workflow_status', (data: any) => {
      setIsTyping(false);

      const newMsg: Message = {
        id: Date.now().toString() + Math.random().toString(),
        role: 'agent',
        agentName: data.stepName || 'System Orchestrator',
        content: data.message,
      };
      if (data.type === 'complete') {
        newMsg.workflowExecution = {
          workflowId: data.taskId || 'unknown',
          workflowName: 'Agent Workflow',
          status: data.success ? 'success' : 'failed',
        };
      }

      setMessages((prev) => [...prev, newMsg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [teamId]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res: any = await runAgentTeam(teamId, userMsg.content);

      if (res && res.workflowId) {
        const token =
          localStorage.getItem('token') ||
          localStorage.getItem('accessToken') ||
          localStorage.getItem('jwt');

        if (!token) {
          console.error(
            '🚨 AUTH ERROR: Could not find your login token in localStorage. The socket room will reject the connection.'
          );
        } else {
          console.log('✅ Token found, sending to socket server...');
          socketRef.current?.emit('join_war_room', { teamId: res.workflowId, token });
        }
      }
    } catch (error) {
      console.error(error);
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 shrink-0 border-b pb-4">
        <div className="flex items-center gap-4">
          <Link href={`/agent-teams/${teamId}/builder`}>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">War Room</h2>
            <p className="text-sm text-muted-foreground">Live Agent-to-Agent Execution Interface</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-6 pr-4" ref={scrollRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex flex-col max-w-[85%] rounded-2xl p-4 shadow-sm',
              msg.role === 'user'
                ? 'ml-auto bg-indigo-600 text-white rounded-br-none'
                : 'bg-card border rounded-bl-none'
            )}
          >
            {msg.role !== 'user' && (
              <div className="flex items-center gap-2 mb-2">
                <Bot className="size-4 text-indigo-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                  {msg.agentName || 'Agent Node'}
                </span>
              </div>
            )}

            <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>

            {msg.workflowExecution && (
              <div className="mt-4 flex items-center gap-3 bg-muted/50 border border-indigo-500/30 rounded-xl p-3">
                <div className="flex items-center justify-center size-8 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
                  <Zap className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    ⚡ Workflow Execution Complete
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Trace ID: {msg.workflowExecution.workflowId} • Status:{' '}
                    {msg.workflowExecution.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-3 text-muted-foreground text-sm p-4 bg-card border rounded-2xl rounded-bl-none max-w-[200px]">
            <Bot className="size-4 animate-bounce" />
            <span className="animate-pulse">Agents processing...</span>
          </div>
        )}
      </div>

      <div className="shrink-0 flex gap-3 pt-4 border-t mt-auto">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Trigger the team (e.g. 'The server is down, figure it out')..."
          className="flex-1 h-12 shadow-sm rounded-xl bg-background"
        />
        <Button
          onClick={handleSend}
          className="h-12 w-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 shrink-0 p-0 text-white"
        >
          <Send className="size-5" />
        </Button>
      </div>
    </div>
  );
}
