'use client';

import { useCalibrationStore, type BatchData, type PersonaBatchDetail } from '@/app/calibracao/store';
import { ChevronDown, ChevronRight, Cpu, User } from 'lucide-react';
import { useState } from 'react';

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 6) return 'text-emerald-500/70';
  if (score <= 3) return 'text-red-400';
  if (score <= 4) return 'text-red-500/70';
  return 'text-zinc-400';
}

function BatchRow({ batch }: { batch: BatchData }) {
  const [expanded, setExpanded] = useState(false);

  const scores = batch.personas.map((p) => p.score);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
  const pos = batch.personas.filter((p) => p.score >= 6).length;
  const neg = batch.personas.filter((p) => p.score <= 4).length;
  const neu = batch.personas.length - pos - neg;

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.04] transition-colors duration-150 text-left"
      >
        {expanded ? <ChevronDown size={12} className="text-zinc-500" /> : <ChevronRight size={12} className="text-zinc-500" />}
        <span className="text-sm font-medium text-zinc-300">
          Batch {batch.batchIndex + 1}/{batch.batchTotal}
        </span>
        <span className="text-xs text-zinc-600 ml-1">({batch.model})</span>
        <div className="flex items-center gap-3 ml-auto text-xs">
          <span className={`font-semibold ${scoreColor(avgScore)}`}>{avgScore.toFixed(1)}</span>
          <span className="text-emerald-500">{pos}+</span>
          <span className="text-zinc-500">{neu}~</span>
          <span className="text-red-500">{neg}-</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          <div className="max-h-[400px] overflow-y-auto">
            {batch.personas.map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.03] transition-colors duration-150"
              >
                <User size={12} className="text-zinc-600 shrink-0" />
                <span className="text-sm text-zinc-300 flex-1 min-w-0 truncate">{p.name}</span>
                <span className="text-xs text-zinc-600 w-8">{p.state}</span>
                <span className="text-xs text-zinc-600 w-8">{p.age}a</span>
                <span className={`text-sm font-bold w-10 text-right ${scoreColor(p.score)}`}>
                  {p.score.toFixed(1)}
                </span>
                <span className={`text-xs w-16 text-right ${
                  p.sentiment === 'positive' ? 'text-emerald-400'
                    : p.sentiment === 'negative' ? 'text-red-400'
                    : 'text-zinc-500'
                }`}>
                  {p.sentiment}
                </span>
              </div>
            ))}
          </div>

          {/* Comments preview */}
          {batch.personas.some((p) => p.comment) && (
            <div className="border-t border-white/[0.06] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-2">
                Comentarios gerados
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {batch.personas.filter((p) => p.comment).slice(0, 10).map((p, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className={`shrink-0 font-semibold ${scoreColor(p.score)}`}>{p.score.toFixed(1)}</span>
                    <span className="text-zinc-500 shrink-0">{p.name}:</span>
                    <span className="text-zinc-400">{p.comment}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BatchDetail() {
  const { batches, isProcessing, progress } = useCalibrationStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Cpu size={14} className="text-zinc-500" />
        <h4 className="text-sm font-medium text-zinc-400">
          Processamento de Personas
        </h4>
      </div>

      {isProcessing && batches.length === 0 && (
        <p className="text-sm text-zinc-600">Aguardando primeiro batch...</p>
      )}

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>{batches.length} batches processados</span>
        {progress.total > 0 && (
          <span>{progress.processed}/{progress.total} personas</span>
        )}
        {progress.avgScore > 0 && (
          <span className="font-medium text-zinc-300">Score medio: {progress.avgScore.toFixed(1)}</span>
        )}
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {batches.map((batch) => (
          <BatchRow key={batch.batchIndex} batch={batch} />
        ))}
      </div>
    </div>
  );
}
