'use client';

import { useCalibrationStore, calibrationCancel } from '@/app/calibracao/store';
import { Gauge, RotateCcw, Square, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function CalibrationHeader() {
  const { isProcessing, startTime, endTime, progress, error } = useCalibrationStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime || !isProcessing) return;
    const id = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(id);
  }, [startTime, isProcessing]);

  const displayElapsed = isProcessing
    ? elapsed
    : startTime && endTime
      ? endTime - startTime
      : 0;

  const mins = Math.floor(displayElapsed / 60000);
  const secs = Math.floor((displayElapsed % 60000) / 1000);
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const statusLabel = error
    ? 'Erro'
    : isProcessing
      ? `Processando ${progress.processed}/${progress.total}`
      : progress.total > 0
        ? 'Concluido'
        : 'Pronto';

  const statusColor = error
    ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : isProcessing
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : progress.total > 0
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/30';

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-emerald-500/10">
          <Gauge size={20} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">
            Calibracao de Personas
          </h1>
          <p className="text-xs text-zinc-500">
            Teste e inspecione o pipeline de analise
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {displayElapsed > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Clock size={12} />
            {timeStr}
          </div>
        )}

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusColor}`}
        >
          {isProcessing && (
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          )}
          {statusLabel}
        </span>

        {isProcessing && (
          <button
            onClick={calibrationCancel}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-red-500/10 text-zinc-400 hover:text-red-400 border border-white/[0.08] hover:border-red-500/20 transition-all duration-200"
          >
            <Square size={14} />
          </button>
        )}

        {!isProcessing && progress.total > 0 && (
          <button
            onClick={() => useCalibrationStore.getState().reset()}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>
    </header>
  );
}
