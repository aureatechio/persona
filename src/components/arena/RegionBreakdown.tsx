'use client';

import { MapPin } from 'lucide-react';
import type { RegionResult } from '@/lib/arena/types';

const REGION_COLORS: Record<string, string> = {
  'Norte': '#22d3ee',
  'Nordeste': '#f59e0b',
  'Centro-Oeste': '#a78bfa',
  'Sudeste': '#10b981',
  'Sul': '#3b82f6',
};

const REGION_ORDER = ['Sudeste', 'Nordeste', 'Sul', 'Norte', 'Centro-Oeste'];

export function RegionBreakdown({ regions }: { regions: RegionResult[] }) {
  if (regions.length === 0) return null;

  const sorted = [...regions].sort(
    (a, b) => REGION_ORDER.indexOf(a.region) - REGION_ORDER.indexOf(b.region)
  );

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <MapPin size={14} className="text-zinc-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Breakdown Regional
        </p>
      </div>

      <div className="rounded-2xl bg-zinc-950/80 border border-white/[0.06] p-5 backdrop-blur-sm animate-fade-in-up space-y-5">
        {sorted.map((region, idx) => {
          const color = REGION_COLORS[region.region] || '#71717a';
          const pctPos = region.count > 0 ? Math.round((region.positive / region.count) * 100) : 0;
          const pctNeg = region.count > 0 ? Math.round((region.negative / region.count) * 100) : 0;
          const pctNeu = region.count > 0 ? Math.round((region.neutral / region.count) * 100) : 0;

          return (
            <div key={region.region}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm text-zinc-300 font-medium">{region.region}</span>
                  <span className="text-[10px] text-zinc-600">({region.count.toLocaleString('pt-BR')})</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold tabular-nums">
                  <span className="text-emerald-400">{pctPos}%</span>
                  <span className="text-amber-400">{pctNeu}%</span>
                  <span className="text-rose-400">{pctNeg}%</span>
                </div>
              </div>
              <div className="h-3 rounded-full overflow-hidden flex bg-zinc-900/80">
                <div
                  className="h-full bg-emerald-500 transition-all duration-[1500ms] ease-out rounded-l-full"
                  style={{ width: `${pctPos}%`, transitionDelay: `${idx * 100}ms` }}
                />
                <div
                  className="h-full bg-amber-500 transition-all duration-[1500ms] ease-out"
                  style={{ width: `${pctNeu}%`, transitionDelay: `${idx * 100}ms` }}
                />
                <div
                  className="h-full bg-rose-500 transition-all duration-[1500ms] ease-out rounded-r-full"
                  style={{ width: `${pctNeg}%`, transitionDelay: `${idx * 100}ms` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
