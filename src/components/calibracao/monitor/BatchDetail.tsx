'use client';

import { useCalibrationStore, type PersonaBatchDetail } from '@/app/calibracao/store';
import { Cpu, User, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import PersonaDrillDown from '../PersonaDrillDown';

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 6) return 'text-emerald-500/70';
  if (score <= 3) return 'text-red-400';
  if (score <= 4) return 'text-red-500/70';
  return 'text-zinc-400';
}

function scoreBg(score: number): string {
  if (score >= 7) return 'bg-emerald-500/10';
  if (score >= 6) return 'bg-emerald-500/5';
  if (score <= 3) return 'bg-red-500/10';
  if (score <= 4) return 'bg-red-500/5';
  return 'bg-zinc-800/30';
}

function sentimentIcon(sentiment: string) {
  switch (sentiment) {
    case 'positive': return <TrendingUp size={11} className="text-emerald-400" />;
    case 'negative': return <TrendingDown size={11} className="text-red-400" />;
    default: return <Minus size={11} className="text-zinc-500" />;
  }
}

function sentimentLabel(sentiment: string) {
  switch (sentiment) {
    case 'positive': return 'A Favor';
    case 'negative': return 'Contra';
    default: return 'Neutro';
  }
}

function PersonaRow({
  persona,
  index,
  isNew,
  onClick,
}: {
  persona: PersonaBatchDetail;
  index: number;
  isNew: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5
        border-b border-white/[0.03] last:border-0
        hover:bg-white/[0.04] transition-all duration-300 text-left
        ${isNew ? 'animate-in fade-in slide-in-from-top-2 duration-500' : ''}
      `}
    >
      {/* Index */}
      <span className="text-[10px] text-zinc-700 font-mono tabular-nums w-6 text-right shrink-0">
        {index + 1}
      </span>

      {/* Sentiment icon */}
      <span className={`shrink-0 p-1 rounded-lg ${scoreBg(persona.score)}`}>
        {sentimentIcon(persona.sentiment)}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-zinc-300 truncate block">{persona.name}</span>
      </div>

      {/* State */}
      <span className="text-[11px] text-zinc-600 w-8 shrink-0">{persona.state}</span>

      {/* Age */}
      <span className="text-[11px] text-zinc-600 w-8 shrink-0">{persona.age}a</span>

      {/* Score */}
      <span className={`text-sm font-bold tabular-nums w-10 text-right shrink-0 ${scoreColor(persona.score)}`}>
        {persona.score.toFixed(1)}
      </span>

      {/* Sentiment label */}
      <span className={`text-[10px] font-medium w-14 text-right shrink-0 ${
        persona.sentiment === 'positive' ? 'text-emerald-400'
          : persona.sentiment === 'negative' ? 'text-red-400'
          : 'text-zinc-500'
      }`}>
        {sentimentLabel(persona.sentiment)}
      </span>
    </button>
  );
}

export default function BatchDetail() {
  const { batches, isProcessing, progress } = useCalibrationStore();
  const [selectedPersona, setSelectedPersona] = useState<PersonaBatchDetail | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Flatten all personas from all batches
  const allPersonas = useMemo(() => {
    const result: PersonaBatchDetail[] = [];
    for (const batch of batches) {
      for (const p of batch.personas) {
        result.push(p);
      }
    }
    return result;
  }, [batches]);

  // Track how many are "new" for animation
  const newStartIndex = prevCountRef.current;
  useEffect(() => {
    prevCountRef.current = allPersonas.length;
  }, [allPersonas.length]);

  // Auto-scroll to bottom as new personas arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allPersonas.length, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
  };

  // Live stats
  const pos = allPersonas.filter((p) => p.sentiment === 'positive').length;
  const neg = allPersonas.filter((p) => p.sentiment === 'negative').length;
  const neu = allPersonas.length - pos - neg;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Cpu size={14} className="text-zinc-500" />
        <h4 className="text-sm font-medium text-zinc-400">
          Processamento de Personas
        </h4>
        {isProcessing && (
          <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">Ao vivo</span>
          </span>
        )}
      </div>

      {/* Progress bar */}
      {progress.total > 0 && (
        <div className="space-y-2">
          <div className="w-full h-1 bg-zinc-800/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500/80 rounded-full transition-all duration-300"
              style={{ width: `${(progress.processed / progress.total) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="tabular-nums">{progress.processed.toLocaleString()}/{progress.total.toLocaleString()} personas</span>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-emerald-400 font-medium">{pos}+</span>
              <span className="text-zinc-500">{neu}~</span>
              <span className="text-red-400 font-medium">{neg}-</span>
            </div>
          </div>
        </div>
      )}

      {/* Waiting state */}
      {isProcessing && allPersonas.length === 0 && (
        <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <div className="w-8 h-8 rounded-xl bg-zinc-800/50 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-2 w-24 bg-zinc-800/30 rounded animate-pulse" />
          </div>
        </div>
      )}

      {/* Persona list (live feed) */}
      {allPersonas.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
          {/* Column header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            <span className="w-6 text-right shrink-0">#</span>
            <span className="w-6 shrink-0" />
            <span className="flex-1">Nome</span>
            <span className="w-8 shrink-0">UF</span>
            <span className="w-8 shrink-0">Idade</span>
            <span className="w-10 text-right shrink-0">Score</span>
            <span className="w-14 text-right shrink-0">Sent.</span>
          </div>

          {/* Scrollable persona feed */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[55vh] overflow-y-auto"
          >
            {allPersonas.map((persona, i) => (
              <PersonaRow
                key={`${persona.id}-${i}`}
                persona={persona}
                index={i}
                isNew={i >= newStartIndex}
                onClick={() => setSelectedPersona(persona)}
              />
            ))}
          </div>

          {/* Auto-scroll indicator */}
          {!autoScroll && isProcessing && (
            <div className="border-t border-white/[0.04] px-4 py-2 flex items-center justify-center">
              <button
                onClick={() => {
                  setAutoScroll(true);
                  if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors duration-200"
              >
                Rolar para as mais recentes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Comments section (latest with comments) */}
      {allPersonas.some((p) => p.comment) && !isProcessing && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-3">
            Amostra de Comentarios
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {allPersonas.filter((p) => p.comment).slice(0, 15).map((p, i) => (
              <div key={i} className="flex gap-2.5 text-xs">
                <span className={`shrink-0 font-bold tabular-nums ${scoreColor(p.score)}`}>{p.score.toFixed(1)}</span>
                <span className="text-zinc-600 shrink-0">{p.name}:</span>
                <span className="text-zinc-400 italic">&ldquo;{p.comment}&rdquo;</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down */}
      {selectedPersona && (
        <PersonaDrillDown persona={selectedPersona} onClose={() => setSelectedPersona(null)} />
      )}
    </div>
  );
}
