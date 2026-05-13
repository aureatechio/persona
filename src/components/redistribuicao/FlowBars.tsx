'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getCandidateColors } from '@/lib/arena-eleitoral/constants';
import type { RedistributionCandidate } from '@/lib/arena-eleitoral/redistribution';

interface FlowBarsProps {
  candidates: RedistributionCandidate[];
  removedName: string;
}

export function FlowBars({ candidates, removedName }: FlowBarsProps) {
  const [animate, setAnimate] = useState(false);
  const maxPercent = Math.max(...candidates.map((c) => c.percentOfRedistribution));

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Only show candidates that received votes
  const receivers = candidates.filter((c) => c.gained > 0);

  return (
    <div className="w-full bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 md:p-6">
      <h3 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-5">
        Fluxo de redistribuição — <span className="text-zinc-300">{removedName}</span>
      </h3>

      <div className="space-y-3">
        {receivers.map((c, i) => {
          const colors = getCandidateColors(c.politician);
          const widthPercent = maxPercent > 0 ? (c.percentOfRedistribution / maxPercent) * 100 : 0;

          return (
            <div key={c.politician.id} className="flex items-center gap-3">
              {/* Name */}
              <div className="w-28 md:w-36 shrink-0 text-right">
                <span className="text-sm text-zinc-300 font-medium">
                  {c.politician.name.split(' ')[0]}
                </span>
              </div>

              {/* Bar */}
              <div className="flex-1 h-6 bg-zinc-800/40 rounded-full overflow-hidden relative">
                <div
                  className={cn(
                    'h-full rounded-full transition-all ease-out',
                    colors.bar,
                    'opacity-80',
                  )}
                  style={{
                    width: animate ? `${widthPercent}%` : '0%',
                    transitionDuration: `${800 + i * 100}ms`,
                    transitionDelay: `${i * 80}ms`,
                  }}
                />
                {/* Label inside bar */}
                <div
                  className="absolute inset-y-0 flex items-center px-3 transition-opacity duration-500"
                  style={{ opacity: animate ? 1 : 0, transitionDelay: `${400 + i * 80}ms` }}
                >
                  <span className="text-xs font-semibold text-white drop-shadow-md">
                    {c.percentOfRedistribution.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Votes count */}
              <div className="w-20 shrink-0">
                <span className="text-xs text-zinc-500">{c.gained.toLocaleString('pt-BR')} votos</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
