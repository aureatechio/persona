'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, ArrowDown, ChevronDown, ChevronRight, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogEntry } from './types';
import { NODE_LABELS } from './types';

const levelColors: Record<string, string> = {
  info: 'text-sky-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
  debug: 'text-zinc-500',
};

/* ── Single Log Line ── */

function LogLine({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = log.detail && Object.keys(log.detail).length > 0;
  const time = new Date(log.timestamp).toLocaleTimeString('pt-BR', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="group">
      <div
        className={cn(
          'flex items-start gap-2.5 py-1.5 rounded-lg px-2 -mx-2 transition-colors duration-150',
          hasDetail ? 'cursor-pointer hover:bg-white/[0.03]' : '',
        )}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <span className="text-xs text-zinc-600 tabular-nums shrink-0 mt-px font-mono">{time}</span>
        <span className={cn('text-xs font-bold uppercase w-12 shrink-0 mt-px', levelColors[log.level] || 'text-zinc-500')}>
          {log.level}
        </span>
        <span className="text-xs text-zinc-500 w-32 shrink-0 truncate mt-px">{log.step}</span>
        <span className="text-xs text-zinc-300 flex-1 break-words leading-relaxed">{log.message}</span>
        {hasDetail && (
          expanded
            ? <ChevronDown size={12} className="text-zinc-600 shrink-0 mt-0.5" />
            : <ChevronRight size={12} className="text-zinc-600 shrink-0 mt-0.5" />
        )}
      </div>
      {expanded && hasDetail && (
        <pre className="ml-28 text-xs text-zinc-500 bg-zinc-950/60 rounded-xl p-3 my-1 overflow-x-auto max-h-72 border border-white/[0.04] whitespace-pre-wrap break-words font-mono">
          {JSON.stringify(log.detail, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* ── Log Stream (inline, for a specific step) ── */

export function LogStream({
  logs,
  selectedNode,
}: {
  logs: LogEntry[];
  selectedNode: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const filtered = selectedNode
    ? logs.filter(l => {
        const snakeKey = selectedNode.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        return l.step === selectedNode || l.step === snakeKey || l.step.includes(snakeKey);
      })
    : logs;

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  if (filtered.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-zinc-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Logs {selectedNode ? `- ${NODE_LABELS[selectedNode] || selectedNode}` : ''}
          </span>
          <span className="text-xs text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-lg tabular-nums">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200',
            autoScroll
              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              : 'bg-white/[0.03] text-zinc-600 border border-white/[0.06]',
          )}
        >
          <ArrowDown size={10} />
          Auto-scroll
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto rounded-xl bg-zinc-950/60 border border-white/[0.04] p-3 font-mono scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50"
        onScroll={(e) => {
          const el = e.currentTarget;
          const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          if (isAtBottom !== autoScroll) setAutoScroll(isAtBottom);
        }}
      >
        <div className="space-y-0.5">
          {filtered.map(log => <LogLine key={log.id} log={log} />)}
        </div>
      </div>
    </div>
  );
}

/* ── Full Log Panel (for "all logs" view when no node selected) ── */

export function FullLogPanel({ logs }: { logs: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-4">
          <Radio size={24} className="text-zinc-700" />
        </div>
        <p className="text-sm font-semibold text-zinc-500">Aguardando atividade...</p>
        <p className="text-xs text-zinc-600 mt-2 max-w-xs leading-relaxed">
          Abra a tela principal em outra aba e faca uma pergunta na Arena.
          Os logs aparecerao aqui automaticamente em tempo real.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-400">Todos os Logs</span>
          <span className="text-xs text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-lg tabular-nums">
            {logs.length}
          </span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200',
            autoScroll
              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              : 'bg-white/[0.03] text-zinc-600 border border-white/[0.06]',
          )}
        >
          <ArrowDown size={10} />
          Auto-scroll
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-3 font-mono scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50"
        onScroll={(e) => {
          const el = e.currentTarget;
          const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          if (isAtBottom !== autoScroll) setAutoScroll(isAtBottom);
        }}
      >
        <div className="space-y-0.5">
          {logs.map(log => <LogLine key={log.id} log={log} />)}
        </div>
      </div>
    </div>
  );
}
