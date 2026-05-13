'use client';

import { XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CandidateAvatar } from '@/components/arena-eleitoral/CandidateAvatar';
import { getCandidateColors, LEANING_COLORS } from '@/lib/arena-eleitoral/constants';
import type { Politician } from '@/lib/arena-eleitoral/types';

interface RemovedCandidateCardProps {
  politician: Politician;
  votes: number;
  percent: number;
  totalRedistributed: number;
}

export function RemovedCandidateCard({ politician, votes, percent, totalRedistributed }: RemovedCandidateCardProps) {
  const colors = getCandidateColors(politician);
  const leaningColor = LEANING_COLORS[politician.leaning || 'centro'] || LEANING_COLORS.centro;

  return (
    <div className={cn(
      'relative w-full',
      'bg-white/[0.03] backdrop-blur-2xl',
      'border border-red-500/20',
      'rounded-2xl p-6 md:p-8',
      'shadow-[0_0_60px_-15px] shadow-red-500/10',
    )}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Avatar + Info */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <CandidateAvatar politician={politician} size="lg" />
            <div className="absolute inset-0 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle size={32} className="text-red-400" />
            </div>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{politician.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {politician.party && (
                <span className="text-sm text-zinc-400">{politician.party}</span>
              )}
              <span className="text-zinc-700">·</span>
              <span className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                leaningColor.bg, leaningColor.text, leaningColor.border, 'border',
              )}>
                {politician.leaning}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Votos originais</p>
            <p className="text-2xl font-bold text-white">{votes.toLocaleString('pt-BR')}</p>
            <p className="text-sm text-zinc-400">{percent.toFixed(1)}% do total</p>
          </div>
          <div className="h-12 w-px bg-gradient-to-b from-transparent via-zinc-700/50 to-transparent" />
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Redistribuídos</p>
            <p className="text-2xl font-bold text-red-400">{totalRedistributed.toLocaleString('pt-BR')}</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-xs font-medium text-red-400">
              Removido
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
