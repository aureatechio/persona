'use client';

import { useCalibrationStore, calibrationCancel } from '@/app/calibracao/store';
import { Gauge, RotateCcw, Square, Clock, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function CalibrationHeader() {
  const { isProcessing, startTime, endTime, progress, error, cost } = useCalibrationStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime || !isProcessing) return;
    const id = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(id);
  }, [startTime, isProcessing]);

  const displayElapsed = isProcessing ? elapsed : startTime && endTime ? endTime - startTime : 0;
  const mins = Math.floor(displayElapsed / 60000);
  const secs = Math.floor((displayElapsed % 60000) / 1000);
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
      {/* Left: branding */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Gauge size={18} className="text-emerald-400" />
          </div>
          {isProcessing && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-black animate-pulse" />
          )}
        </div>
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">
            Calibracao
          </h1>
          <p className="text-[11px] text-zinc-600">
            Pipeline de Producao Completo
          </p>
        </div>
      </div>

      {/* Center: live metrics */}
      {progress.total > 0 && (
        <div className="flex items-center gap-6">
          {/* Score */}
          <div className="text-center">
            <p className={`text-2xl font-bold tracking-tight tabular-nums ${
              progress.avgScore >= 7 ? 'text-emerald-400'
                : progress.avgScore <= 3 ? 'text-red-400'
                : 'text-zinc-300'
            }`}>
              {progress.avgScore.toFixed(1)}
            </p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Score</p>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-white/[0.06]" />

          {/* Personas */}
          <div className="text-center">
            <p className="text-lg font-semibold text-zinc-300 tabular-nums">
              {progress.processed.toLocaleString()}
              <span className="text-zinc-600 text-sm">/{progress.total.toLocaleString()}</span>
            </p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Personas</p>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-white/[0.06]" />

          {/* Distribution */}
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="text-emerald-400 font-semibold">{progress.positive}</span>
            <span className="text-zinc-600">{progress.neutral}</span>
            <span className="text-red-400 font-semibold">{progress.negative}</span>
          </div>
        </div>
      )}

      {/* Right: controls */}
      <div className="flex items-center gap-2.5">
        {displayElapsed > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] text-[11px] text-zinc-500 tabular-nums">
            <Clock size={11} />
            {timeStr}
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-emerald-400">
            <Activity size={11} className="animate-pulse" />
            Executando
          </div>
        )}

        {error && (
          <div className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
            Erro
          </div>
        )}

        {!isProcessing && !error && progress.total > 0 && (
          <div className="flex items-center gap-2">
            {cost && (
              <div className="px-2.5 py-1 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-400 tabular-nums" title={`GPT: ${cost.gpt4o_mini.calls} calls, ${cost.gpt4o_mini.input_tokens.toLocaleString()} in + ${cost.gpt4o_mini.output_tokens.toLocaleString()} out`}>
                ${cost.total_usd.toFixed(2)}
              </div>
            )}
            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
              Concluido
            </div>
          </div>
        )}

        {isProcessing && (
          <button
            onClick={calibrationCancel}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-white/[0.06] hover:border-red-500/20 transition-all duration-200 active:scale-[0.95]"
          >
            <Square size={13} />
          </button>
        )}

        {!isProcessing && progress.total > 0 && (
          <button
            onClick={() => useCalibrationStore.getState().reset()}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 active:scale-[0.95]"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>
    </header>
  );
}
