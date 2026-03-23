// Arena PWA — Segment Card (ranked items with score bars)

'use client';

import { useMemo, useState, useEffect } from 'react';
import type { SegmentItem } from '../types';
import { scoreToHex } from '../constants';

interface SegmentCardProps {
  items?: SegmentItem[];
  title: string;
  accentColor: string;
  maxItems?: number;
  isLive?: boolean;
}

const ACCENT_HEX: Record<string, string> = {
  emerald: '#34d399', amber: '#fbbf24', violet: '#8b5cf6', cyan: '#22d3ee',
  sky: '#38bdf8', rose: '#fb7185', fuchsia: '#d946ef', indigo: '#818cf8',
  orange: '#fb923c', pink: '#f472b6',
};

export function SegmentCard({ items, title, accentColor, maxItems = 6, isLive }: SegmentCardProps) {
  const hex = ACCENT_HEX[accentColor] || '#34d399';

  const sorted = useMemo(() => {
    if (!items) return [];
    return [...items]
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)
      .slice(0, maxItems);
  }, [items, maxItems]);

  // Cluster average for diff display
  const clusterAvg = useMemo(() => {
    if (!sorted.length) return 5;
    const total = sorted.reduce((sum, s) => sum + s.count, 0);
    const weighted = sorted.reduce((sum, s) => sum + s.avgScore * s.count, 0);
    return total > 0 ? weighted / total : 5;
  }, [sorted]);

  if (!sorted.length) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{title}</span>
        </div>
        <p className="text-xs text-zinc-600 text-center py-4">Aguardando dados...</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{title}</span>
      </div>

      <div className="space-y-2">
        {sorted.map((item) => (
          <SegmentRow key={item.label} item={item} clusterAvg={clusterAvg} isLive={isLive} />
        ))}
      </div>
    </div>
  );
}

function SegmentRow({ item, clusterAvg, isLive }: { item: SegmentItem; clusterAvg: number; isLive?: boolean }) {
  const [jitter, setJitter] = useState(0);
  const score = item.avgScore;
  const hex = scoreToHex(score + jitter);
  const diff = score - clusterAvg;
  const barPct = Math.min(((score + jitter) / 10) * 100, 100);

  // Live jitter effect
  useEffect(() => {
    if (!isLive) { setJitter(0); return; }
    const interval = setInterval(() => {
      setJitter((Math.random() - 0.5) * 0.8);
    }, 800 + Math.random() * 400);
    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 w-28 truncate shrink-0">{item.label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${barPct}%`,
            backgroundColor: `${hex}40`,
          }}
        />
        <div
          className="absolute top-0 h-full w-1.5 rounded-full -ml-[3px] transition-all duration-500"
          style={{
            left: `${barPct}%`,
            backgroundColor: hex,
            boxShadow: `0 0 6px ${hex}80`,
          }}
        />
      </div>
      <span className="text-xs font-black tabular-nums w-8 text-right" style={{ color: hex }}>
        {(score + jitter).toFixed(1)}
      </span>
      {Math.abs(diff) > 0.1 && (
        <span className={`text-[9px] font-bold tabular-nums w-10 text-right ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {diff > 0 ? '+' : ''}{diff.toFixed(1)}
        </span>
      )}
    </div>
  );
}
