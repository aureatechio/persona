'use client';

import { useEffect, useState, useRef } from 'react';
import { X, RotateCcw, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CandidateAvatar } from '@/components/arena-eleitoral/CandidateAvatar';
import { getCandidateColors, LEANING_COLORS } from '@/lib/arena-eleitoral/constants';
import type { Politician } from '@/lib/arena-eleitoral/types';

interface CandidateWarCardProps {
  politician: Politician;
  votes: number;
  percent: number;
  prevPercent?: number;
  isActive: boolean;
  isTopGainer?: boolean;
  onToggle: (id: string) => void;
}

function useAnimatedCounter(target: number, duration = 800): number {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    const diff = target - from;
    if (diff === 0) return;

    const start = performance.now();
    const step = (ts: number) => {
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(from + diff * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prevRef.current = target;
  }, [target, duration]);

  return value;
}

export function CandidateWarCard({
  politician,
  votes,
  percent,
  prevPercent,
  isActive,
  isTopGainer = false,
  onToggle,
}: CandidateWarCardProps) {
  const colors = getCandidateColors(politician);
  const leaningColor = LEANING_COLORS[politician.leaning || 'centro'] || LEANING_COLORS.centro;
  const animatedVotes = useAnimatedCounter(votes);
  const delta = prevPercent !== undefined ? percent - prevPercent : 0;
  const showDelta = Math.abs(delta) > 0.05;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center text-center',
        'rounded-2xl p-5 md:p-6',
        'transition-all duration-500 ease-out',
        isActive
          ? 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12] shadow-xl shadow-black/20'
          : 'bg-white/[0.01] border border-red-500/15 opacity-40 grayscale',
        isTopGainer && isActive && 'shadow-[0_0_30px_-10px] shadow-emerald-500/15 border-emerald-500/20',
      )}
    >
      {/* Delta badge */}
      {isActive && showDelta && delta > 0 && (
        <div className="absolute -top-2.5 right-3 z-10">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold',
            'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
            'animate-pulse',
          )}>
            <TrendingUp size={10} />
            +{delta.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Avatar */}
      <div className="relative mb-3">
        <CandidateAvatar
          politician={politician}
          size="lg"
          showRing={isActive}
          className={cn(
            'transition-all duration-500',
            !isActive && 'opacity-50',
          )}
        />
        {!isActive && (
          <div className="absolute inset-0 rounded-full bg-red-500/25 flex items-center justify-center">
            <X size={36} className="text-red-400/80" />
          </div>
        )}
      </div>

      {/* Name */}
      <h3 className={cn(
        'text-base md:text-lg font-bold tracking-tight transition-colors duration-300',
        isActive ? 'text-white' : 'text-zinc-500',
      )}>
        {politician.name}
      </h3>

      {/* Party + Leaning */}
      <div className="flex items-center gap-1.5 mt-1 mb-4">
        {politician.party && (
          <span className="text-xs text-zinc-500">{politician.party}</span>
        )}
        <span className="text-zinc-700">·</span>
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
          isActive ? [leaningColor.bg, leaningColor.text] : 'bg-zinc-800/50 text-zinc-600',
        )}>
          {politician.leaning}
        </span>
      </div>

      {/* Vote bar or REMOVIDO */}
      {isActive ? (
        <div className="w-full mb-3">
          <div className="h-3 bg-zinc-800/60 rounded-full overflow-hidden mb-1.5">
            <div
              className={cn('h-full rounded-full transition-all duration-1000 ease-out', colors.bar)}
              style={{ width: `${Math.min(percent * 2, 100)}%` }}
            />
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-2xl font-bold text-white tabular-nums">{percent.toFixed(1)}</span>
            <span className="text-sm text-zinc-500">%</span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {animatedVotes.toLocaleString('pt-BR')} votos
          </p>
        </div>
      ) : (
        <div className="w-full mb-3 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-400/60">Removido</span>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => onToggle(politician.id)}
        className={cn(
          'w-full inline-flex items-center justify-center gap-2 px-4 py-2',
          'rounded-xl text-xs font-medium',
          'transition-all duration-200 active:scale-[0.97]',
          isActive
            ? 'bg-white/[0.04] hover:bg-red-500/10 text-zinc-400 hover:text-red-400 border border-white/[0.06] hover:border-red-500/20'
            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30',
        )}
      >
        {isActive ? (
          <>
            <X size={14} />
            Desativar
          </>
        ) : (
          <>
            <RotateCcw size={14} />
            Reativar
          </>
        )}
      </button>
    </div>
  );
}
