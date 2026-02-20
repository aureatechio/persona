'use client';

import type { ClusterResult } from '@/lib/arena';
import { MACRO_COLORS, MACRO_GROUPS } from '@/lib/arena';

interface TopClustersSummaryProps {
  clusterResults: ClusterResult[];
}

const MACRO_LABELS: Record<string, string> = {
  Progressista: 'Progressistas',
  Moderado: 'Moderados',
  Conservador: 'Conservadores',
  Transversal: 'Transversais',
};

export function TopClustersSummary({ clusterResults }: TopClustersSummaryProps) {
  if (clusterResults.length === 0) return null;

  return (
    <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-900">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">
        Clusters Ideologicos
      </p>
      <div className="space-y-3">
        {MACRO_GROUPS.map(macro => {
          const results = clusterResults.filter(r => r.macro === macro);
          if (results.length === 0) return null;

          const totalCount = results.reduce((s, r) => s + r.count, 0);
          const totalPositive = results.reduce((s, r) => s + r.positive, 0);
          const pctPositive = totalCount > 0 ? Math.round((totalPositive / totalCount) * 100) : 0;
          const colors = MACRO_COLORS[macro];

          return (
            <div key={macro} className="flex items-center gap-3">
              {/* Color dot + label */}
              <div className="flex items-center gap-2 w-28 shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                <span className={`text-xs font-bold ${colors.text}`}>
                  {MACRO_LABELS[macro]}
                </span>
              </div>

              {/* Mini sentiment bar */}
              <div className="flex-1 h-5 rounded-lg overflow-hidden flex bg-zinc-900">
                <div
                  className="h-full bg-emerald-500/70 transition-all duration-[2000ms]"
                  style={{ width: `${pctPositive}%` }}
                />
                <div
                  className="h-full bg-rose-500/70 transition-all duration-[2000ms]"
                  style={{ width: `${totalCount > 0 ? Math.round((results.reduce((s, r) => s + r.negative, 0) / totalCount) * 100) : 0}%` }}
                />
              </div>

              {/* % a favor */}
              <span className="text-xs font-black text-emerald-400 tabular-nums w-10 text-right">
                {pctPositive}%
              </span>

              {/* Count */}
              <span className="text-[10px] text-zinc-600 tabular-nums w-12 text-right">
                {totalCount.toLocaleString('pt-BR')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
