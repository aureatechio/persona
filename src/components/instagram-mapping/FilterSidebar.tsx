'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Filter, X, RotateCcw } from 'lucide-react';

export interface ActiveFilters {
  genero: string[];
  faixa_etaria: string[];
  renda: string[];
  engajamento: string[];
  grupo: string[];
  temas: string[];
  profissao: string;
}

export const EMPTY_FILTERS: ActiveFilters = {
  genero: [],
  faixa_etaria: [],
  renda: [],
  engajamento: [],
  grupo: [],
  temas: [],
  profissao: '',
};

interface FilterSidebarProps {
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  totalResults: number;
  filteredCount: number;
}

const GENERO_OPTIONS = ['homem', 'mulher'];
const IDADE_OPTIONS = ['16-24', '25-34', '35-44', '45-59', '60+'];
const RENDA_OPTIONS = ['baixa', 'media', 'alta'];
const ENGAJAMENTO_OPTIONS = ['passivo', 'moderado', 'ativo'];
const GRUPO_OPTIONS = [
  'FAMILIA', 'EMPREENDEDOR', 'FE', 'ESPORTE', 'EDUCACAO',
  'SAUDE', 'TECH', 'POLITICA', 'MODA', 'ARTE',
  'MUSICA', 'GASTRONOMIA', 'AGRO', 'PET', 'VIAGEM',
  'FITNESS', 'JURIDICO', 'INFLUENCER', 'COMUNIDADE', 'LIFESTYLE',
];
const GRUPO_LABELS: Record<string, string> = {
  FAMILIA: 'Família', EMPREENDEDOR: 'Empreendedor', FE: 'Fé', ESPORTE: 'Esporte',
  EDUCACAO: 'Educação', SAUDE: 'Saúde', TECH: 'Tech', POLITICA: 'Política',
  MODA: 'Moda', ARTE: 'Arte', MUSICA: 'Música', GASTRONOMIA: 'Gastronomia',
  AGRO: 'Agro', PET: 'Pet', VIAGEM: 'Viagem', FITNESS: 'Fitness',
  JURIDICO: 'Jurídico', INFLUENCER: 'Influencer', COMUNIDADE: 'Comunidade', LIFESTYLE: 'Lifestyle',
};
const TEMA_OPTIONS = [
  'economia', 'seguranca', 'saude', 'religiao', 'educacao',
  'politica', 'esporte', 'tecnologia', 'entretenimento', 'moda',
];

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-xl text-xs font-medium',
        'border transition-all duration-200',
        'active:scale-[0.95]',
        active
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
          : 'bg-white/[0.03] text-zinc-500 border-white/[0.05] hover:text-zinc-300 hover:border-white/[0.12] hover:bg-white/[0.06]',
      )}
    >
      {label}
    </button>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 px-1">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}

export function FilterSidebar({
  filters,
  onChange,
  totalResults,
  filteredCount,
}: FilterSidebarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters =
    filters.genero.length > 0 ||
    filters.faixa_etaria.length > 0 ||
    filters.renda.length > 0 ||
    filters.engajamento.length > 0 ||
    filters.grupo.length > 0 ||
    filters.temas.length > 0 ||
    filters.profissao.trim().length > 0;

  const activeCount =
    filters.genero.length +
    filters.faixa_etaria.length +
    filters.renda.length +
    filters.engajamento.length +
    filters.grupo.length +
    filters.temas.length +
    (filters.profissao.trim() ? 1 : 0);

  useEffect(() => {
    if (!panelOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelOpen]);

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ ...EMPTY_FILTERS });
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger buttons row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2',
            'bg-white/[0.04] hover:bg-white/[0.07]',
            'border hover:border-white/[0.15]',
            'rounded-xl text-xs',
            'transition-all duration-200 cursor-pointer',
            panelOpen
              ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400'
              : hasActiveFilters
                ? 'border-emerald-500/20 text-emerald-400'
                : 'border-white/[0.08] text-zinc-400 hover:text-zinc-300',
          )}
        >
          <Filter size={13} />
          <span className="font-medium">Filtros</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-emerald-500/15 text-emerald-400 rounded-full text-[9px] font-bold">
              {activeCount}
            </span>
          )}
          <ChevronDown
            size={12}
            className={cn(
              'text-zinc-600 transition-transform duration-200 -mr-0.5',
              panelOpen && 'rotate-180',
            )}
          />
        </button>

        {/* Clear button — always visible when filters active */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2',
              'bg-red-500/10 hover:bg-red-500/15',
              'border border-red-500/20 hover:border-red-500/30',
              'rounded-xl text-xs font-medium text-red-400 hover:text-red-300',
              'transition-all duration-200 active:scale-[0.95]',
            )}
          >
            <RotateCcw size={11} />
            Limpar
          </button>
        )}
      </div>

      {/* Floating dropdown panel — right-aligned to prevent overflow */}
      {panelOpen && (
        <div
          className={cn(
            'fixed sm:absolute top-auto sm:top-full left-4 sm:left-0 right-4 sm:right-auto mt-2 z-50',
            'sm:w-[420px]',
            'bg-zinc-950/98 backdrop-blur-2xl',
            'border border-white/[0.1]',
            'rounded-2xl',
            'shadow-2xl shadow-black/60',
            'animate-in fade-in slide-in-from-top-2 duration-200',
          )}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <Filter size={12} className="text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-white">
                Filtros
              </span>
              {activeCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 bg-emerald-500/15 text-emerald-400 rounded-full text-[10px] font-bold">
                  {activeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAll}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5',
                    'text-[11px] font-medium',
                    'text-red-400 hover:text-red-300',
                    'bg-red-500/10 hover:bg-red-500/15',
                    'border border-red-500/20 hover:border-red-500/30',
                    'rounded-lg transition-all duration-200',
                  )}
                >
                  <RotateCcw size={10} />
                  Limpar tudo
                </button>
              )}
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-all duration-200"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

          {/* Filter groups — all visible, scrollable */}
          <div className="px-5 py-4 space-y-4 max-h-[55vh] overflow-y-auto">
            <FilterGroup label="Genero">
              {GENERO_OPTIONS.map((g) => (
                <Chip
                  key={g}
                  label={g === 'homem' ? 'Homem' : 'Mulher'}
                  active={filters.genero.includes(g)}
                  onClick={() => onChange({ ...filters, genero: toggleInArray(filters.genero, g) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Faixa Etaria">
              {IDADE_OPTIONS.map((age) => (
                <Chip
                  key={age}
                  label={age}
                  active={filters.faixa_etaria.includes(age)}
                  onClick={() => onChange({ ...filters, faixa_etaria: toggleInArray(filters.faixa_etaria, age) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Renda">
              {RENDA_OPTIONS.map((r) => (
                <Chip
                  key={r}
                  label={r.charAt(0).toUpperCase() + r.slice(1)}
                  active={filters.renda.includes(r)}
                  onClick={() => onChange({ ...filters, renda: toggleInArray(filters.renda, r) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Engajamento">
              {ENGAJAMENTO_OPTIONS.map((e) => (
                <Chip
                  key={e}
                  label={e.charAt(0).toUpperCase() + e.slice(1)}
                  active={filters.engajamento.includes(e)}
                  onClick={() => onChange({ ...filters, engajamento: toggleInArray(filters.engajamento, e) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Grupo">
              {GRUPO_OPTIONS.map((g) => (
                <Chip
                  key={g}
                  label={GRUPO_LABELS[g] || g}
                  active={filters.grupo.includes(g)}
                  onClick={() => onChange({ ...filters, grupo: toggleInArray(filters.grupo, g) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Temas de Interesse">
              {TEMA_OPTIONS.map((t) => (
                <Chip
                  key={t}
                  label={t.charAt(0).toUpperCase() + t.slice(1)}
                  active={filters.temas.includes(t)}
                  onClick={() => onChange({ ...filters, temas: toggleInArray(filters.temas, t) })}
                />
              ))}
            </FilterGroup>

            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 px-1">
                Profissao
              </span>
              <input
                type="text"
                value={filters.profissao}
                onChange={(e) => onChange({ ...filters, profissao: e.target.value })}
                placeholder="Digite uma profissao..."
                className={cn(
                  'w-full px-4 py-2.5',
                  'bg-white/[0.04] hover:bg-white/[0.06]',
                  'border border-white/[0.06] focus:border-emerald-500/40',
                  'rounded-xl text-xs text-white placeholder:text-zinc-600',
                  'outline-none focus:ring-1 focus:ring-emerald-500/20',
                  'transition-all duration-200',
                )}
              />
            </div>
          </div>

          {/* Footer with results count */}
          {totalResults > 0 && (
            <div className="px-5 pb-4 pt-0">
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-3" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">
                  {hasActiveFilters ? (
                    <>
                      Mostrando <span className="text-white font-semibold">{filteredCount}</span> de{' '}
                      <span className="text-zinc-300 font-medium">{totalResults}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-zinc-300 font-medium">{totalResults}</span> resultados
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-2',
                    'bg-emerald-500 hover:bg-emerald-400',
                    'text-black font-semibold text-xs',
                    'rounded-xl',
                    'shadow-lg shadow-emerald-500/25',
                    'active:scale-[0.97]',
                    'transition-all duration-200',
                  )}
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
