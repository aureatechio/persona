'use client';

import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

interface Props {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export default function SentimentGauge({ positive, negative, neutral, total }: Props) {
  if (total === 0) return null;

  const pPct = Math.round((positive / total) * 100);
  const nPct = Math.round((negative / total) * 100);
  const uPct = 100 - pPct - nPct;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-4">
        Sentimento Geral
      </h3>

      {/* Bar */}
      <div className="flex h-4 rounded-full overflow-hidden mb-4">
        {pPct > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${pPct}%` }}
          />
        )}
        {uPct > 0 && (
          <div
            className="bg-zinc-600 transition-all duration-500"
            style={{ width: `${uPct}%` }}
          />
        )}
        {nPct > 0 && (
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${nPct}%` }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            <ThumbsUp size={14} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{pPct}%</p>
            <p className="text-xs text-zinc-500">{positive.toLocaleString()} positivos</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-700/50">
            <Minus size={14} className="text-zinc-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{uPct}%</p>
            <p className="text-xs text-zinc-500">{neutral.toLocaleString()} neutros</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-500/10">
            <ThumbsDown size={14} className="text-red-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{nPct}%</p>
            <p className="text-xs text-zinc-500">{negative.toLocaleString()} negativos</p>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] text-center">
        <p className="text-xs text-zinc-500">
          {total.toLocaleString()} personas analisadas
        </p>
      </div>
    </div>
  );
}
