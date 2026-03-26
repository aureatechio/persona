'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, User } from 'lucide-react';
import { useCalibrationStore, type PersonaBatchDetail } from '@/app/calibracao/store';
import PersonaDrillDown from './PersonaDrillDown';

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  negative: 'bg-red-500/10 text-red-400 border-red-500/20',
  neutral: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',
};

export default function PersonaSampleList() {
  const { batches } = useCalibrationStore();
  const [expanded, setExpanded] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<{
    persona: PersonaBatchDetail;
    batchIndex: number;
  } | null>(null);

  // Collect all personas from all batches
  const allPersonas: { persona: PersonaBatchDetail; batchIndex: number }[] = [];
  for (const batch of batches) {
    for (const p of batch.personas) {
      allPersonas.push({ persona: p, batchIndex: batch.index });
    }
  }

  if (allPersonas.length === 0) return null;

  const displayed = expanded ? allPersonas.slice(0, 200) : allPersonas.slice(0, 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Personas Analisadas ({allPersonas.length.toLocaleString()})
        </h3>
        {allPersonas.length > 20 && (
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
        <div className="grid grid-cols-[1fr_80px_100px_80px] gap-2 px-4 py-2 border-b border-white/[0.06] text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          <span>Nome</span>
          <span>Estado</span>
          <span>Politica</span>
          <span>Sentimento</span>
        </div>

        {/* Rows */}
        <div className="max-h-[400px] overflow-y-auto">
          {displayed.map(({ persona, batchIndex }, i) => (
            <button
              key={`${persona.id}-${i}`}
              onClick={() => setSelectedPersona({ persona, batchIndex })}
              className="w-full grid grid-cols-[1fr_80px_100px_80px] gap-2 px-4 py-2.5 hover:bg-white/[0.04] transition-colors duration-150 text-left border-b border-white/[0.03] last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <User size={12} className="text-zinc-600 shrink-0" />
                <span className="text-xs text-zinc-300 truncate">
                  {persona.name}
                </span>
                <span className="text-[10px] text-zinc-600">{persona.age}a</span>
              </div>
              <span className="text-xs text-zinc-500">{persona.state}</span>
              <span className="text-[10px] text-zinc-500 truncate">
                {persona.political_leaning}
              </span>
              <span
                className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${SENTIMENT_STYLE[persona.sentiment] || SENTIMENT_STYLE.neutral}`}
              >
                {persona.sentiment}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedPersona && (
        <PersonaDrillDown
          persona={selectedPersona.persona}
          batchIndex={selectedPersona.batchIndex}
          onClose={() => setSelectedPersona(null)}
        />
      )}
    </div>
  );
}
