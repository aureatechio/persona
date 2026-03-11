'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Search, ChevronDown, ArrowRight } from 'lucide-react';

interface SearchBarProps {
  onSearch: (username: string, maxCount: number) => void;
  loading: boolean;
  filterSlot?: React.ReactNode;
  defaultUsername?: string;
}

const QUANTITY_OPTIONS = [
  { value: 10, label: '10 primeiros' },
  { value: 20, label: '20 primeiros' },
  { value: 50, label: '50 primeiros' },
  { value: 100, label: '100 primeiros' },
];

export function SearchBar({ onSearch, loading, filterSlot, defaultUsername = '' }: SearchBarProps) {
  const [username, setUsername] = useState(defaultUsername);
  const [maxCount, setMaxCount] = useState(100);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = username
      .replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//, '')
      .replace(/\/.*$/, '')
      .replace(/^@/, '')
      .trim();
    if (!clean) return;
    onSearch(clean, maxCount);
  }

  const isValid = username.replace(/^@/, '').trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {/* Main input — big and prominent */}
      <div className="relative group">
        <div
          className={cn(
            'absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500',
            'bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-emerald-500/20',
          )}
        />
        <div className="relative flex items-center bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] group-focus-within:border-white/[0.15] rounded-2xl transition-all duration-300">
          <Search size={20} className="absolute left-5 text-zinc-600 group-focus-within:text-zinc-400 transition-colors duration-300" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Digite o @username do Instagram"
            disabled={loading}
            autoFocus
            className={cn(
              'w-full pl-14 pr-4 py-5',
              'bg-transparent',
              'text-lg text-white placeholder:text-zinc-600',
              'outline-none',
              'transition-all duration-200',
              'disabled:opacity-50',
            )}
          />
          {/* Submit button inside input */}
          <button
            type="submit"
            disabled={loading || !isValid}
            className={cn(
              'shrink-0 mr-2.5',
              'inline-flex items-center justify-center gap-2 px-6 py-3',
              'bg-emerald-500 hover:bg-emerald-400',
              'text-black font-semibold text-sm',
              'rounded-xl',
              'shadow-lg shadow-emerald-500/25',
              'hover:shadow-emerald-400/30',
              'active:scale-[0.97]',
              'transition-all duration-200',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none',
            )}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                Pesquisar
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Options row */}
      <div className="flex items-center gap-3 px-1">
        {/* Quantity select */}
        <div className="relative">
          <select
            value={maxCount}
            onChange={(e) => setMaxCount(Number(e.target.value))}
            disabled={loading}
            className={cn(
              'appearance-none px-4 py-2 pr-9',
              'bg-white/[0.04] hover:bg-white/[0.07]',
              'border border-white/[0.08] hover:border-white/[0.15]',
              'rounded-xl text-xs text-zinc-400 hover:text-zinc-300',
              'outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50',
              'transition-all duration-200 cursor-pointer',
              'disabled:opacity-50',
            )}
          >
            {QUANTITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
          />
        </div>

        {/* Campaign select (placeholder) */}
        <div className="relative">
          <select
            disabled
            className={cn(
              'appearance-none px-4 py-2 pr-9',
              'bg-white/[0.03]',
              'border border-white/[0.06]',
              'rounded-xl text-xs text-zinc-600',
              'outline-none',
              'cursor-not-allowed',
            )}
          >
            <option className="bg-zinc-900">Campanha</option>
          </select>
          <ChevronDown
            size={12}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
          />
        </div>

        {filterSlot}

        <span className="text-[10px] text-zinc-700 ml-1 hidden sm:inline">
          Selecione a quantidade de seguidores para analisar
        </span>
      </div>
    </form>
  );
}
