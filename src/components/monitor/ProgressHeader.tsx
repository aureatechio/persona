'use client';

import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreToEmoji, scoreToLabel, scoreToColor } from '@/lib/arena/types';
import type { PipelineState } from './types';

export function ProgressHeader({ state }: { state: PipelineState }) {
  const elapsed = state.startTime
    ? (((state.endTime || Date.now()) - state.startTime) / 1000).toFixed(0)
    : '0';

  const pct = state.progress.total > 0
    ? Math.round((state.progress.processed / state.progress.total) * 100)
    : 0;

  const elapsedSec = state.startTime ? ((state.endTime || Date.now()) - state.startTime) / 1000 : 0;
  const rate = elapsedSec > 0 && state.progress.processed > 0
    ? Math.round(state.progress.processed / elapsedSec)
    : 0;

  const hasProgress = state.progress.total > 0;

  return (
    <div className="shrink-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl">
      {/* Row 1: Title + Topic + Status */}
      <div className="px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/15 border border-violet-500/20 flex items-center justify-center">
            <Radio size={18} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Monitor da Arena</h1>
            <p className="text-xs text-zinc-500">Pipeline em tempo real</p>
          </div>
        </div>

        {/* Topic */}
        <div className="flex-1 max-w-2xl">
          {(state.topic || state.question) ? (
            <div className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">
                {state.corePoint ? 'Ponto Central' : 'Contexto'}
              </p>
              <p className="text-sm text-white truncate">{state.topic || state.question}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border border-dashed border-white/[0.06] rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-sm text-zinc-500">Aguardando conteudo na tela principal...</p>
            </div>
          )}
        </div>

        {/* Status + Elapsed */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-400 font-semibold">Escutando</span>
          </span>
          {state.startTime && (
            <span className="text-sm text-zinc-400 tabular-nums font-mono">{elapsed}s</span>
          )}
        </div>
      </div>

      {/* Row 2: Progress (only when pipeline is running) */}
      {hasProgress && (
        <div className="px-6 pb-4 space-y-3">
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-zinc-900/80 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, rgb(139,92,246), rgb(236,72,153))',
              }}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Personas"
              value={`${state.progress.processed.toLocaleString('pt-BR')}/${state.progress.total.toLocaleString('pt-BR')}`}
              color="text-white"
            />
            <StatCard
              label="Progresso"
              value={`${pct}%`}
              color="text-violet-400"
            />
            {state.avgScore > 0 && (
              <StatCard
                label={scoreToLabel(state.avgScore)}
                value={`${scoreToEmoji(state.avgScore)} ${state.avgScore.toFixed(1)}`}
                color={scoreToColor(state.avgScore)}
              />
            )}
            <StatCard
              label="Velocidade"
              value={`${rate}/s`}
              color="text-sky-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-center">
      <p className={cn('text-base font-bold tabular-nums', color)}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}
