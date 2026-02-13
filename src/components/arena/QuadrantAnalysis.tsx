'use client';

import type { QuadrantResult, Quadrant } from '@/lib/arena/types';
import { CLUSTERS } from '@/lib/arena/constants';

const QUADRANT_CONFIG: Record<Quadrant, { icon: string; gradient: string; border: string; text: string; bg: string }> = {
  esq_progressista: { icon: '🟢', gradient: 'from-emerald-500/10 to-emerald-600/5', border: 'border-emerald-500/20', text: 'text-emerald-400', bg: 'bg-emerald-500' },
  esq_conservador: { icon: '🟡', gradient: 'from-amber-500/10 to-amber-600/5', border: 'border-amber-500/20', text: 'text-amber-400', bg: 'bg-amber-500' },
  dir_conservador: { icon: '🔴', gradient: 'from-rose-500/10 to-rose-600/5', border: 'border-rose-500/20', text: 'text-rose-400', bg: 'bg-rose-500' },
  dir_progressista: { icon: '🔵', gradient: 'from-indigo-500/10 to-indigo-600/5', border: 'border-indigo-500/20', text: 'text-indigo-400', bg: 'bg-indigo-500' },
};

const QUADRANT_ORDER: Quadrant[] = ['esq_progressista', 'dir_progressista', 'esq_conservador', 'dir_conservador'];

export function QuadrantAnalysis({ quadrants }: { quadrants: QuadrantResult[] }) {
  if (quadrants.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-sm bg-white/50" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Análise por Quadrante Ideológico
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANT_ORDER.map((qKey, idx) => {
          const q = quadrants.find(x => x.quadrant === qKey);
          if (!q) return null;
          const config = QUADRANT_CONFIG[qKey];
          const pctPos = q.count > 0 ? Math.round((q.positive / q.count) * 100) : 0;
          const pctNeg = q.count > 0 ? Math.round((q.negative / q.count) * 100) : 0;
          const pctNeu = q.count > 0 ? Math.round((q.neutral / q.count) * 100) : 0;

          return (
            <div
              key={qKey}
              className={`p-5 rounded-2xl bg-zinc-950/80 border ${config.border} backdrop-blur-sm animate-fade-in-up`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`text-sm font-bold ${config.text}`}>{q.label}</p>
                  <p className="text-[10px] text-zinc-500">{q.count.toLocaleString('pt-BR')} personas</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-400 tabular-nums">{pctPos}%</p>
                  <p className="text-[9px] text-zinc-600">a favor</p>
                </div>
              </div>

              {/* Sentiment bar */}
              <div className="h-2.5 rounded-full overflow-hidden flex bg-zinc-900/80 mb-3">
                <div className="h-full bg-emerald-500 transition-all duration-[2000ms] ease-out rounded-l-full" style={{ width: `${pctPos}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-[2000ms] ease-out" style={{ width: `${pctNeu}%` }} />
                <div className="h-full bg-rose-500 transition-all duration-[2000ms] ease-out rounded-r-full" style={{ width: `${pctNeg}%` }} />
              </div>

              {/* Dominant clusters */}
              <div className="flex flex-wrap gap-1.5">
                {q.dominantClusters.map(cid => {
                  const cluster = CLUSTERS.find(c => c.id === cid);
                  return (
                    <span key={cid} className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-400 font-medium">
                      {cid}{cluster ? ` · ${cluster.name}` : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
