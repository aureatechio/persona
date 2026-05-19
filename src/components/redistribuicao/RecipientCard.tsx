'use client';

import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CandidateAvatar } from '@/components/arena-eleitoral/CandidateAvatar';
import { getCandidateColors, LEANING_COLORS } from '@/lib/arena-eleitoral/constants';
import type { RedistributionCandidate } from '@/lib/arena-eleitoral/redistribution';

interface RecipientCardProps {
  candidate: RedistributionCandidate;
  index: number;
  animate?: boolean;
}

export function RecipientCard({ candidate, index, animate = true }: RecipientCardProps) {
  const { politician, percentBefore, percentAfter, gained, percentOfRedistribution, delta } = candidate;
  const colors = getCandidateColors(politician);
  const leaningColor = LEANING_COLORS[politician.leaning || 'centro'] || LEANING_COLORS.centro;
  const isTopGainer = index === 0;

  return (
    <div
      className={cn(
        'group relative',
        'bg-white/[0.03] hover:bg-white/[0.06]',
        'border border-white/[0.06] hover:border-white/[0.12]',
        'rounded-2xl p-5 md:p-6',
        'shadow-xl shadow-black/20 hover:shadow-2xl',
        'transition-all duration-300 ease-out',
        'hover:-translate-y-1',
        isTopGainer && 'border-emerald-500/20 shadow-[0_0_40px_-15px] shadow-emerald-500/10',
      )}
      style={animate ? { animationDelay: `${index * 80}ms` } : undefined}
    >
      {/* Top gainer badge */}
      {isTopGainer && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-xs font-semibold text-emerald-400">
            <TrendingUp size={12} />
            Maior beneficiado
          </span>
        </div>
      )}

      {/* Header: Avatar + Name + Delta */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <CandidateAvatar politician={politician} size="md" />
          <div>
            <h3 className="text-lg font-semibold text-white">{politician.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {politician.party && (
                <span className="text-xs text-zinc-500">{politician.party}</span>
              )}
              <span className="text-zinc-700">·</span>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                leaningColor.bg, leaningColor.text,
              )}>
                {politician.leaning}
              </span>
            </div>
          </div>
        </div>
        <span className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1',
          'rounded-full text-sm font-bold',
          delta > 2 ? 'bg-emerald-500/15 text-emerald-400' :
          delta > 0.5 ? 'bg-emerald-500/10 text-emerald-400/80' :
          'bg-zinc-800/50 text-zinc-400',
        )}>
          +{delta.toFixed(1)}%
        </span>
      </div>

      {/* Before/After Bars */}
      <div className="space-y-3 mb-4">
        {/* Before */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Antes</span>
            <span className="text-xs font-medium text-zinc-400">{percentBefore.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 bg-zinc-800/60 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full opacity-50', colors.bar)}
              style={{ width: `${Math.min(percentBefore, 100)}%` }}
            />
          </div>
        </div>

        {/* After */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Depois</span>
            <span className="text-xs font-bold text-white">{percentAfter.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 bg-zinc-800/60 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-1000 ease-out', colors.bar)}
              style={{ width: `${Math.min(percentAfter, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="pt-3 border-t border-white/[0.06]">
        <p className="text-sm text-zinc-300">
          Recebeu <span className="font-semibold text-white">{gained.toLocaleString('pt-BR')}</span> votos
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {percentOfRedistribution.toFixed(1)}% da base redistribuída
        </p>
      </div>
    </div>
  );
}
