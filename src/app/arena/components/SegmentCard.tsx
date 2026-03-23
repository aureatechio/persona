// Arena PWA — SegmentCard (exact match of mobile SegmentCard.tsx)
// Gradient overlay bar with indicator dot, score + pct diff, live jitter

'use client';

import { useMemo, useEffect, useState, memo, useCallback } from 'react';
import type { SegmentItem } from '../types';
import { scoreToHex } from '../constants';

const ACCENT_HEX: Record<string, string> = {
  emerald: '#34d399', amber: '#fbbf24', violet: '#8b5cf6', cyan: '#22d3ee',
  sky: '#38bdf8', rose: '#fb7185', fuchsia: '#d946ef', indigo: '#818cf8',
  orange: '#fb923c', pink: '#f472b6',
};

interface SegmentCardProps {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
  maxItems?: number;
  isLive?: boolean;
}

// ── Segment Row with live jitter ──
const SegmentRow = memo(function SegmentRow({ item, clusterAvg, isLive }: { item: SegmentItem; clusterAvg: number; isLive?: boolean }) {
  const hasData = item.count > 0;
  const baseScore = item.avgScore ?? 0;
  const hex = scoreToHex(baseScore);
  const [jitter, setJitter] = useState(0);

  useEffect(() => {
    if (!isLive || !hasData) { setJitter(0); return; }
    const freq = 800 + Math.random() * 1200;
    const interval = setInterval(() => {
      setJitter((Math.random() - 0.5) * 0.6);
    }, freq);
    return () => clearInterval(interval);
  }, [isLive, hasData]);

  const display = Math.max(0, Math.min(10, baseScore + (isLive && hasData ? jitter : 0)));
  const pos = (display / 10) * 100;
  const diff = clusterAvg > 0 ? ((display - clusterAvg) / clusterAvg) * 100 : 0;
  const showPct = hasData && clusterAvg > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Label */}
      <span className="w-[76px] text-[10px] text-zinc-400 shrink-0 truncate">{item.label}</span>

      {/* Bar with gradient overlay + indicator */}
      <div
        className="flex-1 h-2.5 rounded-[5px] overflow-hidden relative"
        style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 opacity-20 rounded-[5px]"
          style={{ background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)' }}
        />
        {/* Indicator dot */}
        {hasData && (
          <div
            className="absolute top-0 h-full w-2 rounded transition-all duration-300"
            style={{
              left: `${Math.max(0, Math.min(98, pos))}%`,
              backgroundColor: hex,
              boxShadow: `0 0 4px ${hex}99`,
            }}
          />
        )}
      </div>

      {/* Score + pct */}
      <div className="w-14 flex flex-col items-end shrink-0">
        <span className="text-[13px] font-black tabular-nums" style={{ color: hasData ? hex : '#52525b' }}>
          {hasData ? display.toFixed(1) : '—'}
        </span>
        {showPct && (
          <span
            className="text-[9px] font-bold tabular-nums"
            style={{ color: diff >= 0 ? '#34d399' : '#fb7185' }}
          >
            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
});

// ── Main Card ──
export const SegmentCard = memo(function SegmentCard({ items, title, accentColor, maxItems = 6, isLive }: SegmentCardProps) {
  const hex = ACCENT_HEX[accentColor] || ACCENT_HEX.emerald;

  const { paddedItems, clusterAvg } = useMemo(() => {
    const sorted = items && items.length > 0
      ? [...items]
        .sort((a, b) => {
          if (a.count > 0 && b.count === 0) return -1;
          if (a.count === 0 && b.count > 0) return 1;
          return (b.avgScore ?? 0) - (a.avgScore ?? 0);
        })
        .slice(0, maxItems)
      : [];

    const withData = sorted.filter((i) => i.count > 0);
    const avg = withData.length > 0
      ? withData.reduce((sum, i) => sum + (i.avgScore ?? 0), 0) / withData.length
      : 0;

    return { paddedItems: sorted, clusterAvg: avg };
  }, [items, maxItems]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '0.5px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5"
        style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}
      >
        <div className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: hex }} />
        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: `${hex}cc` }}>
          {title}
        </span>
      </div>

      {/* Items */}
      <div className="px-2.5 py-2 space-y-1.5">
        {paddedItems.map((item, idx) => (
          <SegmentRow
            key={item.label !== '—' ? item.label : `ph-${idx}`}
            item={item}
            clusterAvg={clusterAvg}
            isLive={isLive}
          />
        ))}
        {paddedItems.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-3">Aguardando dados...</p>
        )}
      </div>
    </div>
  );
});
