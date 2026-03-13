'use client';

import { cn } from '@/lib/utils';
import type { SegmentItem } from '@/lib/arena/segments';
import type { ReactNode } from 'react';

/* ════════════════════════════════════════════════════════════════════
   TREND HERO — Giant trend number + stat cards + flexible right slot
   Shared between Dashboard and Político screens
   ════════════════════════════════════════════════════════════════════ */

export function TrendHero({
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

  // Build the 3 stat items, marking which is dominant (= Tendência)
  const stats: { key: string; value: number; label: string; count: number; color: 'emerald' | 'amber' | 'rose'; glow: string; border: string }[] = [
    { key: 'pos', value: pctPos, label: 'Concordam', count: positive, color: 'emerald', glow: 'from-emerald-500/20 to-emerald-500/0', border: 'border-emerald-500/20' },
    { key: 'neu', value: pctNeu, label: 'Neutros',   count: neutral,  color: 'amber',   glow: 'from-amber-500/20 to-amber-500/0',   border: 'border-amber-500/20' },
    { key: 'neg', value: pctNeg, label: 'Discordam',  count: negative, color: 'rose',    glow: 'from-rose-500/20 to-rose-500/0',     border: 'border-rose-500/20' },
  ];
  const dominantIdx = stats.reduce((maxI, s, i) => s.value > stats[maxI].value ? i : maxI, 0);

  return (
    <div className="shrink-0 flex items-stretch gap-3 px-5 py-4 border-b border-white/[0.04]">
      {/* ── 3 Stat Cards — dominant is large with "Tendência" ── */}
      <div className="flex items-stretch gap-3 shrink-0">
        {stats.map((s, i) => (
          i === dominantIdx
            ? <DominantStatCard key={s.key} value={s.value} label={s.label} count={s.count} color={s.color} glow={s.glow} border={s.border} />
            : <StatCard key={s.key} value={s.value} label={s.label} count={s.count} color={s.color} />
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
}

function DominantStatCard({ value, label, count, color, glow, border }: {
  value: number; label: string; count: number; color: 'emerald' | 'amber' | 'rose'; glow: string; border: string;
}) {
  const colorMap = {
    emerald: { text: 'text-emerald-400', sub: 'text-emerald-500/60' },
    amber:   { text: 'text-amber-400',   sub: 'text-amber-500/60' },
    rose:    { text: 'text-rose-400',     sub: 'text-rose-500/60' },
  };
  const c = colorMap[color];

  return (
    <div className={cn(
      'relative overflow-hidden w-[220px] shrink-0',
      'bg-white/[0.03] backdrop-blur-xl rounded-2xl',
      'border', border,
      'flex flex-col items-center justify-center px-5 py-3',
    )}>
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-40 pointer-events-none', glow)} />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 relative">Tendencia</p>
      <p className={cn('text-5xl font-black tabular-nums leading-none relative', c.text)}>
        {value}%
      </p>
      <p className={cn('text-sm font-bold relative mt-1', c.sub)}>{label}</p>
      <p className="text-xs text-zinc-600 tabular-nums relative">{count.toLocaleString('pt-BR')}</p>
    </div>
  );
}

function StatCard({ value, label, count, color }: {
  value: number; label: string; count: number; color: 'emerald' | 'amber' | 'rose';
}) {
  const colorMap = {
    emerald: { text: 'text-emerald-400', sub: 'text-emerald-500/60' },
    amber:   { text: 'text-amber-400',   sub: 'text-amber-500/60' },
    rose:    { text: 'text-rose-400',     sub: 'text-rose-500/60' },
  };
  const c = colorMap[color];

  return (
    <div className="relative overflow-hidden bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2 flex flex-col items-center justify-center min-w-[110px]">
      <p className={cn('text-3xl font-black tabular-nums leading-none', c.text)}>{value}%</p>
      <p className={cn('text-xs font-bold uppercase tracking-wider mt-1', c.sub)}>{label}</p>
      <p className="text-xs text-zinc-600 tabular-nums">{count.toLocaleString('pt-BR')}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SENTIMENT BAR — Stacked bar with legend (used in TrendHero rightSlot)
   ════════════════════════════════════════════════════════════════════ */

export function SentimentBar({ positive, negative, neutral }: {
  positive: number; negative: number; neutral: number;
}) {
  const total = positive + negative + neutral;
  const pctPos = total > 0 ? Math.round((positive / total) * 100) : 0;
  const pctNeu = total > 0 ? Math.round((neutral / total) * 100) : 0;
  const pctNeg = total > 0 ? (100 - pctPos - pctNeu) : 0;

  return (
    <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
      <div className="h-[36px] rounded-xl overflow-hidden flex bg-white/[0.03] border border-white/[0.04]">
        <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-[2s] flex items-center justify-center" style={{ width: `${pctPos}%` }}>
          {pctPos > 6 && <span className="text-sm font-black text-black/80">{pctPos}%</span>}
        </div>
        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-[2s] flex items-center justify-center" style={{ width: `${Math.max(pctNeu, 3)}%` }}>
          <span className="text-sm font-black text-black/80">{pctNeu}%</span>
        </div>
        <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-[2s] flex-1 flex items-center justify-center">
          {pctNeg > 6 && <span className="text-sm font-black text-black/80">{pctNeg}%</span>}
        </div>
      </div>
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Concordam</span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Neutros</span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Discordam</span>
      </div>
    </div>
  );
}

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

export function DonutCard({
  items,
  title,
  accentColor,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
}) {
  if (!items || items.length === 0) return null;
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const totalCount = sorted.reduce((s, i) => s + i.count, 0);
  if (totalCount === 0) return null;

  // Build conic-gradient stops
  let accumulated = 0;
  const stops: string[] = [];
  sorted.forEach((item, idx) => {
    const pct = (item.count / totalCount) * 100;
    const color = DONUT_COLORS[idx % DONUT_COLORS.length].hex;
    stops.push(`${color} ${accumulated}% ${accumulated + pct}%`);
    accumulated += pct;
  });

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

  const topItem = sorted[0];
  const topPct = Math.round((topItem.count / totalCount) * 100);

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
              className="w-full h-full rounded-full transition-all duration-1000"
              style={{ background: `conic-gradient(${stops.join(', ')})` }}
            />
            <div className="absolute inset-[22%] rounded-full bg-[#0a0a0b] flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white tabular-nums leading-none">{topPct}%</span>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 text-center px-1 truncate max-w-full">
                {topItem.label}
              </span>
            </div>
          </div>
        </div>

        {/* Mini-card grid — fills remaining space */}
        <div className={cn(
          'flex-1 grid gap-1 min-w-0 auto-rows-fr',
          sorted.length <= 4 ? 'grid-cols-2' : 'grid-cols-2',
        )}>
          {sorted.slice(0, 6).map((item, idx) => {
            const sharePct = Math.round((item.count / totalCount) * 100);
            const tot = item.positive + item.negative + item.neutral;
            const favPct = tot > 0 ? Math.round((item.positive / tot) * 100) : 0;
            const conPct = tot > 0 ? Math.round((item.negative / tot) * 100) : 0;
            const isFavor = favPct >= conPct;
            const sentPct = isFavor ? favPct : conPct;
            const sentColor = isFavor ? 'text-emerald-400' : 'text-rose-400';
            const dotColor = DONUT_COLORS[idx % DONUT_COLORS.length];

            return (
              <div key={item.label} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 flex flex-col items-center justify-center gap-0.5 overflow-hidden transition-colors duration-200 hover:bg-white/[0.06]">
                <div className="flex items-center gap-1 w-full min-w-0">
                  <div className={cn('w-1.5 h-1.5 rounded-sm shrink-0', dotColor.bg)} />
                  <span className="text-[10px] text-zinc-400 truncate leading-tight font-medium">{item.label}</span>
                </div>
                <span className={cn('text-base font-black tabular-nums leading-none', sentColor)}>{sentPct}%</span>
                <span className={cn('text-[10px] font-bold leading-none', sentColor)}>
                  {isFavor ? 'Favor' : 'Contra'}
                </span>
                <span className="text-[9px] text-zinc-600 tabular-nums leading-none truncate">{sharePct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   HBAR CHART v2 — Bars show distribution, badge shows sentiment
   ════════════════════════════════════════════════════════════════════ */

export function HBarChart({
  items,
  title,
  accentColor,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
}) {
  if (!items || items.length === 0) return null;
  const sorted = [...items].sort((a, b) => b.count - a.count).slice(0, 7);
  const maxCount = sorted[0]?.count || 1;

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
        {sorted.map((item) => {
          const tot = item.positive + item.negative + item.neutral;
          const favPct = tot > 0 ? Math.round((item.positive / tot) * 100) : 0;
          const conPct = tot > 0 ? Math.round((item.negative / tot) * 100) : 0;
          const barWidth = Math.round((item.count / maxCount) * 100);
          const isFavor = favPct >= conPct;
          const sentPct = isFavor ? favPct : conPct;
          const sentLabel = isFavor ? 'Favor' : 'Contra';
          const sentColor = isFavor ? 'text-emerald-400' : 'text-rose-400';

          return (
            <div key={item.label} className="flex items-center gap-2 group">
              <span className="text-xs text-zinc-400 w-[76px] truncate shrink-0 text-right group-hover:text-white transition-colors duration-200">
                {item.label}
              </span>
              <div className="flex-1 h-[18px] rounded-lg overflow-hidden bg-white/[0.03] relative">
                <div
                  className={cn('h-full rounded-lg bg-gradient-to-r transition-all duration-[1.5s]', c.bar)}
                  style={{ width: `${barWidth}%`, opacity: 0.8 }}
                />
              </div>
              <span className={cn('text-xs font-bold tabular-nums shrink-0 w-[72px] text-right', sentColor)}>
                {sentPct}% {sentLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
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
  if (!items || items.length === 0) return null;

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

  const totalCount = items.reduce((s, i) => s + i.count, 0);
  if (totalCount === 0) return null;

  const positionMap: Record<string, number> = {
    'Esquerda Forte': 0, 'Progressista Forte': 0,
    'Centro-Esquerda': 1, 'Progressista': 1,
    'Centro': 2,
    'Centro-Direita': 3, 'Conservador': 3,
    'Direita Forte': 4, 'Conservador Forte': 4,
  };

  const buckets = items.map(item => ({
    ...item,
    pos: positionMap[item.label] ?? 2,
    pct: Math.round((item.count / totalCount) * 100),
  })).sort((a, b) => a.pos - b.pos);

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
          const dCon = dTot > 0 ? Math.round((dominant.negative / dTot) * 100) : 0;
          const dIsFavor = dFav >= dCon;
          return (
            <div className="text-center">
              <p className={cn('text-3xl font-black tabular-nums leading-none', dIsFavor ? 'text-emerald-400' : 'text-rose-400')}>
                {dIsFavor ? dFav : dCon}% {dIsFavor ? 'Favor' : 'Contra'}
              </p>
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
              const size = Math.max(18, Math.min(34, (b.pct / 40) * 34));
              return (
                <div
                  key={b.label}
                  className="absolute flex items-center justify-center transition-all duration-1000"
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

        {/* Sentiment per bucket */}
        <div className="flex items-center gap-0.5">
          {buckets.map((b) => {
            const bTot = b.positive + b.negative + b.neutral;
            const bFav = bTot > 0 ? Math.round((b.positive / bTot) * 100) : 0;
            const bCon = bTot > 0 ? Math.round((b.negative / bTot) * 100) : 0;
            const bIsFavor = bFav >= bCon;
            const bSent = bIsFavor ? bFav : bCon;
            return (
              <div key={b.label} className="flex-1 text-center min-w-0">
                <p className={cn('text-sm font-black tabular-nums leading-none', bIsFavor ? 'text-emerald-400' : 'text-rose-400')}>
                  {bSent}%
                </p>
                <p className={cn('text-[9px] font-bold leading-tight mt-0.5', bIsFavor ? 'text-emerald-400/60' : 'text-rose-400/60')}>
                  {bIsFavor ? 'Fav' : 'Con'}
                </p>
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

export function QuadrantGrid({
  items,
  title,
  accentColor,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
}) {
  if (!items || items.length === 0) return null;

  const totalCount = items.reduce((s, i) => s + i.count, 0);
  if (totalCount === 0) return null;

  const accentMap: Record<string, { text: string; label: string }> = {
    emerald: { text: 'text-emerald-400', label: 'text-emerald-400/80' },
    cyan:    { text: 'text-cyan-400',    label: 'text-cyan-400/80' },
    violet:  { text: 'text-violet-400',  label: 'text-violet-400/80' },
    sky:     { text: 'text-sky-400',     label: 'text-sky-400/80' },
    indigo:  { text: 'text-indigo-400',  label: 'text-indigo-400/80' },
  };
  const c = accentMap[accentColor] || accentMap.cyan;

  const quads = items.slice(0, 4);

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col h-full">
      <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2 min-w-0">
        <div className={cn('w-2 h-2 rounded-full shrink-0', c.text.replace('text-', 'bg-'))} />
        <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
      </div>

      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-1.5 p-2.5 min-h-0">
        {quads.map((q, idx) => {
          const qc = QUADRANT_COLOR_MAP[q.label] || QUADRANT_COLOR_FALLBACK;
          const pct = Math.round((q.count / totalCount) * 100);
          const tot = q.positive + q.negative + q.neutral;
          const favPct = tot > 0 ? Math.round((q.positive / tot) * 100) : 0;
          const conPct = tot > 0 ? Math.round((q.negative / tot) * 100) : 0;
          const isFavor = favPct >= conPct;

          return (
            <div
              key={q.label}
              className={cn(
                'relative overflow-hidden rounded-xl flex flex-col items-center justify-center gap-1 p-2',
                qc.bg, qc.border, 'border',
              )}
            >
              <div className={cn('absolute -top-6 -right-6 w-12 h-12 rounded-full blur-xl pointer-events-none', qc.glow)} />
              <p className={cn('text-2xl font-black tabular-nums leading-none', qc.text)}>{pct}%</p>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-center leading-tight truncate max-w-full">
                {q.label}
              </p>
              {/* Sentiment label */}
              <p className={cn(
                'text-sm font-bold tabular-nums',
                isFavor ? 'text-emerald-400' : 'text-rose-400',
              )}>
                {isFavor ? `${favPct}% Favor` : `${conPct}% Contra`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
