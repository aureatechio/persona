'use client';

import { Trophy } from 'lucide-react';
import type { Politician, RoundResult } from '@/lib/arena-eleitoral/types';
import { getCandidateColors } from '@/lib/arena-eleitoral/constants';
import { CandidateAvatar } from './CandidateAvatar';
import { TugOfWarBar } from './TugOfWarBar';
import { VoteByClusterChart } from './VoteByClusterChart';
import { useState } from 'react';

interface VoteResultPanelProps {
  candidateA: Politician;
  candidateB: Politician;
  result: RoundResult;
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}

export function VoteResultPanel({ candidateA, candidateB, result }: VoteResultPanelProps) {
  const [commentFilter, setCommentFilter] = useState<'all' | 'candidateA' | 'candidateB' | 'abstain'>('all');
  const [commentsToShow, setCommentsToShow] = useState(20);

  const colorsA = getCandidateColors(candidateA);
  const colorsB = getCandidateColors(candidateB);

  const winnerName = result.winner === 'candidateA' ? candidateA.name
    : result.winner === 'candidateB' ? candidateB.name : 'Empate';

  const filteredComments = result.votes.filter((v) => {
    if (commentFilter === 'all') return v.comment && v.comment !== '...' && v.comment !== '';
    return v.vote === commentFilter && v.comment && v.comment !== '...' && v.comment !== '';
  });

  return (
    <div className="space-y-8">
      {/* VS Header */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 md:p-8">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 md:gap-8 items-center mb-6">
          {/* Candidate A */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <CandidateAvatar
                politician={candidateA}
                size="md"
                showRing={result.winner === 'candidateA'}
              />
            </div>
            <p className="text-sm font-semibold text-white">{candidateA.name}</p>
            <p className="text-[10px] text-zinc-500 uppercase">{candidateA.party}</p>
            <p className={`text-4xl font-bold tabular-nums ${colorsA.primary}`}>
              {result.percentA}%
            </p>
            <p className="text-xs text-zinc-500">{result.votesA.toLocaleString()} votos</p>
            {result.winner === 'candidateA' && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                <Trophy size={12} />
                Vencedor
              </div>
            )}
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <span className="text-base font-black text-zinc-400">VS</span>
            </div>
            <p className="text-[10px] text-zinc-600">Round {result.roundNumber}</p>
          </div>

          {/* Candidate B */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <CandidateAvatar
                politician={candidateB}
                size="md"
                showRing={result.winner === 'candidateB'}
              />
            </div>
            <p className="text-sm font-semibold text-white">{candidateB.name}</p>
            <p className="text-[10px] text-zinc-500 uppercase">{candidateB.party}</p>
            <p className={`text-4xl font-bold tabular-nums ${colorsB.primary}`}>
              {result.percentB}%
            </p>
            <p className="text-xs text-zinc-500">{result.votesB.toLocaleString()} votos</p>
            {result.winner === 'candidateB' && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                <Trophy size={12} />
                Vencedor
              </div>
            )}
          </div>
        </div>

        {/* Main Tug of War */}
        <TugOfWarBar
          votesA={result.votesA}
          votesB={result.votesB}
          nameA={candidateA.name}
          nameB={candidateB.name}
          colorsA={colorsA}
          colorsB={colorsB}
          height="h-4"
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <StatCard label="Total" value={result.totalVoters.toLocaleString()} sub="personas" color="text-white" />
          <StatCard label="Margem" value={`${Math.abs(result.percentA - result.percentB).toFixed(1)}%`} sub={`${Math.abs(result.votesA - result.votesB)} votos`} color="text-emerald-400" />
          <StatCard label="Abstenção" value={result.abstentions.toLocaleString()} sub={`${((result.abstentions / result.totalVoters) * 100).toFixed(1)}%`} color="text-zinc-400" />
        </div>
      </div>

      {/* Cluster Breakdown */}
      <VoteByClusterChart
        clusters={result.byCluster}
        nameA={candidateA.name}
        nameB={candidateB.name}
        colorsA={colorsA}
        colorsB={colorsB}
      />

      {/* Region Breakdown */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white tracking-tight">Votos por Região</h3>
        <div className="space-y-3">
          {result.byRegion.map((r) => {
            const effective = r.votesA + r.votesB;
            const pctA = effective > 0 ? (r.votesA / effective) * 100 : 50;
            return (
              <div key={r.region}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-zinc-300">{r.region}</span>
                  <span className="text-xs text-zinc-500">{r.total} personas</span>
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-zinc-800/30">
                  <div className={`${colorsA.bar} transition-all duration-700`} style={{ width: `${pctA}%` }} />
                  <div className={`${colorsB.bar} transition-all duration-700`} style={{ width: `${100 - pctA}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generation Breakdown */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white tracking-tight">Votos por Geração</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {result.byGeneration.map((g) => {
            const effective = g.votesA + g.votesB;
            const pctA = effective > 0 ? (g.votesA / effective) * 100 : 50;
            return (
              <div key={g.generation} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-white">{g.generation}</p>
                <p className="text-[10px] text-zinc-500">Idade média: {g.avgAge}</p>
                <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800/30">
                  <div className={`${colorsA.bar}`} style={{ width: `${pctA}%` }} />
                  <div className={`${colorsB.bar}`} style={{ width: `${100 - pctA}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>{pctA.toFixed(0)}%</span>
                  <span>{(100 - pctA).toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white tracking-tight">Justificativas dos Eleitores</h3>
          <div className="flex items-center gap-2">
            {(['all', 'candidateA', 'candidateB', 'abstain'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCommentFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  commentFilter === f
                    ? 'bg-white/[0.1] text-white border border-white/[0.15]'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'candidateA' ? candidateA.name : f === 'candidateB' ? candidateB.name : 'Abstenção'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {filteredComments.slice(0, commentsToShow).map((vote, i) => {
            const voteColors = vote.vote === 'candidateA' ? colorsA
              : vote.vote === 'candidateB' ? colorsB : null;
            return (
              <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    voteColors ? `${voteColors.bgSolid} text-white` : 'bg-zinc-700 text-zinc-300'
                  }`}>
                    {vote.personaName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{vote.personaName}</p>
                    <p className="text-[10px] text-zinc-500">
                      {vote.age}a · {vote.state} · {vote.generation} · {vote.clusterId}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    voteColors ? `${voteColors.bg} ${voteColors.primary}` : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {vote.vote === 'candidateA' ? candidateA.name : vote.vote === 'candidateB' ? candidateB.name : 'Abstenção'}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{vote.comment}</p>
                {vote.criticisms && vote.criticisms.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {vote.criticisms.map((c, j) => (
                      <span key={j} className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] border border-amber-500/20">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {filteredComments.length > commentsToShow && (
          <button
            onClick={() => setCommentsToShow((prev) => prev + 20)}
            className="w-full py-3 text-sm text-zinc-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.05] rounded-xl border border-white/[0.04] transition-all duration-200"
          >
            Carregar mais ({filteredComments.length - commentsToShow} restantes)
          </button>
        )}
      </div>
    </div>
  );
}
