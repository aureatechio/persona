'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InputSection, OutputSection, DataField } from './IOWrapper';

interface ContextExtractionData {
  rawTranscript: string | null;
  title: string | null;
  author: string | null;
  corePoint: string | null;
  claudeSummary: string | null;
  enrichedContext: string | null;
  generatedQuestion: string | null;
  politicalFigures: Array<{
    nome: string;
    alinhamento: string;
    posicao_autor: string;
  }> | null;
}

const ALIGN_COLORS: Record<string, string> = {
  direita: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'centro-direita': 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  centro: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20',
  'centro-esquerda': 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  esquerda: 'bg-red-500/15 text-red-400 border-red-500/20',
};

export function ContextExtractionIO({
  data,
  question,
}: {
  data: ContextExtractionData;
  question: string;
}) {
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  const transcriptPreview =
    data.rawTranscript && data.rawTranscript.length > 500 && !transcriptExpanded
      ? data.rawTranscript.slice(0, 500) + '...'
      : data.rawTranscript;

  return (
    <div className="space-y-4">
      {/* ── INPUT ── */}
      <InputSection>
        <DataField label="Pergunta do usuario" value={question} />
      </InputSection>

      {/* ── OUTPUT ── */}
      <OutputSection>
        {/* Title & Author */}
        {(data.title || data.author) && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-1">
            {data.title && (
              <p className="text-sm font-semibold text-white">{data.title}</p>
            )}
            {data.author && (
              <p className="text-xs text-zinc-500">{data.author}</p>
            )}
          </div>
        )}

        {/* Core Point — highlighted */}
        {data.corePoint && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
              Ponto Central
            </span>
            <p className="text-sm text-zinc-200 leading-relaxed font-medium mt-1.5">
              {data.corePoint}
            </p>
          </div>
        )}

        {/* Political Figures Table */}
        {data.politicalFigures && data.politicalFigures.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 block">
              Figuras Politicas
            </span>
            <div className="space-y-2">
              {data.politicalFigures.map((fig, i) => {
                const colorClass =
                  ALIGN_COLORS[fig.alinhamento] || ALIGN_COLORS['centro'];
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-xs text-white font-medium min-w-0">
                      {fig.nome}
                    </span>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border font-medium shrink-0',
                        colorClass,
                      )}
                    >
                      {fig.alinhamento}
                    </span>
                    <span className="text-xs text-zinc-600 shrink-0">
                      {fig.posicao_autor === 'a favor'
                        ? 'autor a favor'
                        : fig.posicao_autor === 'contra'
                          ? 'autor contra'
                          : 'neutro'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Generated Question */}
        {data.generatedQuestion && (
          <DataField
            label="Pergunta gerada para as personas"
            value={data.generatedQuestion}
          />
        )}

        {/* Raw Transcript — collapsible */}
        {data.rawTranscript && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <button
              onClick={() => setTranscriptExpanded(!transcriptExpanded)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-400 transition-colors duration-200 mb-2"
            >
              {transcriptExpanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              Transcricao Completa
              <span className="text-xs text-zinc-600 font-mono ml-2">
                {data.rawTranscript.length.toLocaleString('pt-BR')} chars
              </span>
            </button>
            {(transcriptExpanded || data.rawTranscript.length <= 500) && (
              <pre className="text-xs text-zinc-400 leading-relaxed font-mono whitespace-pre-wrap max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
                {transcriptPreview}
              </pre>
            )}
            {!transcriptExpanded && data.rawTranscript.length > 500 && (
              <button
                onClick={() => setTranscriptExpanded(true)}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors duration-200"
              >
                Expandir transcricao completa
              </button>
            )}
          </div>
        )}

        {/* Claude Summary */}
        {data.claudeSummary && (
          <DataField label="Resumo Claude (referencia)" value={data.claudeSummary} />
        )}
      </OutputSection>
    </div>
  );
}
