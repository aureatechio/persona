'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InputSection, OutputSection, DataField } from './IOWrapper';

interface ValidatorData {
  verdict: string;
  issues: string[];
  corrections: string;
  fullContext?: string;
  figuras?: Array<Record<string, unknown>>;
}

interface ContextData {
  tema: string;
  contexto: string;
  figuras: Array<Record<string, unknown>>;
  periodo: string;
}

export function ContextValidatorIO({
  data,
  contextData,
  ideologicalFrame,
}: {
  data: ValidatorData | null;
  contextData: ContextData | null;
  ideologicalFrame: string | null;
}) {
  const [showFullContext, setShowFullContext] = useState(false);
  const isValid =
    data?.verdict?.toUpperCase() === 'PASS' ||
    data?.verdict?.toUpperCase() === 'VALID';

  const contextPreview = contextData?.contexto
    ? contextData.contexto.length > 200
      ? contextData.contexto.slice(0, 200) + '...'
      : contextData.contexto
    : null;

  return (
    <div className="space-y-4">
      {/* ── INPUT — draft context preview ── */}
      <InputSection>
        <DataField
          label="Contexto do builder (rascunho)"
          value={
            contextPreview || 'Contexto gerado na etapa anterior para validacao'
          }
        />
      </InputSection>

      {/* ── OUTPUT ── */}
      {data && (
        <OutputSection>
          {/* Verdict badge */}
          <div
            className={cn(
              'rounded-xl border p-4',
              isValid
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-amber-500/5 border-amber-500/20',
            )}
          >
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full',
                isValid
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400',
              )}
            >
              {isValid ? 'Contexto Valido' : 'Contexto Revisado'}
            </span>
          </div>

          {/* Issues list */}
          {data.issues && data.issues.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Problemas encontrados
              </span>
              <div className="space-y-1.5">
                {data.issues.map((issue, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/15"
                  >
                    <AlertCircle
                      size={12}
                      className="text-amber-400 shrink-0 mt-0.5"
                    />
                    <span className="text-xs text-amber-300">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Corrections */}
          {data.corrections && (
            <DataField label="Correcoes aplicadas" value={data.corrections} />
          )}

          {/* Full Context — collapsible */}
          {data.fullContext && (
            <div className="space-y-1">
              <button
                onClick={() => setShowFullContext(!showFullContext)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-400 transition-colors duration-200"
              >
                {showFullContext ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                Contexto completo enviado
                <span className="text-xs text-zinc-600 font-mono ml-2">
                  {data.fullContext.length.toLocaleString('pt-BR')} chars
                </span>
              </button>
              {showFullContext && (
                <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
                  <pre className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
                    {data.fullContext}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Figuras */}
          {data.figuras && data.figuras.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Figuras politicas no contexto
              </span>
              <div className="flex flex-wrap gap-1.5">
                {data.figuras.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 font-medium"
                  >
                    {(f.nome as string) || '?'}
                    {f.cargo ? (
                      <span className="text-violet-500">
                        ({String(f.cargo)})
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          )}
        </OutputSection>
      )}

      {/* ── IDEOLOGICAL FRAME — special gradient card ── */}
      {ideologicalFrame && (
        <div className="relative rounded-2xl p-px bg-gradient-to-r from-violet-500/50 via-fuchsia-500/30 to-violet-500/50">
          <div className="bg-zinc-950 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-violet-400" />
              <span className="text-sm font-bold text-violet-300">
                Enquadramento Ideologico
              </span>
            </div>
            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {ideologicalFrame}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
