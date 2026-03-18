'use client';

import { InputSection, OutputSection, DataField } from './IOWrapper';

interface ContextData {
  tema: string;
  contexto: string;
  figuras: Array<Record<string, unknown>>;
  periodo: string;
}

export function ContextBuilderIO({ data }: { data: ContextData }) {
  return (
    <div className="space-y-4">
      {/* ── INPUT ── */}
      <InputSection>
        <DataField
          label="Dados de entrada"
          value="Dados da extracao e pesquisa web combinados para construcao do contexto factual"
        />
      </InputSection>

      {/* ── OUTPUT ── */}
      <OutputSection>
        {/* Tema — highlighted */}
        {data.tema && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
              Tema
            </span>
            <p className="text-sm text-violet-300 font-medium mt-1">
              {data.tema}
            </p>
          </div>
        )}

        {/* Periodo */}
        {data.periodo && <DataField label="Periodo" value={data.periodo} />}

        {/* Contexto — scrollable */}
        {data.contexto && (
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Texto de contexto enviado as personas
            </span>
            <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {data.contexto}
              </p>
            </div>
          </div>
        )}

        {/* Figuras — as badges */}
        {data.figuras && data.figuras.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Figuras publicas mencionadas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {data.figuras.map((fig, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"
                >
                  {typeof fig === 'string'
                    ? fig
                    : (fig.nome as string) || JSON.stringify(fig)}
                </span>
              ))}
            </div>
          </div>
        )}
      </OutputSection>
    </div>
  );
}
