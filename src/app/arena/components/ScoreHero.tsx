// Arena PWA — ScoreHero (exact match of mobile ScoreHero.tsx)
// Card with glow, "NOTA" label, emoji + score, personas count, live jitter

'use client';

import { useEffect, useState, memo } from 'react';
import { scoreToEmoji, scoreToHex } from '../constants';

interface ScoreHeroProps {
  avgScore: number;
  processedCount: number;
  isLive?: boolean;
}

export const ScoreHero = memo(function ScoreHero({ avgScore, processedCount, isLive }: ScoreHeroProps) {
  const hasData = processedCount > 0;
  const baseScore = avgScore ?? 0;
  const [jitter, setJitter] = useState(0);

  useEffect(() => {
    if (!isLive || !hasData) { setJitter(0); return; }
    const freq = 1200 + Math.random() * 800;
    const interval = setInterval(() => {
      setJitter((Math.random() - 0.5) * 0.5);
    }, freq);
    return () => clearInterval(interval);
  }, [isLive, hasData]);

  const display = Math.max(0, Math.min(10, baseScore + (isLive && hasData ? jitter : 0)));
  const emoji = scoreToEmoji(display);
  const hex = scoreToHex(display);

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-[20px] overflow-hidden py-5 px-6"
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: `0.5px solid ${hex}33`,
      }}
    >
      {/* Glow */}
      <div className="absolute inset-0 rounded-[20px]" style={{ backgroundColor: `${hex}15` }} />

      <span className="text-[10px] font-black text-zinc-500 tracking-[2px] uppercase relative">NOTA</span>

      <div className="flex items-center gap-2 mt-1 relative">
        <span className="text-4xl">{hasData ? emoji : ''}</span>
        <span
          className="text-5xl font-black tabular-nums"
          style={{ color: hex }}
        >
          {hasData ? display.toFixed(1) : '0.0'}
        </span>
      </div>

      <span className="text-xs text-zinc-600 tabular-nums mt-1 relative">
        {hasData ? processedCount.toLocaleString('pt-BR') : '0'} personas
      </span>
    </div>
  );
});
