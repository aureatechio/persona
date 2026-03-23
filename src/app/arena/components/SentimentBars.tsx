// Arena PWA — SentimentBars (exact match of mobile SentimentBars.tsx)
// Individual horizontal bars: label | bar | percentage, with live jitter

'use client';

import { useEffect, useState, memo } from 'react';

const BARS = [
  { key: 'positive', label: 'Positivo', color: '#34d399' },
  { key: 'negative', label: 'Negativo', color: '#fb7185' },
  { key: 'neutral', label: 'Neutro', color: '#fbbf24' },
] as const;

interface SentimentBarsProps {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  isLive?: boolean;
}

function SentimentBarRow({ pct, label, color, isLive }: { pct: number; label: string; color: string; isLive?: boolean }) {
  const hasData = pct > 0;
  const [jitter, setJitter] = useState(0);

  useEffect(() => {
    if (!isLive || !hasData) { setJitter(0); return; }
    const freq = 900 + Math.random() * 1100;
    const interval = setInterval(() => {
      setJitter((Math.random() - 0.5) * 2);
    }, freq);
    return () => clearInterval(interval);
  }, [isLive, hasData]);

  const display = Math.max(0, Math.min(100, pct + (isLive && hasData ? jitter : 0)));

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[60px] text-[10px] font-medium text-zinc-500 uppercase tracking-wide shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(39,39,42,0.5)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${display}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-9 text-right text-[11px] font-bold tabular-nums" style={{ color }}>
        {Math.round(display)}%
      </span>
    </div>
  );
}

export const SentimentBars = memo(function SentimentBars({ positive, negative, neutral, total, isLive }: SentimentBarsProps) {
  const values = {
    positive: total > 0 ? (positive / total) * 100 : 0,
    negative: total > 0 ? (negative / total) * 100 : 0,
    neutral: total > 0 ? (neutral / total) * 100 : 0,
  };

  return (
    <div className="space-y-2">
      {BARS.map((b) => (
        <SentimentBarRow key={b.key} pct={values[b.key]} label={b.label} color={b.color} isLive={isLive} />
      ))}
    </div>
  );
});
