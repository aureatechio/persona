'use client';

import { TrendingUp, TrendingDown, ArrowRight, ArrowLeftRight, RotateCcw, ChevronRight } from 'lucide-react';
import type { Politician, ElectoralComparison, RoundHistoryEntry } from '@/lib/arena-eleitoral/types';
import { getCandidateColors } from '@/lib/arena-eleitoral/constants';
import { TugOfWarBar } from './TugOfWarBar';

interface ComparisonDashboardProps {
  candidateA: Politician;
  candidateB: Politician;
  comparison: ElectoralComparison;
  roundHistory: RoundHistoryEntry[];
  onNewRound: () => void;
}

function DeltaCard({
  label,
  previous,
  current,
  format = 'number',
}: {
  label: string;
  previous: number;
  current: number;
  format?: 'number' | 'percent';
}) {
  const delta = current - previous;
  const isPositive = delta > 0;
  const isZero = delta === 0;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="flex items-end gap-3">
        <span className="text-2xl font-bold text-white">
          {format === 'percent' ? `${current.toFixed(1)}%` : current.toLocaleString()}
        </span>
        {!isZero && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold pb-1 ${
            isPositive ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isPositive ? '+' : ''}{format === 'percent' ? `${delta.toFixed(1)}%` : delta.toLocaleString()}
          </span>
        )}
      </div>
      <span className="text-[10px] text-zinc-600">
        Anterior: {format === 'percent' ? `${previous.toFixed(1)}%` : previous.toLocaleString()}
      </span>
    </div>
  );
}

export function ComparisonDashboard({
  candidateA,
  candidateB,
  comparison,
  roundHistory,
  onNewRound,
}: ComparisonDashboardProps) {
  const { previousRound, currentRound, shifts, totalFlipped, flippedToA, flippedToB, netGainA, netGainB } = comparison;

  const colorsA = getCandidateColors(candidateA);
  const colorsB = getCandidateColors(candidateB);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500/5 via-white/[0.02] to-sky-500/5 border border-white/[0.06] rounded-2xl p-6 md:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-white tracking-tight">Comparativo de Rodadas</h3>
          <p className="text-sm text-zinc-400">
            Round {previousRound.roundNumber} vs Round {currentRound.roundNumber}
          </p>
        </div>

        {/* Before → After */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 md:gap-8 items-center">
          {/* Before */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">Antes</p>
            <TugOfWarBar
              votesA={previousRound.votesA}
              votesB={previousRound.votesB}
              nameA={candidateA.name}
              nameB={candidateB.name}
              colorsA={colorsA}
              colorsB={colorsB}
            />
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight size={24} className="text-emerald-400" />
          </div>

          {/* After */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">Depois</p>
            <TugOfWarBar
              votesA={currentRound.votesA}
              votesB={currentRound.votesB}
              nameA={candidateA.name}
              nameB={candidateB.name}
              colorsA={colorsA}
              colorsB={colorsB}
            />
          </div>
        </div>
      </div>

      {/* Delta Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DeltaCard
          label={candidateA.name}
          previous={previousRound.percentA}
          current={currentRound.percentA}
          format="percent"
        />
        <DeltaCard
          label={candidateB.name}
          previous={previousRound.percentB}
          current={currentRound.percentB}
          format="percent"
        />
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total Mudaram</span>
          <span className="text-2xl font-bold text-white block">{totalFlipped}</span>
          <span className="text-[10px] text-zinc-600">eleitores trocaram de voto</span>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Saldo Líquido</span>
          <span className={`text-2xl font-bold block ${netGainA > 0 ? colorsA.primary : netGainB > 0 ? colorsB.primary : 'text-zinc-400'}`}>
            {netGainA > 0 ? `+${netGainA} ${candidateA.name}` : netGainB > 0 ? `+${netGainB} ${candidateB.name}` : 'Empate'}
          </span>
        </div>
      </div>

      {/* Flow Summary */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
          <ArrowLeftRight size={18} />
          Fluxo de Votos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-xl p-4 ${colorsA.bg} border ${colorsA.border}`}>
            <p className={`text-sm font-semibold ${colorsA.primary}`}>
              {flippedToA} eleitores migraram para {candidateA.name}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Vindos de {candidateB.name} e abstenção</p>
          </div>
          <div className={`rounded-xl p-4 ${colorsB.bg} border ${colorsB.border}`}>
            <p className={`text-sm font-semibold ${colorsB.primary}`}>
              {flippedToB} eleitores migraram para {candidateB.name}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Vindos de {candidateA.name} e abstenção</p>
          </div>
        </div>
      </div>

      {/* Voter Shift Cards */}
      {shifts.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white tracking-tight">
            Eleitores que Mudaram ({shifts.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {shifts.slice(0, 30).map((shift, i) => {
              const newColors = shift.newVote === 'candidateA' ? colorsA
                : shift.newVote === 'candidateB' ? colorsB : null;
              const prevColors = shift.previousVote === 'candidateA' ? colorsA
                : shift.previousVote === 'candidateB' ? colorsB : null;
              return (
                <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    newColors ? `${newColors.bgSolid} text-white` : 'bg-zinc-700 text-zinc-300'
                  }`}>
                    {shift.personaName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{shift.personaName}</p>
                    <p className="text-[10px] text-zinc-500">
                      {shift.age}a · {shift.state} · {shift.clusterName} ({shift.clusterId})
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      prevColors ? `${prevColors.bg} ${prevColors.primary}` : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {shift.previousVote === 'candidateA' ? candidateA.name : shift.previousVote === 'candidateB' ? candidateB.name : 'Abs'}
                    </span>
                    <ArrowRight size={14} className="text-emerald-400" />
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      newColors ? `${newColors.bg} ${newColors.primary}` : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {shift.newVote === 'candidateA' ? candidateA.name : shift.newVote === 'candidateB' ? candidateB.name : 'Abs'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Round History Timeline */}
      {roundHistory.length > 1 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white tracking-tight">Evolução por Rodada</h3>
          <div className="space-y-3">
            {roundHistory.map((entry, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === roundHistory.length - 1 ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {entry.roundNumber}
                </div>
                <div className="flex-1">
                  <TugOfWarBar
                    votesA={entry.votesA}
                    votesB={entry.votesB}
                    nameA={candidateA.name}
                    nameB={candidateB.name}
                    colorsA={colorsA}
                    colorsB={colorsB}
                    height="h-2"
                    showLabels={false}
                  />
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-zinc-400 tabular-nums">
                    {entry.percentA.toFixed(1)}% / {entry.percentB.toFixed(1)}%
                  </p>
                  {entry.shiftsCount > 0 && (
                    <p className="text-[10px] text-emerald-400">+{entry.shiftsCount} mudanças</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Round Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onNewRound}
          className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.97] transition-all duration-200"
        >
          <RotateCcw size={20} />
          Ajustar Propostas e Re-simular
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
