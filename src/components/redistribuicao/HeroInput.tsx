'use client';

import { useState, useRef } from 'react';
import { Search, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CandidateAvatar } from '@/components/arena-eleitoral/CandidateAvatar';
import { getCandidateColors } from '@/lib/arena-eleitoral/constants';
import type { Politician } from '@/lib/arena-eleitoral/types';

interface HeroInputProps {
  onSubmit: (query: string) => void;
  onSelectCandidate: (politician: Politician) => void;
  candidates: Politician[];
  compact?: boolean;
}

export function HeroInput({ onSubmit, onSelectCandidate, candidates, compact = false }: HeroInputProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (query.trim()) onSubmit(query.trim());
  };

  if (compact) {
    return (
      <div className="w-full px-4 py-3 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Search size={16} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Simular outra remoção..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
          />
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-lg transition-colors duration-200"
          >
            Simular
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
      {/* Glow orbs */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
        <Sparkles size={14} className="text-emerald-400" />
        <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">Simulador Eleitoral</span>
      </div>

      {/* Title */}
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center mb-4 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
        Redistribuição de Votos
      </h1>

      {/* Subtitle */}
      <p className="text-zinc-500 text-lg text-center mb-10 max-w-lg leading-relaxed">
        Descubra para onde vão os votos quando um candidato sai da corrida
      </p>

      {/* Glass input card */}
      <div className="w-full max-w-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-2 mb-8">
        <div className="flex items-center gap-3">
          <Search size={20} className="text-zinc-500 ml-3 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Ex: Se o Ciro sair, como os votos serão redistribuídos?"
            className="flex-1 bg-transparent text-base text-white placeholder:text-zinc-600 outline-none py-3"
          />
          <button
            onClick={handleSubmit}
            disabled={!query.trim()}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5',
              'bg-emerald-500 hover:bg-emerald-400',
              'text-black font-semibold text-sm rounded-xl',
              'shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30',
              'active:scale-[0.97] transition-all duration-200',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            )}
          >
            Simular
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Quick-select chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
        {candidates.map((p) => {
          const colors = getCandidateColors(p);
          return (
            <button
              key={p.id}
              onClick={() => onSelectCandidate(p)}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-2',
                'bg-white/[0.04] hover:bg-white/[0.08]',
                'border border-white/[0.06] hover:border-white/[0.15]',
                'rounded-full text-sm text-zinc-300 hover:text-white',
                'transition-all duration-200 active:scale-[0.97]',
              )}
            >
              <CandidateAvatar politician={p} size="sm" className="!w-6 !h-6" />
              <span className="font-medium">{p.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
