'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { useCalibrationStore, type PersonaBatchDetail } from '@/app/calibracao/store';

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 6) return 'text-emerald-500/70';
  if (score <= 3) return 'text-red-400';
  if (score <= 4) return 'text-red-500/70';
  return 'text-zinc-400';
}

export default function PersonaSampleList() {
  const { batches } = useCalibrationStore();
  const [expanded, setExpanded] = useState(false);

  const allPersonas: { persona: PersonaBatchDetail; batchIndex: number }[] = [];
  for (const batch of batches) {
    for (const p of batch.personas) {
      allPersonas.push({ persona: p, batchIndex: batch.batchIndex });
    }
  }

  if (allPersonas.length === 0) return null;

  const displayed = expanded ? allPersonas.slice(0, 200) : allPersonas.slice(0, 30);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Personas Analisadas ({allPersonas.length.toLocaleString()})
        </h3>
        {allPersonas.length > 30 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors duration-200"
          >
            {expanded ? 'Mostrar menos' : `Ver mais (${allPersonas.length})`}
          </button>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_60px_70px_60px_70px] gap-2 px-4 py-2 border-b border-white/[0.06] text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          <span>Nome</span>
          <span>Estado</span>
          <span>Score</span>
          <span>Idade</span>
          <span>Sentimento</span>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {displayed.map(({ persona }, i) => (
            <div
              key={`${persona.id}-${i}`}
              className="grid grid-cols-[1fr_60px_70px_60px_70px] gap-2 px-4 py-2 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.03] transition-colors duration-150"
            >
              <div className="flex items-center gap-2 min-w-0">
                <User size={11} className="text-zinc-600 shrink-0" />
                <span className="text-xs text-zinc-300 truncate">{persona.name}</span>
              </div>
              <span className="text-xs text-zinc-500">{persona.state}</span>
              <span className={`text-sm font-bold ${scoreColor(persona.score)}`}>
                {persona.score.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-600">{persona.age}a</span>
              <span className={`text-xs ${
                persona.sentiment === 'positive' ? 'text-emerald-400'
                  : persona.sentiment === 'negative' ? 'text-red-400'
                  : 'text-zinc-500'
              }`}>
                {persona.sentiment}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
