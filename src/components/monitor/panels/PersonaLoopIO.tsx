'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreToEmoji, scoreToColor } from '@/lib/arena/types';
import { InputSection, OutputSection } from './IOWrapper';

interface PromptSampleData {
  system_prompt: string;
  user_prompt: string;
  persona_count: number;
  note: string;
}

interface BatchDetail {
  model: string;
  persona_count: number;
  personas_summary: Array<{
    id: string;
    name: string;
    state: string;
    age: number;
    sentiment: string;
    comment: string;
    score?: number;
  }>;
}

export function PersonaLoopIO({
  promptSample,
  batches,
}: {
  promptSample: PromptSampleData | null;
  batches: BatchDetail[];
}) {
  const [showSystem, setShowSystem] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);

  const hasPrompt = promptSample !== null;
  const hasBatches = batches.length > 0;

  if (!hasPrompt && !hasBatches) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-3">
          <Cpu size={20} className="text-zinc-700" />
        </div>
        <p className="text-xs text-zinc-500 font-medium">
          Processamento de Personas
        </p>
        <p className="text-xs text-zinc-700 mt-1.5 max-w-xs leading-relaxed">
          Aguardando inicio do processamento...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── INPUT — prompt sample ── */}
      {hasPrompt && (
        <InputSection>
          <div className="px-3 py-2 rounded-xl bg-sky-500/5 border border-sky-500/15">
            <p className="text-xs text-sky-400/80">{promptSample!.note}</p>
          </div>

          {/* System Prompt — collapsible */}
          <div className="space-y-1">
            <button
              onClick={() => setShowSystem(!showSystem)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-400 transition-colors duration-200"
            >
              {showSystem ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              System Prompt (instrucoes da IA)
            </button>
            {showSystem && (
              <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] max-h-60 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
                <pre className="text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap font-mono">
                  {promptSample!.system_prompt}
                </pre>
              </div>
            )}
          </div>

          {/* User Prompt — visible, scrollable */}
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              User Prompt (contexto + perfis das personas)
            </span>
            <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
              <pre className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
                {promptSample!.user_prompt}
              </pre>
            </div>
          </div>
        </InputSection>
      )}

      {/* ── OUTPUT — batch inspector ── */}
      {hasBatches && (
        <OutputSection>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Lotes processados ({batches.length})
          </span>
          <div className="space-y-2">
            {batches.map((batch, idx) => {
              const isExpanded = expandedBatch === idx;
              const pos = batch.personas_summary.filter(
                (p) => p.sentiment === 'positive',
              ).length;
              const neg = batch.personas_summary.filter(
                (p) => p.sentiment === 'negative',
              ).length;
              const neu = batch.personas_summary.filter(
                (p) => p.sentiment === 'neutral',
              ).length;
              const scoresInBatch = batch.personas_summary
                .filter((p) => typeof p.score === 'number')
                .map((p) => p.score!);
              const batchAvgScore =
                scoresInBatch.length > 0
                  ? scoresInBatch.reduce((a, b) => a + b, 0) /
                    scoresInBatch.length
                  : 0;

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedBatch(isExpanded ? null : idx)
                    }
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.02] transition-colors duration-200"
                  >
                    <span className="text-xs font-bold text-zinc-600 tabular-nums w-8">
                      #{idx + 1}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        batch.model.startsWith('Claude')
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
                      )}
                    >
                      {batch.model}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {batch.persona_count} personas
                    </span>
                    <div className="flex-1" />
                    {batchAvgScore > 0 && (
                      <span
                        className={cn(
                          'text-xs font-bold tabular-nums',
                          scoreToColor(batchAvgScore),
                        )}
                      >
                        {scoreToEmoji(batchAvgScore)}{' '}
                        {batchAvgScore.toFixed(1)}
                      </span>
                    )}
                    <div className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="text-emerald-400">{pos}+</span>
                      <span className="text-rose-400">{neg}-</span>
                      <span className="text-amber-400">{neu}~</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={12} className="text-zinc-600" />
                    ) : (
                      <ChevronRight size={12} className="text-zinc-600" />
                    )}
                  </button>

                  {/* Expanded — persona table */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] max-h-80 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-zinc-600 font-semibold uppercase tracking-wider border-b border-white/[0.04] sticky top-0 bg-zinc-950/95 backdrop-blur-sm">
                            <th className="text-left px-3 py-2 w-36">
                              Persona
                            </th>
                            <th className="text-left px-3 py-2 w-12">UF</th>
                            <th className="text-left px-3 py-2 w-10">
                              Idade
                            </th>
                            <th className="text-center px-3 py-2 w-16">
                              Score
                            </th>
                            <th className="text-left px-3 py-2">
                              Resposta da Persona
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {batch.personas_summary.map((p, pi) => (
                            <tr
                              key={pi}
                              className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors duration-200"
                            >
                              <td className="px-3 py-1.5 text-zinc-300 truncate max-w-[144px]">
                                {p.name}
                              </td>
                              <td className="px-3 py-1.5 text-zinc-500">
                                {p.state}
                              </td>
                              <td className="px-3 py-1.5 text-zinc-500 tabular-nums">
                                {p.age}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                {typeof p.score === 'number' ? (
                                  <span
                                    className={cn(
                                      'text-xs font-bold tabular-nums',
                                      scoreToColor(p.score),
                                    )}
                                  >
                                    {scoreToEmoji(p.score)}{' '}
                                    {p.score.toFixed(1)}
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      'inline-block px-1.5 py-0.5 rounded-full text-xs font-bold',
                                      p.sentiment === 'positive'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : p.sentiment === 'negative'
                                          ? 'bg-rose-500/10 text-rose-400'
                                          : 'bg-amber-500/10 text-amber-400',
                                    )}
                                  >
                                    {p.sentiment === 'positive'
                                      ? 'A favor'
                                      : p.sentiment === 'negative'
                                        ? 'Contra'
                                        : 'Neutro'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-zinc-400 max-w-xs">
                                <span className="line-clamp-3">
                                  {p.comment}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </OutputSection>
      )}
    </div>
  );
}
