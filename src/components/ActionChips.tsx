'use client';

import { Activity, Swords, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Mode = 'arena' | 'eleitoral' | 'chat';

interface ActionChipsProps {
  activeMode: Mode | null;
  onSelect: (mode: Mode) => void;
  compact?: boolean;
}

const chips: { id: Mode; label: string; icon: typeof Activity }[] = [
  { id: 'arena', label: 'Arena', icon: Activity },
  { id: 'eleitoral', label: 'Eleitoral', icon: Swords },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

export function ActionChips({ activeMode, onSelect, compact }: ActionChipsProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', compact ? 'gap-1.5' : 'gap-2')}>
      {chips.map(chip => {
        const isActive = activeMode === chip.id;
        const Icon = chip.icon;

        return (
          <button
            key={chip.id}
            onClick={() => onSelect(chip.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl font-medium transition-all duration-200 active:scale-[0.97] border',
              compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              isActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10'
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 hover:border-white/[0.15]'
            )}
          >
            <Icon size={compact ? 14 : 16} />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
