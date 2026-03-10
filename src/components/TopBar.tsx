'use client';

import { Plus } from 'lucide-react';
import { AvatarMenu } from './AvatarMenu';

interface TopBarProps {
  personaCount: number;
  hasBlocks?: boolean;
  onNewChat?: () => void;
}

export function TopBar({ personaCount, hasBlocks, onNewChat }: TopBarProps) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.04]">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
          <div className="w-4 h-4 bg-black rounded-sm rotate-45" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white">Persona</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {hasBlocks && onNewChat && (
          <button
            onClick={onNewChat}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/[0.15] text-zinc-400 hover:text-white text-xs font-semibold active:scale-[0.97] transition-all duration-200"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Novo Chat</span>
          </button>
        )}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-zinc-400 tabular-nums">
            {personaCount.toLocaleString('pt-BR')} personas
          </span>
        </div>
        <AvatarMenu />
      </div>
    </header>
  );
}
