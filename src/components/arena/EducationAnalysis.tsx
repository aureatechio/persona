'use client';

import { GraduationCap } from 'lucide-react';
import type { EducationResult } from '@/lib/arena/types';

const EDUCATION_COLORS: Record<string, string> = {
  'Fundamental': '#ef4444',
  'Médio': '#f59e0b',
  'Superior Incompleto': '#22d3ee',
  'Superior Completo': '#3b82f6',
  'Pós-Graduação/MBA': '#a78bfa',
  'Mestrado/Doutorado': '#10b981',
};

export function EducationAnalysis({ educationLevels }: { educationLevels: EducationResult[] }) {
  if (educationLevels.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <GraduationCap size={14} className="text-zinc-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Escolaridade × Intensidade de Opinião
        </p>
      </div>

      <div className="rounded-2xl bg-zinc-950/80 border border-white/[0.06] p-5 backdrop-blur-sm animate-fade-in-up space-y-4">
        {educationLevels.map((edu, idx) => {
          const color = EDUCATION_COLORS[edu.level] || '#71717a';
          const pctPos = edu.count > 0 ? Math.round((edu.positive / edu.count) * 100) : 0;
          const pctNeg = edu.count > 0 ? Math.round((edu.negative / edu.count) * 100) : 0;
          const pctNeu = edu.count > 0 ? Math.round((edu.neutral / edu.count) * 100) : 0;
          const intensityPct = Math.round(edu.avgIntensity * 100);

          return (
            <div key={edu.level}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm text-zinc-300 font-medium">{edu.level}</span>
                  <span className="text-[10px] text-zinc-600">({edu.count.toLocaleString('pt-BR')})</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] tabular-nums">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-600">Intensidade:</span>
                    <span className="font-bold text-white">{intensityPct}%</span>
                  </div>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-emerald-400">{pctPos}%</span>
                    <span className="text-amber-400">{pctNeu}%</span>
                    <span className="text-rose-400">{pctNeg}%</span>
                  </div>
                </div>
              </div>

              {/* Dual bars: intensity + sentiment */}
              <div className="flex gap-2">
                {/* Intensity bar */}
                <div className="w-24 h-3 rounded-full overflow-hidden bg-zinc-900/80 shrink-0">
                  <div
                    className="h-full rounded-full transition-all duration-[1500ms] ease-out"
                    style={{
                      width: `${intensityPct}%`,
                      backgroundColor: color,
                      opacity: 0.6,
                      transitionDelay: `${idx * 80}ms`,
                    }}
                  />
                </div>
                {/* Sentiment bar */}
                <div className="flex-1 h-3 rounded-full overflow-hidden flex bg-zinc-900/80">
                  <div className="h-full bg-emerald-500 transition-all duration-[1500ms] ease-out rounded-l-full" style={{ width: `${pctPos}%`, transitionDelay: `${idx * 80}ms` }} />
                  <div className="h-full bg-amber-500 transition-all duration-[1500ms] ease-out" style={{ width: `${pctNeu}%`, transitionDelay: `${idx * 80}ms` }} />
                  <div className="h-full bg-rose-500 transition-all duration-[1500ms] ease-out rounded-r-full" style={{ width: `${pctNeg}%`, transitionDelay: `${idx * 80}ms` }} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <span className="text-[9px] text-zinc-600 italic">
            Maior escolaridade = menor extremismo, mais nuance na opinião
          </span>
          <div className="flex items-center gap-3 text-[9px]">
            <div className="flex items-center gap-1">
              <div className="w-8 h-1.5 rounded-full bg-zinc-700/50" />
              <span className="text-zinc-600">Intensidade</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-8 h-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" />
              <span className="text-zinc-600">Sentimento</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
