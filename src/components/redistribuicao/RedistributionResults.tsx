'use client';

import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RemovedCandidateCard } from './RemovedCandidateCard';
import { FlowBars } from './FlowBars';
import { RecipientCard } from './RecipientCard';
import type { RedistributionResult } from '@/lib/arena-eleitoral/redistribution';

interface RedistributionResultsProps {
  result: RedistributionResult;
  onReset: () => void;
}

export function RedistributionResults({ result, onReset }: RedistributionResultsProps) {
  const topGainer = result.candidates[0];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Removed candidate header */}
      <RemovedCandidateCard
        politician={result.removedCandidate.politician}
        votes={result.removedCandidate.votes}
        percent={result.removedCandidate.percent}
        totalRedistributed={result.totalRedistributed}
      />

      {/* Flow bars */}
      <FlowBars
        candidates={result.candidates}
        removedName={result.removedCandidate.politician.name}
      />

      {/* Candidate grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {result.candidates.map((c, i) => (
          <RecipientCard key={c.politician.id} candidate={c} index={i} />
        ))}
      </div>

      {/* Footer summary */}
      <div className={cn(
        'bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6',
        'flex flex-col md:flex-row md:items-center justify-between gap-4',
      )}>
        <div>
          <p className="text-zinc-300">
            <span className="font-bold text-white">{result.totalRedistributed.toLocaleString('pt-BR')}</span> votos
            redistribuídos entre <span className="font-bold text-white">{result.candidates.length}</span> candidatos
          </p>
          {topGainer && (
            <p className="text-sm text-zinc-500 mt-1">
              Maior beneficiado: <span className="text-emerald-400 font-medium">{topGainer.politician.name}</span>{' '}
              <span className="text-emerald-400/70">(+{topGainer.delta.toFixed(1)}%)</span>
            </p>
          )}
        </div>
        <button
          onClick={onReset}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5',
            'bg-white/[0.05] hover:bg-white/[0.1]',
            'text-zinc-300 hover:text-white',
            'border border-white/[0.08] hover:border-white/[0.15]',
            'rounded-xl font-medium text-sm',
            'active:scale-[0.97] transition-all duration-200',
          )}
        >
          <RotateCcw size={16} />
          Simular outra remoção
        </button>
      </div>
    </div>
  );
}
