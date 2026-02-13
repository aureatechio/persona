'use client';

import { Users } from 'lucide-react';
import type { GenerationResult } from '@/lib/arena/types';

const GENERATION_CONFIG: Record<string, { color: string; border: string; bg: string; text: string }> = {
  'Gen Z': { color: '#22d3ee', border: 'border-cyan-500/20', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  'Millennial': { color: '#a78bfa', border: 'border-violet-500/20', bg: 'bg-violet-500/10', text: 'text-violet-400' },
  'Gen X': { color: '#f59e0b', border: 'border-amber-500/20', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  'Boomer': { color: '#ef4444', border: 'border-red-500/20', bg: 'bg-red-500/10', text: 'text-red-400' },
};

const GEN_ORDER = ['Gen Z', 'Millennial', 'Gen X', 'Boomer'];

export function GenerationBreakdown({ generations }: { generations: GenerationResult[] }) {
  if (generations.length === 0) return null;

  const sorted = [...generations].sort(
    (a, b) => GEN_ORDER.indexOf(a.generation) - GEN_ORDER.indexOf(b.generation)
  );

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Users size={14} className="text-zinc-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Breakdown Geracional
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sorted.map((gen, idx) => {
          const config = GENERATION_CONFIG[gen.generation] || { color: '#71717a', border: 'border-zinc-500/20', bg: 'bg-zinc-500/10', text: 'text-zinc-400' };
          const pctPos = gen.count > 0 ? Math.round((gen.positive / gen.count) * 100) : 0;
          const pctNeg = gen.count > 0 ? Math.round((gen.negative / gen.count) * 100) : 0;
          const pctNeu = gen.count > 0 ? Math.round((gen.neutral / gen.count) * 100) : 0;

          return (
            <div
              key={gen.generation}
              className={`p-5 rounded-2xl bg-zinc-950/80 border ${config.border} backdrop-blur-sm animate-fade-in-up`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-xl ${config.bg} flex items-center justify-center`}>
                  <span className={`text-xs font-black ${config.text}`}>{gen.generation.charAt(0)}</span>
                </div>
                <div>
                  <p className={`text-sm font-bold ${config.text}`}>{gen.generation}</p>
                  <p className="text-[9px] text-zinc-600">~{gen.avgAge} anos</p>
                </div>
              </div>

              <p className="text-2xl font-black text-white tabular-nums mb-1">
                {gen.count.toLocaleString('pt-BR')}
              </p>
              <p className="text-[9px] text-zinc-600 mb-3">personas</p>

              {/* Sentiment bar */}
              <div className="h-2 rounded-full overflow-hidden flex bg-zinc-900/80 mb-2">
                <div className="h-full bg-emerald-500 transition-all duration-[2000ms] ease-out rounded-l-full" style={{ width: `${pctPos}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-[2000ms] ease-out" style={{ width: `${pctNeu}%` }} />
                <div className="h-full bg-rose-500 transition-all duration-[2000ms] ease-out rounded-r-full" style={{ width: `${pctNeg}%` }} />
              </div>

              <div className="flex justify-between text-[9px] font-bold tabular-nums">
                <span className="text-emerald-400/80">{pctPos}%</span>
                <span className="text-amber-400/80">{pctNeu}%</span>
                <span className="text-rose-400/80">{pctNeg}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
