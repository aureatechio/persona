'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useAnimatedValue, AnimatedNumber } from '@/hooks/useAnimatedValue';
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
   UNIFIED STAT CARD — single component for both dominant and normal
   Transitions smoothly between states via CSS instead of unmount/mount
   ════════════════════════════════════════════════════════════════════ */

const COLOR_MAP = {
  emerald: { text: 'text-emerald-400', sub: 'text-emerald-500/60' },
  amber:   { text: 'text-amber-400',   sub: 'text-amber-500/60' },
  rose:    { text: 'text-rose-400',     sub: 'text-rose-500/60' },
} as const;

function UnifiedStatCard({ value, label, count, color, glow, border, isDominant }: {
  value: number;
  label: string;
  count: number;
  color: 'emerald' | 'amber' | 'rose';
  glow: string;
  border: string;
  isDominant: boolean;
}) {
  const animatedValue = useAnimatedValue(value);
  const animatedCount = useAnimatedValue(count, 20000);
  const c = COLOR_MAP[color];

  return (
    <div className={cn(
      'relative overflow-hidden shrink-0',
      'bg-white/[0.03] backdrop-blur-xl rounded-2xl',
      'flex flex-col items-center justify-center',
      'transition-all duration-500 ease-out',
      isDominant
        ? cn('w-[220px] border px-5 py-3', border)
        : 'w-[110px] border border-white/[0.06] px-4 py-2',
    )}>
      {/* Glow — fades in/out */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br pointer-events-none transition-opacity duration-500',
        isDominant ? 'opacity-40' : 'opacity-0',
        glow,
      )} />

      {/* "Tendencia" label — fades in/out */}
      <p className={cn(
        'font-black uppercase tracking-[0.2em] text-zinc-500 relative transition-all duration-500 overflow-hidden',
        isDominant ? 'text-[10px] max-h-6 opacity-100 mb-0' : 'text-[10px] max-h-0 opacity-0',
      )}>
        Tendencia
      </p>

      {/* Animated percentage */}
      <p className={cn(
        'font-black tabular-nums leading-none relative transition-all duration-500',
        isDominant ? 'text-5xl' : 'text-3xl',
        c.text,
      )}>
        {animatedValue}%
      </p>

      <p className={cn(
        'font-bold relative transition-all duration-500',
        isDominant ? 'text-sm mt-1' : 'text-xs uppercase tracking-wider mt-1',
        c.sub,
      )}>
        {label}
      </p>

      <p className="text-xs text-zinc-600 tabular-nums relative">
        {animatedCount.toLocaleString('pt-BR')}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   TREND HERO — Giant trend number + stat cards + flexible right slot
   Shared between Dashboard and Político screens
   ════════════════════════════════════════════════════════════════════ */

export const TrendHero = memo(function TrendHero({
  positive,
  negative,
  neutral,
  rightSlot,
}: {
  positive: number;
  negative: number;
  neutral: number;
  rightSlot?: ReactNode;
}) {
  const total = positive + negative + neutral;
  const pctPos = total > 0 ? Math.round((positive / total) * 100) : 0;
  const pctNeg = total > 0 ? Math.round((negative / total) * 100) : 0;
  const pctNeu = total > 0 ? Math.round((neutral / total) * 100) : 0;

  const stats = [
    { key: 'pos', value: pctPos, label: 'Concordam', count: positive, color: 'emerald' as const, glow: 'from-emerald-500/20 to-emerald-500/0', border: 'border-emerald-500/20' },
    { key: 'neu', value: pctNeu, label: 'Neutros',   count: neutral,  color: 'amber' as const,   glow: 'from-amber-500/20 to-amber-500/0',   border: 'border-amber-500/20' },
    { key: 'neg', value: pctNeg, label: 'Discordam',  count: negative, color: 'rose' as const,    glow: 'from-rose-500/20 to-rose-500/0',     border: 'border-rose-500/20' },
  ];
  const dominantIdx = stats.reduce((maxI, s, i) => s.value > stats[maxI].value ? i : maxI, 0);

  return (
    <div className="shrink-0 flex items-stretch gap-3 px-5 py-4 border-b border-white/[0.04]">
      {/* ── 3 Stat Cards — same component type, isDominant toggles visual state ── */}
      <div className="flex items-stretch gap-3 shrink-0">
        {stats.map((s, i) => (
          <UnifiedStatCard
            key={s.key}
            value={s.value}
            label={s.label}
            count={s.count}
            color={s.color}
            glow={s.glow}
            border={s.border}
            isDominant={i === dominantIdx}
          />
        ))}
      </div>

      {/* ── Right Slot (sentiment bar or figure gauges) ── */}
      {rightSlot && (
        <div className="flex-1 min-w-0 flex items-stretch">
          {rightSlot}
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════════════
   SENTIMENT BAR — Stacked bar with legend (used in TrendHero rightSlot)
   ════════════════════════════════════════════════════════════════════ */

export const SentimentBar = memo(function SentimentBar({ positive, negative, neutral }: {
  positive: number; negative: number; neutral: number;
}) {
  const total = positive + negative + neutral;
  const pctPos = total > 0 ? Math.round((positive / total) * 100) : 0;
  const pctNeu = total > 0 ? Math.round((neutral / total) * 100) : 0;
  const pctNeg = total > 0 ? (100 - pctPos - pctNeu) : 0;

  const animPos = useAnimatedValue(pctPos);
  const animNeu = useAnimatedValue(pctNeu);
  const animNeg = useAnimatedValue(pctNeg);

  return (
    <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
      <div className="h-[36px] rounded-xl overflow-hidden flex bg-white/[0.03] border border-white/[0.04]">
        <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-[6s] flex items-center justify-center" style={{ width: `${pctPos}%` }}>
          {pctPos > 6 && <span className="text-sm font-black text-black/80">{animPos}%</span>}
        </div>
        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-[6s] flex items-center justify-center" style={{ width: `${Math.max(pctNeu, 3)}%` }}>
          <span className="text-sm font-black text-black/80">{animNeu}%</span>
        </div>
        <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-[6s] flex-1 flex items-center justify-center">
          {pctNeg > 6 && <span className="text-sm font-black text-black/80">{animNeg}%</span>}
        </div>
      </div>
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Concordam</span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Neutros</span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Discordam</span>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════════════
   DONUT CARD v2 — Larger donut + dual-metric legend
   ════════════════════════════════════════════════════════════════════ */

const DONUT_COLORS = [
  { bg: 'bg-emerald-400', hex: '#34d399', text: 'text-emerald-400' },
  { bg: 'bg-sky-400',     hex: '#38bdf8', text: 'text-sky-400' },
  { bg: 'bg-violet-400',  hex: '#a78bfa', text: 'text-violet-400' },
  { bg: 'bg-amber-400',   hex: '#fbbf24', text: 'text-amber-400' },
  { bg: 'bg-rose-400',    hex: '#fb7185', text: 'text-rose-400' },
  { bg: 'bg-cyan-400',    hex: '#22d3ee', text: 'text-cyan-400' },
  { bg: 'bg-orange-400',  hex: '#fb923c', text: 'text-orange-400' },
  { bg: 'bg-fuchsia-400', hex: '#e879f9', text: 'text-fuchsia-400' },
];

export const DonutCard = memo(function DonutCard({
  items,
  title,
  accentColor,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
}) {
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

  const sorted = items && items.length > 0 ? [...items].sort((a, b) => b.count - a.count) : [];
  const totalCount = sorted.reduce((s, i) => s + i.count, 0);
  const hasData = totalCount > 0;

  // Build conic-gradient stops
  let accumulated = 0;
  const stops: string[] = [];
  if (hasData) {
    sorted.forEach((item, idx) => {
      const pct = (item.count / totalCount) * 100;
      const color = DONUT_COLORS[idx % DONUT_COLORS.length].hex;
      stops.push(`${color} ${accumulated}% ${accumulated + pct}%`);
      accumulated += pct;
    });
  }

  const topItem = hasData ? sorted[0] : null;
  const topPct = topItem ? Math.round((topItem.count / totalCount) * 100) : 0;

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 min-w-0">
        <div className={cn('w-2 h-2 rounded-full shrink-0', c.text.replace('text-', 'bg-'))} />
        <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
      </div>

      {/* Body: donut left + card grid right — fills entire space */}
      <div className="flex-1 flex items-stretch gap-3 px-3 py-3 min-h-0">
        {/* Donut — vertically centered, proportional */}
        <div className="shrink-0 flex items-center justify-center w-[35%] overflow-hidden">
          <div className="relative w-full aspect-square max-w-[140px] max-h-full">
            <div
              className="w-full h-full rounded-full transition-all duration-[4s]"
              style={{ background: hasData ? `conic-gradient(${stops.join(', ')})` : 'rgba(255,255,255,0.04)' }}
            />
            <div className="absolute inset-[22%] rounded-full bg-[#0a0a0b] flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white tabular-nums leading-none transition-all duration-700"><AnimatedNumber value={topPct} suffix="%" /></span>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 text-center px-1 truncate max-w-full">
                {topItem?.label || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Mini-card grid — always show structure, numbers grow from 0 */}
        {sorted.length > 0 ? (
          <div className={cn(
            'flex-1 grid gap-1 min-w-0 auto-rows-fr grid-cols-2',
          )}>
            {sorted.slice(0, 6).map((item, idx) => {
              const sharePct = hasData ? Math.round((item.count / totalCount) * 100) : 0;
              const tot = item.positive + item.negative + item.neutral;
              const favPct = tot > 0 ? Math.round((item.positive / tot) * 100) : 0;
              const neuPct = tot > 0 ? Math.round((item.neutral / tot) * 100) : 0;
              const conPct = tot > 0 ? (100 - favPct - neuPct) : 0;
              const dominant = Math.max(favPct, neuPct, conPct);
              const dominantColor = hasData
                ? (dominant === favPct ? 'text-emerald-400' : dominant === conPct ? 'text-rose-400' : 'text-amber-400')
                : 'text-zinc-600';
              const dominantLabel = hasData
                ? (dominant === favPct ? 'Favor' : dominant === conPct ? 'Contra' : 'Neutro')
                : '—';
              const dotColor = DONUT_COLORS[idx % DONUT_COLORS.length];

              return (
                <div key={item.label} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 flex flex-col items-center justify-center gap-0.5 overflow-hidden transition-colors duration-200 hover:bg-white/[0.06]">
                  <div className="flex items-center gap-1 w-full min-w-0">
                    <div className={cn('w-1.5 h-1.5 rounded-sm shrink-0', dotColor.bg)} />
                    <span className="text-[10px] text-zinc-400 truncate leading-tight font-medium">{item.label}</span>
                  </div>
                  <div className="w-full h-[4px] rounded-full overflow-hidden flex mt-0.5">
                    <div className="h-full bg-emerald-400 transition-all duration-[6s]" style={{ width: `${favPct}%` }} />
                    <div className="h-full bg-amber-400 transition-all duration-[6s]" style={{ width: `${neuPct}%` }} />
                    <div className="h-full bg-rose-400 transition-all duration-[6s]" style={{ width: `${conPct}%` }} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold tabular-nums text-emerald-400"><AnimatedNumber value={favPct} suffix="%" /></span>
                    <span className="text-[9px] font-bold tabular-nums text-amber-400"><AnimatedNumber value={neuPct} suffix="%" /></span>
                    <span className="text-[9px] font-bold tabular-nums text-rose-400"><AnimatedNumber value={conPct} suffix="%" /></span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
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
   HBAR CHART v2 — Bars show distribution, badge shows sentiment
   ════════════════════════════════════════════════════════════════════ */

export const HBarChart = memo(function HBarChart({
  items,
  title,
  accentColor,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
}) {
  const sorted = items && items.length > 0 ? [...items].sort((a, b) => b.count - a.count).slice(0, 7) : [];
  const maxCount = sorted[0]?.count || 1;
  const hasData = sorted.length > 0;

  const accentMap: Record<string, { glow: string; text: string; label: string; bar: string }> = {
    emerald: { glow: 'bg-emerald-500/8', text: 'text-emerald-400', label: 'text-emerald-400/80', bar: 'from-emerald-600 to-emerald-400' },
    amber:   { glow: 'bg-amber-500/8',   text: 'text-amber-400',   label: 'text-amber-400/80',   bar: 'from-amber-600 to-amber-400' },
    violet:  { glow: 'bg-violet-500/8',   text: 'text-violet-400',  label: 'text-violet-400/80',  bar: 'from-violet-600 to-violet-400' },
    cyan:    { glow: 'bg-cyan-500/8',     text: 'text-cyan-400',    label: 'text-cyan-400/80',    bar: 'from-cyan-600 to-cyan-400' },
    sky:     { glow: 'bg-sky-500/8',      text: 'text-sky-400',     label: 'text-sky-400/80',     bar: 'from-sky-600 to-sky-400' },
    rose:    { glow: 'bg-rose-500/8',     text: 'text-rose-400',    label: 'text-rose-400/80',    bar: 'from-rose-600 to-rose-400' },
    fuchsia: { glow: 'bg-fuchsia-500/8',  text: 'text-fuchsia-400', label: 'text-fuchsia-400/80', bar: 'from-fuchsia-600 to-fuchsia-400' },
    indigo:  { glow: 'bg-indigo-500/8',   text: 'text-indigo-400',  label: 'text-indigo-400/80',  bar: 'from-indigo-600 to-indigo-400' },
    orange:  { glow: 'bg-orange-500/8',   text: 'text-orange-400',  label: 'text-orange-400/80',  bar: 'from-orange-600 to-orange-400' },
    pink:    { glow: 'bg-pink-500/8',     text: 'text-pink-400',    label: 'text-pink-400/80',    bar: 'from-pink-600 to-pink-400' },
  };
  const c = accentMap[accentColor] || accentMap.emerald;

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col h-full">
      <div className={cn('absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none', c.glow)} />

      <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 min-w-0">
        <div className={cn('w-2 h-2 rounded-full shrink-0', c.text.replace('text-', 'bg-'))} />
        <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
      </div>

      <div className="flex-1 px-4 py-2 flex flex-col justify-evenly overflow-hidden">
        {sorted.length > 0 ? sorted.map((item) => {
          const tot = item.positive + item.negative + item.neutral;
          const favPct = tot > 0 ? Math.round((item.positive / tot) * 100) : 0;
          const neuPct = tot > 0 ? Math.round((item.neutral / tot) * 100) : 0;
          const conPct = tot > 0 ? (100 - favPct - neuPct) : 0;
          const dominant = Math.max(favPct, neuPct, conPct);
          const dominantColor = hasData
            ? (dominant === favPct ? 'text-emerald-400' : dominant === conPct ? 'text-rose-400' : 'text-amber-400')
            : 'text-zinc-600';

          return (
            <div key={item.label} className="flex items-center gap-2 group">
              <span className="text-xs text-zinc-400 w-[76px] truncate shrink-0 text-right group-hover:text-white transition-colors duration-200">
                {item.label}
              </span>
              <div className="flex-1 h-[14px] rounded-full overflow-hidden flex bg-white/[0.03]">
                <div className="h-full bg-emerald-400 transition-all duration-[6s]" style={{ width: `${favPct}%` }} />
                <div className="h-full bg-amber-400 transition-all duration-[6s]" style={{ width: `${neuPct}%` }} />
                <div className="h-full bg-rose-400 transition-all duration-[6s]" style={{ width: `${conPct}%` }} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-bold tabular-nums text-emerald-400"><AnimatedNumber value={favPct} suffix="%" /></span>
                <span className="text-[10px] font-bold tabular-nums text-amber-400"><AnimatedNumber value={neuPct} suffix="%" /></span>
                <span className="text-[10px] font-bold tabular-nums text-rose-400"><AnimatedNumber value={conPct} suffix="%" /></span>
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
        {/* Dominant value — sentiment of the largest bucket */}
        {(() => {
          const dTot = dominant.positive + dominant.negative + dominant.neutral;
          const dFav = dTot > 0 ? Math.round((dominant.positive / dTot) * 100) : 0;
          const dNeu = dTot > 0 ? Math.round((dominant.neutral / dTot) * 100) : 0;
          const dCon = dTot > 0 ? (100 - dFav - dNeu) : 0;
          const dDom = Math.max(dFav, dNeu, dCon);
          const dColor = hasData ? (dDom === dFav ? 'text-emerald-400' : dDom === dCon ? 'text-rose-400' : 'text-amber-400') : 'text-zinc-600';
          const dLabel = dDom === dFav ? 'Favor' : dDom === dCon ? 'Contra' : 'Neutro';
          return (
            <div className="text-center">
              <p className={cn('text-3xl font-black tabular-nums leading-none transition-colors duration-500', dColor)}>
                {hasData ? <><AnimatedNumber value={dDom} suffix="%" /> {dLabel}</> : '0%'}
              </p>
              <p className="text-sm font-bold text-zinc-400 mt-1">{dominant.label} <span className="text-zinc-600">({dominant.pct}%)</span></p>
              {hasData && (
                <div className="flex items-center justify-center gap-3 mt-1">
                  <span className="text-[10px] font-bold text-emerald-400/70 tabular-nums"><AnimatedNumber value={dFav} suffix="%" /> Fav</span>
                  <span className="text-[10px] font-bold text-amber-400/70 tabular-nums"><AnimatedNumber value={dNeu} suffix="%" /> Neu</span>
                  <span className="text-[10px] font-bold text-rose-400/70 tabular-nums"><AnimatedNumber value={dCon} suffix="%" /> Con</span>
                </div>
              )}
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

        {/* Sentiment per bucket — tricolor mini-bar */}
        <div className="flex items-center gap-1">
          {buckets.map((b) => {
            const bTot = b.positive + b.negative + b.neutral;
            const bFav = bTot > 0 ? Math.round((b.positive / bTot) * 100) : 0;
            const bNeu = bTot > 0 ? Math.round((b.neutral / bTot) * 100) : 0;
            const bCon = bTot > 0 ? (100 - bFav - bNeu) : 0;
            const bDom = Math.max(bFav, bNeu, bCon);
            const bColor = hasData ? (bDom === bFav ? 'text-emerald-400' : bDom === bCon ? 'text-rose-400' : 'text-amber-400') : 'text-zinc-600';
            return (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                <div className="w-full h-[4px] rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-400 transition-all duration-[6s]" style={{ width: `${bFav}%` }} />
                  <div className="h-full bg-amber-400 transition-all duration-[6s]" style={{ width: `${bNeu}%` }} />
                  <div className="h-full bg-rose-400 transition-all duration-[6s]" style={{ width: `${bCon}%` }} />
                </div>
                <div className="flex items-center gap-0.5">
                  <span className="text-[9px] font-black tabular-nums text-emerald-400"><AnimatedNumber value={bFav} suffix="%" /></span>
                  <span className="text-[9px] font-black tabular-nums text-amber-400"><AnimatedNumber value={bNeu} suffix="%" /></span>
                  <span className="text-[9px] font-black tabular-nums text-rose-400"><AnimatedNumber value={bCon} suffix="%" /></span>
                </div>
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

  // Sort by avgScore descending (highest impact first), then by count
  const sorted = items && items.length > 0
    ? [...items].sort((a, b) => (b.avgScore ?? 5) - (a.avgScore ?? 5)).slice(0, maxItems)
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
