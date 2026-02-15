'use client';

import type { ClusterVoteResult, CandidateColorSet } from '@/lib/arena-eleitoral/types';
import { CANDIDATE_COLORS_LEFT, CANDIDATE_COLORS_RIGHT } from '@/lib/arena-eleitoral/constants';

interface VoteByClusterChartProps {
  clusters: ClusterVoteResult[];
  nameA: string;
  nameB: string;
  colorsA?: CandidateColorSet;
  colorsB?: CandidateColorSet;
}

const MACRO_ORDER = ['Progressista', 'Moderado', 'Conservador', 'Transversal'];
const MACRO_STYLES: Record<string, string> = {
  Progressista: 'text-red-400',
  Moderado: 'text-amber-400',
  Conservador: 'text-blue-400',
  Transversal: 'text-zinc-400',
};

export function VoteByClusterChart({
  clusters,
  nameA,
  nameB,
  colorsA = CANDIDATE_COLORS_LEFT,
  colorsB = CANDIDATE_COLORS_RIGHT,
}: VoteByClusterChartProps) {
  const grouped = MACRO_ORDER.map((macro) => ({
    macro,
    clusters: clusters
      .filter((c) => c.macro === macro)
      .sort((a, b) => a.clusterId.localeCompare(b.clusterId)),
  })).filter((g) => g.clusters.length > 0);

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white tracking-tight">Votos por Cluster</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${colorsA.dot}`} />
            {nameA}
          </span>
          <span className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${colorsB.dot}`} />
            {nameB}
          </span>
        </div>
      </div>

      {grouped.map(({ macro, clusters: macroclusters }) => (
        <div key={macro} className="space-y-3">
          <p className={`text-xs font-bold uppercase tracking-widest ${MACRO_STYLES[macro]}`}>
            {macro}
          </p>
          <div className="space-y-2">
            {macroclusters.map((cluster) => {
              const effective = cluster.votesA + cluster.votesB;
              const pctA = effective > 0 ? (cluster.votesA / effective) * 100 : 50;
              const pctB = effective > 0 ? (cluster.votesB / effective) * 100 : 50;

              return (
                <div key={cluster.clusterId} className="group">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-mono text-zinc-600 w-6">{cluster.clusterId}</span>
                    <span className="text-xs text-zinc-400 flex-1 truncate">{cluster.clusterName}</span>
                    <span className="text-[10px] text-zinc-500 tabular-nums">
                      {pctA.toFixed(0)}% / {pctB.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800/30">
                    <div
                      className={`${colorsA.bar} transition-all duration-700 ease-out`}
                      style={{ width: `${pctA}%` }}
                    />
                    <div
                      className={`${colorsB.bar} transition-all duration-700 ease-out`}
                      style={{ width: `${pctB}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
