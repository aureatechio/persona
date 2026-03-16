'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/hooks/useAnimatedValue';
import { scoreToEmoji, scoreToLabel, scoreToHex } from '@/lib/arena/types';
import type { SegmentItem } from '@/lib/arena/segments';
import type { ReactNode } from 'react';

/* ════════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════════ */

function shallowEqualSegments(a: SegmentItem[] | undefined, b: SegmentItem[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((item, i) =>
    item.label === b[i].label &&
    item.count === b[i].count &&
    item.positive === b[i].positive &&
    item.negative === b[i].negative &&
    item.neutral === b[i].neutral &&
    item.avgScore === b[i].avgScore
  );
}

/* ════════════════════════════════════════════════════════════════════
   SPECTRUM GAUGE v2 — Horizontal scale with distribution markers
   ════════════════════════════════════════════════════════════════════ */

export function SpectrumGauge({
  items,
  title,
  accentColor,
  leftLabel,
  rightLabel,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
  leftLabel: string;
  rightLabel: string;
}) {
  const safeItems = items && items.length > 0 ? items : [];

  const accentMap: Record<string, { text: string; label: string }> = {
    emerald: { text: 'text-emerald-400', label: 'text-emerald-400/80' },
    amber:   { text: 'text-amber-400',   label: 'text-amber-400/80' },
    violet:  { text: 'text-violet-400',  label: 'text-violet-400/80' },
    cyan:    { text: 'text-cyan-400',    label: 'text-cyan-400/80' },
    sky:     { text: 'text-sky-400',     label: 'text-sky-400/80' },
    rose:    { text: 'text-rose-400',    label: 'text-rose-400/80' },
    fuchsia: { text: 'text-fuchsia-400', label: 'text-fuchsia-400/80' },
    indigo:  { text: 'text-indigo-400',  label: 'text-indigo-400/80' },
    orange:  { text: 'text-orange-400',  label: 'text-orange-400/80' },
    pink:    { text: 'text-pink-400',    label: 'text-pink-400/80' },
  };
  const c = accentMap[accentColor] || accentMap.emerald;

  const totalCount = safeItems.reduce((s, i) => s + i.count, 0);
  const hasData = totalCount > 0;

  const positionMap: Record<string, number> = {
    'Esquerda Forte': 0, 'Progressista Forte': 0,
    'Centro-Esquerda': 1, 'Progressista': 1,
    'Centro': 2,
    'Centro-Direita': 3, 'Conservador': 3,
    'Direita Forte': 4, 'Conservador Forte': 4,
  };

  const buckets = safeItems.map(item => ({
    ...item,
    pos: positionMap[item.label] ?? 2,
    pct: hasData ? Math.round((item.count / totalCount) * 100) : 0,
  })).sort((a, b) => a.pos - b.pos);

  // If no items at all, show empty card shell
  if (buckets.length === 0) {
    return (
      <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col h-full">
        <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 min-w-0">
          <div className={cn('w-2 h-2 rounded-full shrink-0', c.text.replace('text-', 'bg-'))} />
          <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
        </div>
        <div className="flex-1 flex flex-col justify-center px-5 py-3 gap-3">
          <div className="text-center">
            <p className="text-3xl font-black tabular-nums leading-none text-zinc-600">0%</p>
            <p className="text-sm font-bold text-zinc-500 mt-1">—</p>
          </div>
          <div className="h-[16px] rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, #ef4444, #f97316, #a855f7, #38bdf8, #3b82f6)`, opacity: 0.15 }} />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-400/40 uppercase tracking-wider">{leftLabel}</span>
            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Centro</span>
            <span className="text-xs font-bold text-blue-400/40 uppercase tracking-wider">{rightLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  const dominant = buckets.reduce((max, b) => b.count > max.count ? b : max, buckets[0]);

  const spectrumColors = ['#ef4444', '#f97316', '#a855f7', '#38bdf8', '#3b82f6'];

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col h-full">
      <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 min-w-0">
        <div className={cn('w-2 h-2 rounded-full shrink-0', c.text.replace('text-', 'bg-'))} />
        <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-5 py-3 gap-3">
        {/* Dominant value — score of the largest bucket */}
        {(() => {
          const dScore = dominant.avgScore ?? 5.0;
          const dEmoji = scoreToEmoji(dScore);
          const dHex = scoreToHex(dScore);
          return (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl leading-none">{hasData ? dEmoji : ''}</span>
                <p className="text-3xl font-black tabular-nums leading-none transition-colors duration-500" style={{ color: hasData ? dHex : '#52525b' }}>
                  {hasData ? dScore.toFixed(1) : '—'}
                </p>
              </div>
              <p className="text-sm font-bold text-zinc-400 mt-1">{dominant.label} <span className="text-zinc-600">({dominant.pct}%)</span></p>
            </div>
          );
        })()}

        {/* Spectrum bar */}
        <div className="relative">
          <div
            className="h-[16px] rounded-full overflow-hidden"
            style={{
              background: `linear-gradient(to right, ${spectrumColors.join(', ')})`,
              opacity: 0.3,
            }}
          />
          {/* Bubble markers */}
          <div className="absolute inset-0 flex items-center">
            {buckets.map((b) => {
              const leftPos = (b.pos / 4) * 100;
              const size = hasData ? Math.max(18, Math.min(34, (b.pct / 40) * 34)) : 18;
              return (
                <div
                  key={b.label}
                  className="absolute flex items-center justify-center transition-all duration-[4s]"
                  style={{
                    left: `${leftPos}%`,
                    transform: 'translateX(-50%)',
                    width: `${size}px`,
                    height: `${size}px`,
                  }}
                >
                  <div
                    className="w-full h-full rounded-full border-2 border-white/40 flex items-center justify-center"
                    style={{ background: spectrumColors[b.pos] || spectrumColors[2], opacity: 0.9 }}
                  >
                    {size >= 22 && (
                      <span className="text-[9px] font-black text-white">{b.pct}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Axis labels */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-red-400/70 uppercase tracking-wider">{leftLabel}</span>
          <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Centro</span>
          <span className="text-xs font-bold text-blue-400/70 uppercase tracking-wider">{rightLabel}</span>
        </div>

        {/* Score per bucket */}
        <div className="flex items-center gap-1">
          {buckets.map((b) => {
            const bScore = b.avgScore ?? 5.0;
            const bHex = scoreToHex(bScore);
            const bEmoji = scoreToEmoji(bScore);
            return (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                <span className="text-xs leading-none">{hasData ? bEmoji : ''}</span>
                <span className="text-[10px] font-black tabular-nums" style={{ color: hasData ? bHex : '#52525b' }}>
                  {hasData ? bScore.toFixed(1) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   QUADRANT GRID v2 — 2x2 blocks with dual-metric (share + sentiment)
   ════════════════════════════════════════════════════════════════════ */

const QUADRANT_COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  'Direita + Conservador':    { bg: 'bg-blue-500/20',    border: 'border-blue-500/30',    text: 'text-blue-400',    glow: 'bg-blue-500/10' },
  'Direita + Progressista':   { bg: 'bg-sky-500/20',     border: 'border-sky-500/30',     text: 'text-sky-400',     glow: 'bg-sky-500/10' },
  'Esquerda + Progressista':  { bg: 'bg-rose-500/20',   border: 'border-rose-500/30',   text: 'text-rose-400',   glow: 'bg-rose-500/10' },
  'Esquerda + Conservador':   { bg: 'bg-red-500/20',    border: 'border-red-500/30',    text: 'text-red-400',    glow: 'bg-red-500/10' },
};
const QUADRANT_COLOR_FALLBACK = { bg: 'bg-zinc-500/20', border: 'border-zinc-500/30', text: 'text-zinc-400', glow: 'bg-zinc-500/10' };

const DEFAULT_QUADRANTS: SegmentItem[] = [
  { label: 'Direita + Conservador', count: 0, positive: 0, negative: 0, neutral: 0, avgScore: 5.0 },
  { label: 'Direita + Progressista', count: 0, positive: 0, negative: 0, neutral: 0, avgScore: 5.0 },
  { label: 'Esquerda + Progressista', count: 0, positive: 0, negative: 0, neutral: 0, avgScore: 5.0 },
  { label: 'Esquerda + Conservador', count: 0, positive: 0, negative: 0, neutral: 0, avgScore: 5.0 },
];

export function QuadrantGrid({
  items,
  title,
  accentColor,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
}) {
  const quads = (items && items.length > 0 ? items : DEFAULT_QUADRANTS).slice(0, 4);
  const totalCount = quads.reduce((s, i) => s + i.count, 0);
  const hasQData = totalCount > 0;

  const accentMap: Record<string, { text: string; label: string }> = {
    emerald: { text: 'text-emerald-400', label: 'text-emerald-400/80' },
    cyan:    { text: 'text-cyan-400',    label: 'text-cyan-400/80' },
    violet:  { text: 'text-violet-400',  label: 'text-violet-400/80' },
    sky:     { text: 'text-sky-400',     label: 'text-sky-400/80' },
    indigo:  { text: 'text-indigo-400',  label: 'text-indigo-400/80' },
  };
  const c = accentMap[accentColor] || accentMap.cyan;

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col h-full">
      <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 min-w-0">
        <div className={cn('w-2 h-2 rounded-full shrink-0', c.text.replace('text-', 'bg-'))} />
        <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
      </div>

      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-1.5 p-2.5 min-h-0">
        {quads.map((q) => {
          const qc = QUADRANT_COLOR_MAP[q.label] || QUADRANT_COLOR_FALLBACK;
          const pct = hasQData ? Math.round((q.count / totalCount) * 100) : 0;
          const score = q.avgScore ?? 5.0;

          return (
            <div
              key={q.label}
              className={cn(
                'relative overflow-hidden rounded-xl flex flex-col items-center justify-center gap-1 p-2',
                qc.bg, qc.border, 'border',
              )}
            >
              <div className={cn('absolute -top-6 -right-6 w-12 h-12 rounded-full blur-xl pointer-events-none', qc.glow)} />
              <p className={cn('text-2xl font-black tabular-nums leading-none', qc.text)}><AnimatedNumber value={pct} suffix="%" /></p>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center leading-tight truncate max-w-full">
                {q.label}
              </p>
              {/* Score indicator */}
              <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">{scoreToEmoji(score)}</span>
                <span className="text-sm font-black tabular-nums" style={{ color: scoreToHex(score) }}>
                  {hasQData ? score.toFixed(1) : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SCORE HERO — Giant unified 0-10 score with emoji (replaces TrendHero)
   ════════════════════════════════════════════════════════════════════ */

export const ScoreHero = memo(function ScoreHero({
  avgScore,
  totalCount,
  processedCount,
  rightSlot,
}: {
  avgScore: number;
  totalCount: number;
  processedCount: number;
  rightSlot?: ReactNode;
}) {
  const score = avgScore ?? 5.0;
  const emoji = scoreToEmoji(score);
  const label = scoreToLabel(score);
  const hex = scoreToHex(score);

  return (
    <div className="shrink-0 flex items-stretch gap-3 px-5 py-4 border-b border-white/[0.04]">
      {/* Main score */}
      <div className="relative overflow-hidden shrink-0 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] px-8 py-3 flex flex-col items-center justify-center" style={{ borderColor: `${hex}33` }}>
        {/* Glow */}
        <div className="absolute inset-0 bg-gradient-to-br pointer-events-none opacity-30" style={{ background: `radial-gradient(ellipse at center, ${hex}20, transparent 70%)` }} />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 relative">Nota</p>
        <div className="flex items-center gap-3 relative">
          <span className="text-4xl leading-none">{emoji}</span>
          <span className="text-5xl font-black tabular-nums leading-none" style={{ color: hex }}>
            {processedCount > 0 ? score.toFixed(1) : '—'}
          </span>
        </div>
        <p className="text-sm font-bold relative mt-1" style={{ color: `${hex}cc` }}>{label}</p>
        <p className="text-xs text-zinc-600 tabular-nums relative">
          {processedCount > 0 ? processedCount.toLocaleString('pt-BR') : '0'} personas
        </p>
      </div>

      {/* Right Slot */}
      {rightSlot && (
        <div className="flex-1 min-w-0 flex items-stretch">
          {rightSlot}
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════════════
   SCORE SEGMENT CARD — List of items with individual 0-10 scores
   Replaces DonutCard and HBarChart
   ════════════════════════════════════════════════════════════════════ */

export const ScoreSegmentCard = memo(function ScoreSegmentCard({
  items,
  title,
  accentColor,
  maxItems = 7,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
  maxItems?: number;
}) {
  const accentMap: Record<string, { text: string; label: string; glow: string }> = {
    emerald: { text: 'text-emerald-400', label: 'text-emerald-400/80', glow: 'bg-emerald-500/8' },
    amber:   { text: 'text-amber-400',   label: 'text-amber-400/80',   glow: 'bg-amber-500/8' },
    violet:  { text: 'text-violet-400',   label: 'text-violet-400/80',  glow: 'bg-violet-500/8' },
    cyan:    { text: 'text-cyan-400',     label: 'text-cyan-400/80',    glow: 'bg-cyan-500/8' },
    sky:     { text: 'text-sky-400',      label: 'text-sky-400/80',     glow: 'bg-sky-500/8' },
    rose:    { text: 'text-rose-400',     label: 'text-rose-400/80',    glow: 'bg-rose-500/8' },
    fuchsia: { text: 'text-fuchsia-400',  label: 'text-fuchsia-400/80', glow: 'bg-fuchsia-500/8' },
    indigo:  { text: 'text-indigo-400',   label: 'text-indigo-400/80',  glow: 'bg-indigo-500/8' },
    orange:  { text: 'text-orange-400',   label: 'text-orange-400/80',  glow: 'bg-orange-500/8' },
    pink:    { text: 'text-pink-400',     label: 'text-pink-400/80',    glow: 'bg-pink-500/8' },
  };
  const c = accentMap[accentColor] || accentMap.emerald;

  // Sort: items with data first, then by avgScore descending
  const sorted = items && items.length > 0
    ? [...items].sort((a, b) => {
        if (a.count > 0 && b.count === 0) return -1;
        if (a.count === 0 && b.count > 0) return 1;
        return (b.avgScore ?? 5) - (a.avgScore ?? 5);
      }).slice(0, maxItems)
    : [];
  const hasData = sorted.some(s => s.count > 0);

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col h-full">
      <div className={cn('absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none', c.glow)} />

      {/* Header */}
      <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 min-w-0">
        <div className={cn('w-2 h-2 rounded-full shrink-0', c.text.replace('text-', 'bg-'))} />
        <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
      </div>

      {/* Items list */}
      <div className="flex-1 px-3 py-2 flex flex-col justify-evenly overflow-hidden">
        {sorted.length > 0 ? sorted.map((item) => {
          const score = item.avgScore ?? 5.0;
          const hex = scoreToHex(score);
          const emoji = scoreToEmoji(score);
          const barPosition = (score / 10) * 100;

          return (
            <div key={item.label} className="flex items-center gap-2 group">
              {/* Label */}
              <span className="text-xs text-zinc-400 w-[76px] truncate shrink-0 text-right group-hover:text-white transition-colors duration-200">
                {item.label}
              </span>

              {/* Score bar — gradient from rose to emerald with marker */}
              <div className="flex-1 h-[10px] rounded-full overflow-hidden relative bg-white/[0.03]">
                <div className="absolute inset-0 rounded-full opacity-20" style={{
                  background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)',
                }} />
                {hasData && (
                  <div
                    className="absolute top-0 h-full w-[8px] rounded-full transition-all duration-[4s] ease-out"
                    style={{
                      left: `calc(${barPosition}% - 4px)`,
                      backgroundColor: hex,
                      boxShadow: `0 0 8px ${hex}80`,
                    }}
                  />
                )}
              </div>

              {/* Emoji + Score */}
              <div className="flex items-center gap-1 shrink-0 w-[52px]">
                <span className="text-sm leading-none">{hasData ? emoji : ''}</span>
                <span className="text-sm font-black tabular-nums" style={{ color: hasData ? hex : '#52525b' }}>
                  {hasData ? score.toFixed(1) : '—'}
                </span>
              </div>
            </div>
          );
        }) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-zinc-700">Aguardando...</p>
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.title === next.title &&
    prev.accentColor === next.accentColor &&
    shallowEqualSegments(prev.items, next.items);
});

/* ════════════════════════════════════════════════════════════════════
   SCORE BAR — Gradient bar showing global score position (rightSlot)
   ════════════════════════════════════════════════════════════════════ */

export const ScoreBar = memo(function ScoreBar({ avgScore, totalCount }: {
  avgScore: number; totalCount: number;
}) {
  const score = avgScore ?? 5.0;
  const hex = scoreToHex(score);
  const barPosition = (score / 10) * 100;

  const scaleItems = [
    { score: 1, emoji: '💣' },
    { score: 3, emoji: '😡' },
    { score: 5, emoji: '😐' },
    { score: 7, emoji: '👍' },
    { score: 9, emoji: '❤️' },
    { score: 10, emoji: '🔥' },
  ];

  return (
    <div className="flex-1 flex flex-col justify-center gap-2 min-w-0 px-2">
      {/* Score gradient bar */}
      <div className="relative h-[28px] rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.04]">
        <div className="absolute inset-0 rounded-xl opacity-30" style={{
          background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)',
        }} />
        {totalCount > 0 && (
          <div
            className="absolute top-1 bottom-1 w-[4px] rounded-full transition-all duration-[6s] ease-out"
            style={{
              left: `calc(${barPosition}% - 2px)`,
              backgroundColor: hex,
              boxShadow: `0 0 12px ${hex}aa`,
            }}
          />
        )}
      </div>

      {/* Emoji scale */}
      <div className="flex items-center justify-between px-1">
        {scaleItems.map(s => (
          <span key={s.score} className="text-xs leading-none">{s.emoji}</span>
        ))}
      </div>
    </div>
  );
});
