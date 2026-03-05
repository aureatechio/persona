'use client';

import { cn } from '@/lib/utils';
import { Search, RotateCcw } from 'lucide-react';
import { GRUPO_OPTIONS, GROUP_LABELS } from '@/lib/instagram-groups';

export interface MessageFilters {
  status: string[];
  grupo: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

export const EMPTY_MESSAGE_FILTERS: MessageFilters = {
  status: [],
  grupo: '',
  dateFrom: '',
  dateTo: '',
  search: '',
};

interface FilterBarProps {
  filters: MessageFilters;
  onChange: (filters: MessageFilters) => void;
}

const STATUS_OPTIONS = [
  { value: 'sent', label: 'Enviado', color: 'emerald' },
  { value: 'pending', label: 'Pendente', color: 'amber' },
  { value: 'failed', label: 'Erro', color: 'red' },
  { value: 'delivered', label: 'Entregue', color: 'sky' },
];

function toggleInArray(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const hasActive = filters.status.length > 0 || !!filters.grupo || !!filters.dateFrom || !!filters.dateTo || !!filters.search;

  return (
    <div className={cn(
      'bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4',
      'space-y-3',
    )}>
      {/* Row 1: Search + Date + Clear */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Buscar por username..."
            className={cn(
              'w-full pl-9 pr-3 py-2',
              'bg-white/[0.04] hover:bg-white/[0.06]',
              'border border-white/[0.06] focus:border-emerald-500/40',
              'rounded-xl text-xs text-white placeholder:text-zinc-600',
              'outline-none focus:ring-1 focus:ring-emerald-500/20',
              'transition-all duration-200',
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            className={cn(
              'px-3 py-2 bg-white/[0.04] border border-white/[0.06]',
              'rounded-xl text-xs text-zinc-400',
              'outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20',
              'transition-all duration-200',
              '[color-scheme:dark]',
            )}
          />
          <span className="text-zinc-600 text-xs">ate</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            className={cn(
              'px-3 py-2 bg-white/[0.04] border border-white/[0.06]',
              'rounded-xl text-xs text-zinc-400',
              'outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20',
              'transition-all duration-200',
              '[color-scheme:dark]',
            )}
          />
        </div>

        {hasActive && (
          <button
            onClick={() => onChange({ ...EMPTY_MESSAGE_FILTERS })}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2',
              'bg-red-500/10 hover:bg-red-500/15',
              'border border-red-500/20 hover:border-red-500/30',
              'rounded-xl text-xs font-medium text-red-400',
              'transition-all duration-200 active:scale-[0.95]',
            )}
          >
            <RotateCcw size={11} />
            Limpar
          </button>
        )}
      </div>

      {/* Row 2: Status chips + Grupo selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mr-1">Status:</span>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange({ ...filters, status: toggleInArray(filters.status, s.value) })}
            className={cn(
              'px-3 py-1.5 rounded-xl text-[11px] font-medium',
              'border transition-all duration-200 active:scale-[0.95]',
              filters.status.includes(s.value)
                ? `bg-${s.color}-500/15 text-${s.color}-400 border-${s.color}-500/30`
                : 'bg-white/[0.03] text-zinc-500 border-white/[0.05] hover:text-zinc-300 hover:bg-white/[0.06]',
            )}
          >
            {s.label}
          </button>
        ))}

        <div className="h-4 w-px bg-zinc-800/50 mx-1" />

        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mr-1">Grupo:</span>
        <select
          value={filters.grupo}
          onChange={(e) => onChange({ ...filters, grupo: e.target.value })}
          className={cn(
            'px-3 py-1.5 bg-white/[0.04] border border-white/[0.06]',
            'rounded-xl text-[11px] text-zinc-400',
            'outline-none focus:border-emerald-500/40',
            'transition-all duration-200 cursor-pointer',
            '[color-scheme:dark]',
          )}
        >
          <option value="">Todos</option>
          {GRUPO_OPTIONS.map((g) => (
            <option key={g} value={g}>{GROUP_LABELS[g] || g}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
