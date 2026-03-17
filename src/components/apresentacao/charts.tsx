'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/hooks/useAnimatedValue';
import { scoreToEmoji, scoreToLabel, scoreToHex } from '@/lib/arena/types';
import type { SegmentItem } from '@/lib/arena/segments';
import type { ReactNode } from 'react';

/* ════════════════════════════════════════════════════════════════════
   Animated Score — smoothly interpolates a 0-10 score with decimal,
   updating emoji and color in real time as the number climbs.
   ════════════════════════════════════════════════════════════════════ */

function useAnimatedScore(target: number, duration = 12000): number {
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0);
  const startValRef = useRef(0);
  const startTimeRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTargetRef = useRef(0);
  const initialized = useRef(false);
  const lastValidRef = useRef(0);

  useEffect(() => {
    // First render: always animate from 0
    if (!initialized.current) {
      initialized.current = true;
      if (target === 0) return;
    }

    // Track last valid (non-zero) value to prevent flicker
    if (target > 0) lastValidRef.current = target;

    if (prevTargetRef.current === target) return;
    prevTargetRef.current = target;

    startValRef.current = currentRef.current;
    startTimeRef.current = Date.now();

    const cleanup = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      frameRef.current = null;
      timerRef.current = null;
    };

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 5); // quintic ease-out
      const current = startValRef.current + (target - startValRef.current) * eased;
      const rounded = Math.round(current * 10) / 10;
      currentRef.current = rounded;
      setDisplay(rounded);

      if (progress < 1) {
        if (typeof requestAnimationFrame !== 'undefined' && !document.hidden) {
          frameRef.current = requestAnimationFrame(animate);
        } else {
          timerRef.current = setTimeout(animate, 32);
        }
      }
    };

    cleanup();
    animate();
    return cleanup;
  }, [target, duration]);

  // Never return 0 if we've had data before (prevents "—" flicker)
  if (display === 0 && lastValidRef.current > 0) return lastValidRef.current;
  return display;
}

/** Renders an animated score with emoji + color that updates as the number climbs.
 *  Once data has been received, NEVER shows "—" again (prevents flicker). */
export function AnimatedScore({ value, duration = 12000, className, showEmoji = true, showLabel = false }: {
  value: number;
  duration?: number;
  className?: string;
  showEmoji?: boolean;
  showLabel?: boolean;
}) {
  const animated = useAnimatedScore(value, duration);
  const hasEverHadData = useRef(false);
  if (animated > 0) hasEverHadData.current = true;

  const emoji = scoreToEmoji(animated);
  const hex = scoreToHex(animated);
  const label = scoreToLabel(animated);
  const showValue = animated > 0 || hasEverHadData.current;

  return (
    <span className={cn('inline-flex items-center gap-1 transition-opacity duration-500', className)}>
      {showEmoji && <span className="leading-none">{showValue ? emoji : ''}</span>}
      <span className="font-black tabular-nums" style={{ color: showValue ? hex : '#52525b' }}>
        {showValue ? animated.toFixed(1) : '—'}
      </span>
      {showLabel && showValue && (
        <span className="font-bold text-xs" style={{ color: `${hex}cc` }}>{label}</span>
      )}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Live Jitter v2 — Organic, independent oscillations per item.
   Each instance gets unique phase, frequency, and amplitude so bars
   move independently with natural, non-synchronized patterns.
   Uses sin() waves with random frequencies for smooth organic motion.
   ════════════════════════════════════════════════════════════════════ */

export function useLiveJitter(baseValue: number, isLive: boolean, progress: number): number {
  const [jittered, setJittered] = useState(baseValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-instance random parameters (stable across renders)
  const seedRef = useRef({
    phase: Math.random() * Math.PI * 2,       // unique start phase
    freq1: 0.0008 + Math.random() * 0.0012,   // primary wave: 0.0008-0.002 (slow)
    freq2: 0.002 + Math.random() * 0.003,     // secondary wave: 0.002-0.005 (faster)
    amp1: 0.2 + Math.random() * 0.3,          // primary amplitude: 0.2-0.5
    amp2: 0.08 + Math.random() * 0.15,        // secondary amplitude: 0.08-0.23
    interval: 1200 + Math.random() * 1800,    // update interval: 1200-3000ms
    drift: (Math.random() - 0.5) * 0.1,       // slight persistent drift
  });

  useEffect(() => {
    if (!isLive || baseValue === 0 || progress >= 100) {
      setJittered(baseValue);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const s = seedRef.current;
    // Amplitude decreases as progress increases (converging to final value)
    const progressFactor = Math.max(0.15, 1 - progress / 100);

    const tick = () => {
      const t = Date.now();
      // Two overlapping sin waves with unique frequencies = organic motion
      const wave1 = Math.sin(t * s.freq1 + s.phase) * s.amp1;
      const wave2 = Math.sin(t * s.freq2 + s.phase * 1.7) * s.amp2;
      const noise = (wave1 + wave2 + s.drift) * progressFactor;
      setJittered(Math.max(0, Math.min(10, baseValue + noise)));

      // Next tick with jittered interval (±30% of base interval)
      const nextInterval = s.interval * (0.7 + Math.random() * 0.6);
      timerRef.current = setTimeout(tick, nextInterval);
    };

    // Start with unique delay so instances don't sync on mount
    const startDelay = Math.random() * 1500;
    timerRef.current = setTimeout(tick, startDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [baseValue, isLive, progress]);

  return jittered;
}

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
          return (
            <div className="text-center">
              <AnimatedScore value={hasData ? dScore : 0} className="text-3xl justify-center" duration={12000} />
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
                  className="absolute flex items-center justify-center"
                  style={{
                    left: `${leftPos}%`,
                    transform: 'translateX(-50%)',
                    width: `${size}px`,
                    height: `${size}px`,
                    transition: 'all 8s cubic-bezier(0.16, 1, 0.3, 1)',
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
                <AnimatedScore value={hasData ? bScore : 0} className="text-[10px]" duration={10000} />
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
                <AnimatedScore value={hasQData ? score : 0} className="text-sm" duration={10000} />
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
  isLive = false,
  progress = 0,
}: {
  avgScore: number;
  totalCount: number;
  processedCount: number;
  rightSlot?: ReactNode;
  isLive?: boolean;
  progress?: number;
}) {
  const score = avgScore ?? 0;
  const jitteredScore = useLiveJitter(score, isLive && processedCount > 0, progress);
  const displayScore = isLive && processedCount > 0 ? jitteredScore : score;
  const hex = scoreToHex(displayScore);

  return (
    <div className="shrink-0 flex items-stretch gap-3 px-5 py-4 border-b border-white/[0.04]">
      {/* Main score */}
      <div className="relative overflow-hidden shrink-0 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] px-8 py-3 flex flex-col items-center justify-center" style={{ borderColor: `${hex}33` }}>
        {/* Glow — pulses when live */}
        <div
          className="absolute inset-0 bg-gradient-to-br pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${hex}20, transparent 70%)`,
            opacity: isLive ? undefined : 0.3,
            animation: isLive ? 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
          }}
        />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 relative">Nota</p>
        <div className="relative">
          <AnimatedScore value={processedCount > 0 ? displayScore : 0} className="text-5xl" showEmoji={true} showLabel={true} duration={isLive ? 2000 : 14000} />
        </div>
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

/** Individual segment row with live jitter support */
function SegmentItemRow({ item, hasData, isLive, progress }: {
  item: SegmentItem;
  hasData: boolean;
  isLive: boolean;
  progress: number;
}) {
  const baseScore = item.avgScore ?? 5.0;
  const jitteredScore = useLiveJitter(baseScore, isLive && hasData, progress);
  const displayScore = isLive && hasData ? jitteredScore : baseScore;
  const hex = scoreToHex(displayScore);
  const barPosition = (displayScore / 10) * 100;

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-xs text-zinc-400 w-[76px] truncate shrink-0 text-right group-hover:text-white transition-colors duration-200">
        {item.label}
      </span>
      <div className="flex-1 h-[10px] rounded-full overflow-hidden relative bg-white/[0.03]">
        <div className="absolute inset-0 rounded-full opacity-20" style={{
          background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)',
        }} />
        {hasData && (
          <div
            className="absolute top-0 h-full w-[8px] rounded-full"
            style={{
              left: `calc(${barPosition}% - 4px)`,
              backgroundColor: hex,
              boxShadow: `0 0 8px ${hex}80`,
              transition: isLive ? 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'all 8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        )}
      </div>
      <div className="shrink-0 w-[56px]">
        <AnimatedScore value={hasData ? displayScore : 0} className="text-sm" duration={isLive ? 2000 : 10000} />
      </div>
    </div>
  );
}

export const ScoreSegmentCard = memo(function ScoreSegmentCard({
  items,
  title,
  accentColor,
  maxItems = 7,
  isLive = false,
  progress = 0,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
  maxItems?: number;
  isLive?: boolean;
  progress?: number;
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

  // Filter out items with count=0 (prevents "—" tracinho), then sort by avgScore
  const sorted = items && items.length > 0
    ? [...items]
        .filter(i => i.count > 0)
        .sort((a, b) => (b.avgScore ?? 5) - (a.avgScore ?? 5))
        .slice(0, maxItems)
    : [];
  const hasData = sorted.length > 0;

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
        {sorted.length > 0 ? sorted.map((item) => (
          <SegmentItemRow
            key={item.label}
            item={item}
            hasData={hasData}
            isLive={isLive}
            progress={progress}
          />
        )) : (
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
    prev.isLive === next.isLive &&
    prev.progress === next.progress &&
    shallowEqualSegments(prev.items, next.items);
});

/* ════════════════════════════════════════════════════════════════════
   SCORE BAR — Gradient bar showing global score position (rightSlot)
   ════════════════════════════════════════════════════════════════════ */

export const ScoreBar = memo(function ScoreBar({ avgScore, totalCount, isLive = false, progress = 0 }: {
  avgScore: number; totalCount: number; isLive?: boolean; progress?: number;
}) {
  const score = avgScore ?? 5.0;
  const jitteredScore = useLiveJitter(score, isLive && totalCount > 0, progress);
  const displayScore = isLive && totalCount > 0 ? jitteredScore : score;
  const hex = scoreToHex(displayScore);
  const barPosition = (displayScore / 10) * 100;

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
            className="absolute top-1 bottom-1 w-[4px] rounded-full"
            style={{
              left: `calc(${barPosition}% - 2px)`,
              backgroundColor: hex,
              boxShadow: `0 0 12px ${hex}aa`,
              transition: isLive ? 'all 1.5s cubic-bezier(0.16, 1, 0.3, 1)' : 'all 10s cubic-bezier(0.16, 1, 0.3, 1)',
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
