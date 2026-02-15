'use client';

import { Loader2, Search, Brain, Users, Vote } from 'lucide-react';
import type { Politician, ElectoralSSEProgress } from '@/lib/arena-eleitoral/types';
import { getCandidateColors } from '@/lib/arena-eleitoral/constants';
import { CandidateAvatar } from './CandidateAvatar';
import { TugOfWarBar } from './TugOfWarBar';

interface ElectoralProcessingProps {
  candidateA: Politician;
  candidateB: Politician;
  pipelinePhase: string;
  progress: ElectoralSSEProgress | null;
}

const PHASE_INFO: Record<string, { icon: React.ElementType; label: string }> = {
  researching: { icon: Search, label: 'Pesquisando notícias atuais...' },
  building_context: { icon: Brain, label: 'Criando contexto com IA...' },
  loading_personas: { icon: Users, label: 'Carregando personas...' },
  voting: { icon: Vote, label: 'Processando votos...' },
  extracting_criticisms: { icon: Brain, label: 'Extraindo críticas...' },
  generating_proposals: { icon: Brain, label: 'Gerando propostas...' },
};

export function ElectoralProcessing({
  candidateA,
  candidateB,
  pipelinePhase,
  progress,
}: ElectoralProcessingProps) {
  const phaseInfo = PHASE_INFO[pipelinePhase] || { icon: Loader2, label: 'Processando...' };
  const PhaseIcon = phaseInfo.icon;

  const colorsA = getCandidateColors(candidateA);
  const colorsB = getCandidateColors(candidateB);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Animated Orb */}
      <div className="flex justify-center">
        <div className="relative">
          {/* Outer glow */}
          <div className="absolute -inset-8 bg-gradient-to-r from-rose-500/10 via-white/[0.02] to-sky-500/10 rounded-full blur-2xl animate-pulse" />

          {/* Rings */}
          <div className="absolute -inset-6 rounded-full border border-white/[0.04] animate-[ping_3s_ease-in-out_infinite]" />
          <div className="absolute -inset-3 rounded-full border border-white/[0.06] animate-[ping_2s_ease-in-out_infinite_0.5s]" />

          {/* Core */}
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-rose-500/20 to-sky-500/20 border border-white/[0.1] flex items-center justify-center backdrop-blur-xl">
            <PhaseIcon size={32} className="text-white animate-pulse" />
          </div>
        </div>
      </div>

      {/* Phase Label */}
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold text-white">{phaseInfo.label}</p>
        {progress && (
          <p className="text-sm text-zinc-400">
            {progress.processed} de {progress.total} personas processadas
          </p>
        )}
      </div>

      {/* VS Header with live counters */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center mb-6">
          {/* Candidate A */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <CandidateAvatar politician={candidateA} size="md" />
            </div>
            <p className="text-sm font-semibold text-white">{candidateA.name}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{candidateA.party}</p>
            {progress && (
              <p className={`text-2xl font-bold tabular-nums ${colorsA.primary}`}>
                {progress.votesA.toLocaleString()}
              </p>
            )}
          </div>

          {/* VS */}
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <span className="text-sm font-black text-zinc-400">VS</span>
          </div>

          {/* Candidate B */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <CandidateAvatar politician={candidateB} size="md" />
            </div>
            <p className="text-sm font-semibold text-white">{candidateB.name}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{candidateB.party}</p>
            {progress && (
              <p className={`text-2xl font-bold tabular-nums ${colorsB.primary}`}>
                {progress.votesB.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Live Tug of War */}
        {progress && progress.votesA + progress.votesB > 0 && (
          <TugOfWarBar
            votesA={progress.votesA}
            votesB={progress.votesB}
            nameA={candidateA.name}
            nameB={candidateB.name}
            colorsA={colorsA}
            colorsB={colorsB}
          />
        )}

        {/* Progress bar */}
        {progress && (
          <div className="mt-4">
            <div className="w-full h-1.5 rounded-full bg-zinc-800/50 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${(progress.processed / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-600 mt-1 text-right">
              {Math.round((progress.processed / progress.total) * 100)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
