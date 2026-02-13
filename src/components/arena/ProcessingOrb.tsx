'use client';

import { Brain } from 'lucide-react';

export function ProcessingOrb() {
  return (
    <div className="relative w-44 h-44 flex items-center justify-center">
      {/* Outer ping rings */}
      <div className="absolute inset-0 rounded-full border border-violet-500/10 arena-radar-pulse" />
      <div className="absolute inset-0 rounded-full border border-fuchsia-500/10 arena-radar-pulse" style={{ animationDelay: '0.7s' }} />
      <div className="absolute inset-0 rounded-full border border-violet-500/5 arena-radar-pulse" style={{ animationDelay: '1.4s' }} />

      {/* Rotating ring */}
      <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-violet-500/60 border-r-fuchsia-500/40 animate-spin" style={{ animationDuration: '2s' }} />

      {/* Inner rotating ring */}
      <div className="absolute inset-6 rounded-full border-2 border-transparent border-b-violet-400/50 border-l-cyan-400/30 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />

      {/* Core glow */}
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 flex items-center justify-center backdrop-blur-sm border border-violet-500/20">
        <Brain size={30} className="text-violet-400 animate-pulse" />
      </div>
    </div>
  );
}
