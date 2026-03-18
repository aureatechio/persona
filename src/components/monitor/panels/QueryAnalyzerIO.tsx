'use client';

import { cn } from '@/lib/utils';
import { InputSection, OutputSection, DataField } from './IOWrapper';

interface QueryAnalyzerData {
  needs_research: boolean;
  reason: string;
}

export function QueryAnalyzerIO({
  data,
  question,
  corePoint,
}: {
  data: QueryAnalyzerData;
  question: string;
  corePoint: string;
}) {
  return (
    <div className="space-y-4">
      {/* ── INPUT ── */}
      <InputSection>
        <DataField label="Pergunta" value={question} />
        {corePoint && <DataField label="Ponto central" value={corePoint} />}
      </InputSection>

      {/* ── OUTPUT ── */}
      <OutputSection>
        <div
          className={cn(
            'rounded-xl border p-4',
            data.needs_research
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-amber-500/5 border-amber-500/20',
          )}
        >
          <span
            className={cn(
              'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full',
              data.needs_research
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400',
            )}
          >
            {data.needs_research
              ? 'Pesquisa Necessaria'
              : 'Pesquisa Dispensada'}
          </span>
          <p className="text-sm text-zinc-300 leading-relaxed mt-3">
            {data.reason}
          </p>
        </div>
      </OutputSection>
    </div>
  );
}
