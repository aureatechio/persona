'use client';

import { cn } from '@/lib/utils';

interface RecalculatingOverlayProps {
  visible: boolean;
  personaCount: number;
}

export function RecalculatingOverlay({ visible, personaCount }: RecalculatingOverlayProps) {
  if (!visible) return null;

  return (
    <div className={cn(
      'absolute inset-0 bg-black/40 backdrop-blur-sm rounded-2xl',
      'flex items-center justify-center z-10',
      'transition-opacity duration-300',
      visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
    )}>
      <div className="flex flex-col items-center gap-4 max-w-xs">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm text-zinc-300 font-medium">
            Redistribuindo votos...
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Analisando {personaCount.toLocaleString('pt-BR')} personas
          </p>
        </div>
        <div className="w-48 h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full animate-[progress_1.5s_ease-in-out]"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
