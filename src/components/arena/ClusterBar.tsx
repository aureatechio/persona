'use client';

import type { ClusterResult } from '@/lib/arena/types';
import { MACRO_COLORS } from '@/lib/arena/constants';

export function ClusterBar({ result }: { result: ClusterResult }) {
  const colors = MACRO_COLORS[result.macro];
  const pctPositive = result.count > 0 ? Math.round((result.positive / result.count) * 100) : 0;
  const pctNegative = result.count > 0 ? Math.round((result.negative / result.count) * 100) : 0;
  const pctNeutral = result.count > 0 ? Math.round((result.neutral / result.count) * 100) : 0;

  return (
    <div className={`p-4 rounded-2xl bg-zinc-950 border border-zinc-900 ${colors.border} animate-fade-in-up`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}>
          <span className={`text-xs font-black ${colors.text}`}>{result.id}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{result.name}</p>
          <p className="text-[10px] text-zinc-500">{result.count.toLocaleString('pt-BR')} personas</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-black text-emerald-400">{pctPositive}%</p>
          <p className="text-[9px] text-zinc-600">a favor</p>
        </div>
      </div>

      <div className="h-2.5 rounded-full overflow-hidden flex bg-zinc-900/80">
        <div className="h-full bg-emerald-500 transition-all duration-[2000ms] ease-out rounded-l-full" style={{ width: `${pctPositive}%` }} />
        <div className="h-full bg-amber-500 transition-all duration-[2000ms] ease-out" style={{ width: `${pctNeutral}%` }} />
        <div className="h-full bg-rose-500 transition-all duration-[2000ms] ease-out rounded-r-full" style={{ width: `${pctNegative}%` }} />
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-[9px] font-bold text-emerald-400/80">{pctPositive}% favor</span>
        <span className="text-[9px] font-bold text-amber-400/80">{pctNeutral}% neutro</span>
        <span className="text-[9px] font-bold text-rose-400/80">{pctNegative}% contra</span>
      </div>
    </div>
  );
}
