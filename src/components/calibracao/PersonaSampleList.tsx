'use client';

import { useState, useMemo } from 'react';
import { User, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useCalibrationStore, type PersonaBatchDetail } from '@/app/calibracao/store';
import PersonaDrillDown from './PersonaDrillDown';

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 6) return 'text-emerald-500/70';
  if (score <= 3) return 'text-red-400';
  if (score <= 4) return 'text-red-500/70';
  return 'text-zinc-400';
}

type SortKey = 'order' | 'score_asc' | 'score_desc' | 'name';

export default function PersonaSampleList() {
  const { batches, isProcessing } = useCalibrationStore();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<PersonaBatchDetail | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('order');

  // Flatten all personas from all batches
  const allPersonas = useMemo(() => {
    const result: PersonaBatchDetail[] = [];
    for (const batch of batches) {
      for (const p of batch.personas) {
        result.push(p);
      }
    }
    return result;
  }, [batches]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...allPersonas];
    switch (sortBy) {
      case 'score_desc': arr.sort((a, b) => b.score - a.score); break;
      case 'score_asc': arr.sort((a, b) => a.score - b.score); break;
      case 'name': arr.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: break; // order of arrival
    }
    return arr;
  }, [allPersonas, sortBy]);

  if (allPersonas.length === 0) return null;

  const displayed = expanded ? sorted.slice(0, 500) : sorted.slice(0, 50);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Personas Analisadas ({allPersonas.length.toLocaleString()})
          {isProcessing && (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 normal-case tracking-normal">ao vivo</span>
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="appearance-none text-[11px] text-zinc-500 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1 pr-6 outline-none hover:bg-white/[0.06] hover:text-zinc-300 transition-all duration-200 cursor-pointer"
            >
              <option value="order">Ordem de chegada</option>
              <option value="score_desc">Maior score</option>
              <option value="score_asc">Menor score</option>
              <option value="name">Nome A-Z</option>
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>

          {allPersonas.length > 50 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors duration-200"
            >
              {expanded ? 'Mostrar menos' : `Ver todas (${allPersonas.length.toLocaleString()})`}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_50px_60px_50px_70px] gap-2 px-4 py-2 border-b border-white/[0.06] text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          <span>Nome</span>
          <span>UF</span>
          <span>Score</span>
          <span>Idade</span>
          <span>Sentimento</span>
        </div>

        {/* Rows */}
        <div className="max-h-[400px] overflow-y-auto">
          {displayed.map((persona, i) => (
            <button
              key={`${persona.id}-${i}`}
              onClick={() => setSelected(persona)}
              className="w-full grid grid-cols-[1fr_50px_60px_50px_70px] gap-2 px-4 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.04] transition-colors duration-150 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0">
                  {persona.sentiment === 'positive'
                    ? <TrendingUp size={11} className="text-emerald-400" />
                    : persona.sentiment === 'negative'
                    ? <TrendingDown size={11} className="text-red-400" />
                    : <Minus size={11} className="text-zinc-500" />
                  }
                </span>
                <span className="text-xs text-zinc-300 truncate">{persona.name}</span>
              </div>
              <span className="text-xs text-zinc-500">{persona.state}</span>
              <span className={`text-sm font-bold tabular-nums ${scoreColor(persona.score)}`}>
                {persona.score.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-600">{persona.age}a</span>
              <span className={`text-[11px] font-medium ${
                persona.sentiment === 'positive' ? 'text-emerald-400'
                  : persona.sentiment === 'negative' ? 'text-red-400'
                  : 'text-zinc-500'
              }`}>
                {persona.sentiment === 'positive' ? 'A Favor'
                  : persona.sentiment === 'negative' ? 'Contra'
                  : 'Neutro'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <PersonaDrillDown persona={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
