// Arena PWA — ScoreBar (exact match of mobile ScoreBar.tsx)
// Gradient bar with indicator dot, emoji scale, live jitter

'use client';

import { useEffect, useState, memo } from 'react';
import { scoreToHex } from '../constants';

const SCALE_ITEMS = [
  { score: 1, emoji: '💣' },
  { score: 3, emoji: '😡' },
  { score: 5, emoji: '😐' },
  { score: 7, emoji: '👍' },
  { score: 9, emoji: '❤️' },
  { score: 10, emoji: '🔥' },
];

interface ScoreBarProps {
  avgScore: number;
  totalCount: number;
  isLive?: boolean;
}

export const ScoreBar = memo(function ScoreBar({ avgScore, totalCount, isLive }: ScoreBarProps) {
  const hex = scoreToHex(avgScore);
  const hasData = totalCount > 0;
  const [jitter, setJitter] = useState(0);

  useEffect(() => {
    if (!isLive || !hasData) { setJitter(0); return; }
    const freq = 1000 + Math.random() * 1000;
    const interval = setInterval(() => {
      setJitter((Math.random() - 0.5) * 4);
    }, freq);
    return () => clearInterval(interval);
  }, [isLive, hasData]);

  const basePos = (avgScore / 10) * 100;
  const pos = Math.max(1, Math.min(99, basePos + (isLive && hasData ? jitter : 0)));

  return (
    <div className="space-y-1.5">
      {/* Gradient bar */}
      <div
        className="relative h-6 rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 rounded-xl opacity-30"
          style={{
            background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)',
          }}
        />
        {/* Indicator */}
        {hasData && (
          <div
            className="absolute top-[3px] bottom-[3px] w-1 rounded-sm transition-all duration-300"
            style={{
              left: `${pos}%`,
              marginLeft: -2,
              backgroundColor: hex,
              boxShadow: `0 0 6px ${hex}cc`,
            }}
          />
        )}
      </div>

      {/* Emoji scale */}
      <div className="flex justify-between px-1">
        {SCALE_ITEMS.map((s) => (
          <span key={s.score} className="text-xs">{s.emoji}</span>
        ))}
      </div>
    </div>
  );
});
