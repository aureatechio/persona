'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Globe, Instagram, Users } from 'lucide-react';

interface Account {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  analyzed_count: number;
}

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelect: (accountId: string | null) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AccountSelector({ accounts, selectedAccountId, onSelect }: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = accounts.find((a) => a.id === selectedAccountId);
  const totalAnalyzed = accounts.reduce((s, a) => s + a.analyzed_count, 0);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2.5 px-3.5 py-2',
          'bg-white/[0.03] hover:bg-white/[0.06]',
          'border border-white/[0.06] hover:border-white/[0.12]',
          'rounded-xl text-sm',
          'transition-all duration-200 cursor-pointer',
          open && 'border-emerald-500/20 bg-emerald-500/[0.03] shadow-lg shadow-emerald-500/5',
        )}
      >
        {selected ? (
          <>
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500/30 to-violet-500/30 flex items-center justify-center">
              <Instagram size={10} className="text-pink-300" />
            </div>
            <span className="text-white font-medium text-[13px]">@{selected.username}</span>
            <span className="text-[10px] text-zinc-600 font-mono">{selected.analyzed_count}</span>
          </>
        ) : (
          <>
            <Globe size={14} className="text-zinc-500" />
            <span className="text-zinc-400 font-medium text-[13px]">Todas as contas</span>
          </>
        )}
        <ChevronDown
          size={12}
          className={cn('text-zinc-600 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute top-full right-0 mt-2 z-50 min-w-[320px]',
            'bg-zinc-950/98 backdrop-blur-2xl',
            'border border-white/[0.08]',
            'rounded-2xl shadow-2xl shadow-black/60',
            'animate-in fade-in slide-in-from-top-2 duration-200',
            'overflow-hidden',
          )}
        >
          {/* Header */}
          <div className="px-4 pt-3.5 pb-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
              Selecionar conta
            </p>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* All accounts */}
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3',
              'hover:bg-white/[0.04] transition-all duration-200',
              !selectedAccountId && 'bg-emerald-500/[0.04]',
            )}
          >
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center',
              !selectedAccountId ? 'bg-emerald-500/10' : 'bg-white/[0.04]',
            )}>
              <Globe size={16} className={cn(!selectedAccountId ? 'text-emerald-400' : 'text-zinc-500')} />
            </div>
            <div className="text-left flex-1">
              <p className={cn('text-sm font-medium', !selectedAccountId ? 'text-emerald-400' : 'text-zinc-300')}>
                Todas as contas
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Users size={9} className="text-zinc-600" />
                <p className="text-[10px] text-zinc-600">
                  {totalAnalyzed} perfis analisados
                </p>
              </div>
            </div>
          </button>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent mx-3" />

          {/* Account list */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => { onSelect(acc.id); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5',
                  'hover:bg-white/[0.04] transition-all duration-200',
                  selectedAccountId === acc.id && 'bg-emerald-500/[0.04]',
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  'bg-gradient-to-br from-pink-500/10 to-violet-500/10',
                  'border border-white/[0.04]',
                )}>
                  <Instagram size={14} className="text-pink-400/70" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    selectedAccountId === acc.id ? 'text-emerald-400' : 'text-zinc-300',
                  )}>
                    @{acc.username}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-zinc-600">
                      {formatCount(acc.analyzed_count)} analisados
                    </span>
                  </div>
                </div>
                {selectedAccountId === acc.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
