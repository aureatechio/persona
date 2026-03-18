'use client';

import { Users } from 'lucide-react';
import { InputSection, OutputSection, DataField } from './IOWrapper';

export function PersonaLoaderIO({ total }: { total: number }) {
  return (
    <div className="space-y-4">
      {/* ── INPUT ── */}
      <InputSection>
        <DataField
          label="Fonte de dados"
          value="Consulta ao banco de dados Supabase"
        />
      </InputSection>

      {/* ── OUTPUT ── */}
      <OutputSection>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Users size={24} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white tracking-tight">
                {total.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                personas carregadas e prontas para processamento
              </p>
            </div>
          </div>
        </div>
      </OutputSection>
    </div>
  );
}
