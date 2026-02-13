'use client';

import { Users } from 'lucide-react';
import type { PoliticalFigureDetection } from '@/lib/arena/types';
import { CLUSTERS } from '@/lib/arena/constants';

const FIGURE_CONFIG = {
  lula: {
    name: 'Lula (PT)',
    gradient: 'from-red-500/10 to-red-600/5',
    border: 'border-red-500/20',
    text: 'text-red-400',
    supportColor: 'text-red-400',
    attackColor: 'text-sky-400',
  },
  bolsonaro: {
    name: 'Bolsonaro',
    gradient: 'from-green-500/10 to-yellow-600/5',
    border: 'border-green-500/20',
    text: 'text-green-400',
    supportColor: 'text-green-400',
    attackColor: 'text-rose-400',
  },
};

export function PoliticalFigurePanel({ figures }: { figures: PoliticalFigureDetection[] }) {
  if (figures.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Users size={14} className="text-zinc-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Análise de Figuras Políticas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {figures.map(fig => {
          const config = FIGURE_CONFIG[fig.figure];
          const total = fig.supportCount + fig.attackCount + fig.neutralCount;
          const supportPct = total > 0 ? Math.round((fig.supportCount / total) * 100) : 0;
          const attackPct = total > 0 ? Math.round((fig.attackCount / total) * 100) : 0;
          const neutralPct = total > 0 ? Math.round((fig.neutralCount / total) * 100) : 0;

          return (
            <div
              key={fig.figure}
              className={`p-5 rounded-2xl bg-zinc-950/80 border ${config.border} backdrop-blur-sm animate-fade-in-up`}
            >
              <div className="flex items-center justify-between mb-4">
                <p className={`text-lg font-bold ${config.text}`}>{config.name}</p>
                <div className="flex items-center gap-3 text-xs font-bold tabular-nums">
                  <span className="text-emerald-400">{supportPct}% apoiam</span>
                  <span className="text-rose-400">{attackPct}% atacam</span>
                </div>
              </div>

              {/* Ratio bar */}
              <div className="h-4 rounded-full overflow-hidden flex bg-zinc-900/80 mb-4">
                <div className="h-full bg-emerald-500 transition-all duration-[2000ms] ease-out rounded-l-full flex items-center justify-center" style={{ width: `${supportPct}%` }}>
                  {supportPct > 12 && <span className="text-[9px] font-black text-white">{supportPct}%</span>}
                </div>
                <div className="h-full bg-zinc-700 transition-all duration-[2000ms] ease-out flex items-center justify-center" style={{ width: `${neutralPct}%` }}>
                  {neutralPct > 12 && <span className="text-[9px] font-black text-zinc-300">{neutralPct}%</span>}
                </div>
                <div className="h-full bg-rose-500 transition-all duration-[2000ms] ease-out rounded-r-full flex items-center justify-center" style={{ width: `${attackPct}%` }}>
                  {attackPct > 12 && <span className="text-[9px] font-black text-white">{attackPct}%</span>}
                </div>
              </div>

              {/* Clusters */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/80 mb-2">Apoiam</p>
                  <div className="flex flex-wrap gap-1">
                    {fig.supportClusters.map(cid => {
                      const cluster = CLUSTERS.find(c => c.id === cid);
                      return (
                        <span key={cid} className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                          {cid}{cluster ? ` · ${cluster.name}` : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-rose-400/80 mb-2">Atacam</p>
                  <div className="flex flex-wrap gap-1">
                    {fig.attackClusters.map(cid => {
                      const cluster = CLUSTERS.find(c => c.id === cid);
                      return (
                        <span key={cid} className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium">
                          {cid}{cluster ? ` · ${cluster.name}` : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
