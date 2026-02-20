'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Swords } from 'lucide-react';
import type { Politician, RoundResult, CriticismCategory, CounterProposal, ElectoralComparison } from '@/lib/arena-eleitoral/types';
import { VoteResultPanel } from '@/components/arena-eleitoral/VoteResultPanel';
import { CriticismPanel } from '@/components/arena-eleitoral/CriticismPanel';
import { ProposalEditor } from '@/components/arena-eleitoral/ProposalEditor';
import { ComparisonDashboard } from '@/components/arena-eleitoral/ComparisonDashboard';

interface ElectoralResultBlockProps {
  data: {
    candidateA: Politician;
    candidateB: Politician;
    result: RoundResult;
    round: number;
    criticisms: CriticismCategory[];
    proposals: CounterProposal[];
    shifts: any[];
    comparison: ElectoralComparison | null;
    onReSimulate?: (proposals: CounterProposal[]) => void;
  };
}

export function ElectoralResultBlock({ data }: ElectoralResultBlockProps) {
  const { candidateA, candidateB, result, round, criticisms, comparison } = data;
  const [expanded, setExpanded] = useState(true);
  const [showProposals, setShowProposals] = useState(false);
  const [proposals, setProposals] = useState(data.proposals);

  const winnerName = result.winner === 'candidateA' ? candidateA.name : result.winner === 'candidateB' ? candidateB.name : 'Empate';
  const loserName = result.winner === 'candidateA' ? candidateB.name : result.winner === 'candidateB' ? candidateA.name : '';
  const loserData = result.winner === 'candidateA' ? candidateB : result.winner === 'candidateB' ? candidateA : null;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors duration-200"
      >
        <div className="text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">
            <Swords size={10} className="inline mr-1" />
            Arena Eleitoral • Round {round}
          </p>
          <p className="text-sm font-semibold text-white">
            {candidateA.name} vs {candidateB.name}
          </p>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-500">
            <span>{result.totalVoters.toLocaleString('pt-BR')} eleitores</span>
            <span className="font-bold text-emerald-400">
              Vencedor: {winnerName} ({result.winner === 'candidateA' ? result.percentA : result.percentB}%)
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
      </button>

      {expanded && (
        <div className="px-5 pb-6 space-y-6">
          <VoteResultPanel candidateA={candidateA} candidateB={candidateB} result={result} />

          {criticisms.length > 0 && (
            <CriticismPanel criticisms={criticisms} winnerName={winnerName} />
          )}

          {comparison && (
            <ComparisonDashboard
              candidateA={candidateA}
              candidateB={candidateB}
              comparison={comparison}
              roundHistory={[]}
              onNewRound={() => setShowProposals(true)}
            />
          )}

          {proposals.length > 0 && !showProposals && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowProposals(true)}
                className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.97] transition-all duration-200"
              >
                Ver Propostas Estrategicas
              </button>
            </div>
          )}

          {showProposals && proposals.length > 0 && (
            <ProposalEditor
              proposals={proposals}
              loserName={loserName}
              loserParty={loserData?.party}
              loserLeaning={loserData?.leaning}
              winnerName={winnerName}
              criticisms={criticisms}
              onToggle={(id) => setProposals(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))}
              onEditDescription={(id, desc) => setProposals(prev => prev.map(p => p.id === id ? { ...p, description: desc } : p))}
              onReSimulate={() => {
                if (data.onReSimulate) data.onReSimulate(proposals);
                setShowProposals(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
