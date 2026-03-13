'use client';

import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';
import { AnimatedNumber } from '@/hooks/useAnimatedValue';
import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Users, BarChart3, MessageCircle, UserRound } from 'lucide-react';
import type { SegmentItem } from '@/lib/arena/segments';
import type { CommentResult, QuadrantResult, ArchetypeResult } from '@/lib/arena/types';
import { TrendHero, SentimentBar, DonutCard, HBarChart } from './charts';

/* ════════════════════════════════════════════════════════════════════
   Segment Ranking v2 — contextual labels, readable font sizes
   (EXPORTED for reuse in PoliticoScreen)
   ════════════════════════════════════════════════════════════════════ */

function shallowEqualSegments(a: SegmentItem[] | undefined, b: SegmentItem[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((item, i) =>
    item.label === b[i].label &&
    item.count === b[i].count &&
    item.positive === b[i].positive &&
    item.negative === b[i].negative &&
    item.neutral === b[i].neutral
  );
}

export const SegmentRanking = memo(function SegmentRanking({
  items,
  title,
  accentColor,
}: {
  items: SegmentItem[] | undefined;
  title: string;
  accentColor: string;
}) {
  const sorted = items && items.length > 0 ? [...items].sort((a, b) => b.count - a.count) : [];

  const colorMap: Record<string, { glow: string; text: string; label: string }> = {
    emerald: { glow: 'bg-emerald-500/8', text: 'text-emerald-400', label: 'text-emerald-400/80' },
    amber:   { glow: 'bg-amber-500/8',   text: 'text-amber-400',   label: 'text-amber-400/80' },
    violet:  { glow: 'bg-violet-500/8',   text: 'text-violet-400',  label: 'text-violet-400/80' },
    cyan:    { glow: 'bg-cyan-500/8',     text: 'text-cyan-400',    label: 'text-cyan-400/80' },
    sky:     { glow: 'bg-sky-500/8',      text: 'text-sky-400',     label: 'text-sky-400/80' },
    rose:    { glow: 'bg-rose-500/8',     text: 'text-rose-400',    label: 'text-rose-400/80' },
    fuchsia: { glow: 'bg-fuchsia-500/8',  text: 'text-fuchsia-400', label: 'text-fuchsia-400/80' },
    indigo:  { glow: 'bg-indigo-500/8',   text: 'text-indigo-400',  label: 'text-indigo-400/80' },
    orange:  { glow: 'bg-orange-500/8',   text: 'text-orange-400',  label: 'text-orange-400/80' },
    pink:    { glow: 'bg-pink-500/8',     text: 'text-pink-400',    label: 'text-pink-400/80' },
  };
  const c = colorMap[accentColor] || colorMap.emerald;

  // ── Empty state — card shell with header while awaiting data ──
  if (sorted.length === 0) {
    return (
      <div className={cn(
        'relative overflow-hidden',
        'bg-white/[0.03] backdrop-blur-xl',
        'border border-white/[0.06]',
        'rounded-2xl',
        'flex flex-col h-full',
      )}>
        <div className={cn('absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none', c.glow)} />
        <div className="px-4 py-2.5 border-b border-white/[0.04] shrink-0 flex items-center gap-2.5">
          <div className={cn('w-2 h-2 rounded-full', c.text.replace('text-', 'bg-'))} />
          <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-700">Aguardando...</p>
        </div>
      </div>
    );
  }

  // ── Gender layout (≤2 items) — two full halves with icons ──
  if (sorted.length <= 2) {
    return (
      <div className={cn(
        'relative overflow-hidden',
        'bg-white/[0.03] backdrop-blur-xl',
        'border border-white/[0.06]',
        'rounded-2xl',
        'flex flex-col h-full',
      )}>
        <div className={cn('absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none', c.glow)} />

        <div className="px-5 py-2.5 border-b border-white/[0.04] shrink-0 flex items-center gap-2.5">
          <div className={cn('w-2 h-2 rounded-full', c.text.replace('text-', 'bg-'))} />
          <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
        </div>

        <div className="flex-1 grid grid-rows-2 gap-0 min-h-0">
          {sorted.map((item, idx) => {
            const tot = item.positive + item.negative + item.neutral;
            const pctFav = tot > 0 ? Math.round((item.positive / tot) * 100) : 0;
            const pctCon = tot > 0 ? Math.round((item.negative / tot) * 100) : 0;
            const pctNeu = tot > 0 ? Math.round((item.neutral / tot) * 100) : 0;

            return (
              <div
                key={item.label}
                className={cn(
                  'relative overflow-hidden flex items-center gap-3 px-4 py-1.5',
                  idx === 0 && 'border-b border-white/[0.04]',
                )}
              >
                <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 w-10">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.06]">
                    <UserRound size={16} className="text-violet-400" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-300">{item.label}</span>
                </div>

                <div className="flex-1 min-w-0 relative flex flex-col justify-center gap-1.5">
                  <div className="h-[6px] rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-400 transition-all duration-[1.5s]" style={{ width: `${pctFav}%` }} />
                    <div className="h-full bg-amber-400 transition-all duration-[1.5s]" style={{ width: `${pctNeu}%` }} />
                    <div className="h-full bg-rose-400 transition-all duration-[1.5s]" style={{ width: `${pctCon}%` }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-white/[0.03] rounded-lg px-2 py-0.5 border border-white/[0.04]">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500/60">Favor</p>
                      <p className="text-sm font-black tabular-nums text-emerald-400 leading-tight"><AnimatedNumber value={pctFav} suffix="%" /></p>
                    </div>
                    <div className="flex-1 bg-white/[0.03] rounded-lg px-2 py-0.5 border border-white/[0.04]">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500/60">Neutro</p>
                      <p className="text-sm font-black tabular-nums text-amber-400 leading-tight"><AnimatedNumber value={pctNeu} suffix="%" /></p>
                    </div>
                    <div className="flex-1 bg-white/[0.03] rounded-lg px-2 py-0.5 border border-white/[0.04]">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-rose-500/60">Contra</p>
                      <p className="text-sm font-black tabular-nums text-rose-400 leading-tight"><AnimatedNumber value={pctCon} suffix="%" /></p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Standard layout (3+ items) — contextual sentiment labels ──
  const display = sorted.slice(0, 6);

  return (
    <div className={cn(
      'relative overflow-hidden',
      'bg-white/[0.03] backdrop-blur-xl',
      'border border-white/[0.06]',
      'rounded-2xl',
      'flex flex-col h-full',
    )}>
      <div className={cn('absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none', c.glow)} />

      <div className="px-4 py-2.5 border-b border-white/[0.04] shrink-0 flex items-center gap-2.5">
        <div className={cn('w-2 h-2 rounded-full', c.text.replace('text-', 'bg-'))} />
        <span className={cn('text-xs font-black uppercase tracking-[0.08em] truncate', c.label)}>{title}</span>
      </div>

      <div className="flex-1 px-4 py-2 flex flex-col justify-evenly overflow-hidden">
        {display.map((item, i) => {
          const tot = item.positive + item.negative + item.neutral;
          const pctFav = tot > 0 ? Math.round((item.positive / tot) * 100) : 0;
          const pctCon = tot > 0 ? Math.round((item.negative / tot) * 100) : 0;

          return (
            <div key={item.label} className="flex items-center gap-2 group">
              <span className={cn(
                'w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0',
                i === 0 ? cn('bg-white/[0.08]', c.text) : 'bg-white/[0.03] text-zinc-600',
              )}>
                {i + 1}
              </span>
              <span className="text-xs text-zinc-300 w-[80px] truncate shrink-0 group-hover:text-white transition-colors duration-200">
                {item.label}
              </span>
              <div className="flex-1 h-[8px] rounded-full overflow-hidden flex">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-[1.5s]" style={{ width: `${pctFav}%` }} />
                <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-[1.5s]" style={{ width: `${pctCon}%` }} />
              </div>
              <span className="text-xs font-bold tabular-nums text-emerald-400 shrink-0"><AnimatedNumber value={pctFav} suffix="%" /> Favor</span>
              <span className="text-zinc-700 text-xs shrink-0">·</span>
              <span className="text-xs font-bold tabular-nums text-rose-400 shrink-0"><AnimatedNumber value={pctCon} suffix="%" /> Contra</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.title === next.title &&
    prev.accentColor === next.accentColor &&
    shallowEqualSegments(prev.items, next.items);
});

/* ════════════════════════════════════════════════════════════════════
   Comment Card + Ticker
   ════════════════════════════════════════════════════════════════════ */

function CommentCard({ c }: { c: CommentResult }) {
  const dot = c.sentiment === 'positive' ? 'bg-emerald-400' : c.sentiment === 'negative' ? 'bg-rose-400' : 'bg-amber-400';
  const sentimentLabel = c.sentiment === 'positive' ? 'A Favor' : c.sentiment === 'negative' ? 'Contra' : 'Neutro';
  const sentimentColor = c.sentiment === 'positive' ? 'text-emerald-500' : c.sentiment === 'negative' ? 'text-rose-500' : 'text-amber-500';

  return (
    <div className="py-2.5 border-b border-white/[0.04]">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
        <span className="text-sm font-semibold text-zinc-100 truncate flex-1">{c.personaName}</span>
        {c.age && <span className="text-xs text-zinc-600">{c.age}a</span>}
        <span className={cn('text-xs font-bold uppercase', sentimentColor)}>{sentimentLabel}</span>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2 pl-4">{c.comment}</p>
    </div>
  );
}

function CommentsTicker({ comments }: { comments: CommentResult[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const itemHeight = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const firstItem = containerRef.current.querySelector('[data-comment]');
    if (firstItem) itemHeight.current = firstItem.getBoundingClientRect().height;
  }, [comments.length]);

  useEffect(() => {
    if (comments.length <= 5) return;
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setOffset(prev => (prev + 1 >= comments.length ? 0 : prev + 1));
    }, 3500);
    return () => clearInterval(timer);
  }, [comments.length]);

  useEffect(() => {
    if (!isTransitioning) return;
    const t = setTimeout(() => setIsTransitioning(false), 500);
    return () => clearTimeout(t);
  }, [isTransitioning, offset]);

  const visibleComments: CommentResult[] = [];
  const count = Math.min(comments.length, 12);
  for (let i = 0; i < count; i++) visibleComments.push(comments[(offset + i) % comments.length]);

  return (
    <div className="flex-1 overflow-hidden relative" ref={containerRef}>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0a0b] to-transparent z-10 pointer-events-none" />
      <div
        className={cn('px-5', isTransitioning && 'transition-transform duration-500 ease-out')}
        style={{ transform: isTransitioning && itemHeight.current > 0 ? `translateY(-${itemHeight.current}px)` : 'translateY(0)' }}
        onTransitionEnd={() => setIsTransitioning(false)}
      >
        {visibleComments.map((c, i) => (
          <div key={`${offset}-${i}`} data-comment><CommentCard c={c} /></div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Waiting (EXPORTED)
   ════════════════════════════════════════════════════════════════════ */

export function Waiting() {
  return (
    <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" style={{ animation: 'spin 6s linear infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <BarChart3 size={24} className="text-emerald-400/40 animate-pulse" />
          </div>
        </div>
        <p className="text-sm text-zinc-600">Aguardando dados...</p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Helpers: convert simulation data to SegmentItem[]
   ════════════════════════════════════════════════════════════════════ */

function quadrantsToSegments(quadrants: QuadrantResult[] | undefined): SegmentItem[] | undefined {
  if (!quadrants || quadrants.length === 0) return undefined;
  return quadrants.map(q => ({
    label: q.label,
    count: q.count,
    positive: q.positive,
    negative: q.negative,
    neutral: q.neutral,
  }));
}

function archetypesToSegments(archetypes: ArchetypeResult[] | undefined): SegmentItem[] | undefined {
  if (!archetypes || archetypes.length === 0) return undefined;
  return archetypes.map(a => ({
    label: a.name,
    count: a.count,
    positive: a.positive,
    negative: a.negative,
    neutral: a.neutral,
  }));
}

/* ════════════════════════════════════════════════════════════════════
   DASHBOARD — TV 16:9
   ════════════════════════════════════════════════════════════════════ */

export function DashboardScreen() {
  const { data, hasEverReceived } = usePresentationData();

  const positive = data.positive || 0;
  const negative = data.negative || 0;
  const neutral = data.neutral || 0;
  const total = positive + negative + neutral;
  const progress = data.totalCount > 0 ? Math.round((data.processedCount / data.totalCount) * 100) : 0;
  const isLive = data.phase !== 'complete';

  const comments = useMemo(() => (
    (data.simulation?.comments?.length ?? 0) > 0
      ? data.simulation!.comments : data.liveComments ?? []
  ), [data.simulation?.comments, data.liveComments]);

  const archetypeItems = useMemo(
    () => archetypesToSegments(data.simulation?.archetypes)?.slice(0, 6),
    [data.simulation?.archetypes],
  );

  const sentimentBar = useMemo(() => (
    <SentimentBar positive={positive} negative={negative} neutral={neutral} />
  ), [positive, negative, neutral]);

  return (
    <div className="h-screen w-screen bg-[#0a0a0b] overflow-hidden flex flex-col relative">

      <div className="absolute top-0 left-1/4 w-[400px] h-[200px] bg-emerald-500/[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[200px] bg-violet-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* ═══ TOP BAR ═══ */}
      <div className="shrink-0 flex items-center gap-4 px-6 h-[48px] border-b border-white/[0.04] bg-white/[0.01]">
        {isLive ? (
          <span className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Ao vivo</span>
          </span>
        ) : (
          <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Completo</span>
        )}
        <div className="h-4 w-px bg-white/[0.08]" />
        <p className="text-sm text-zinc-200 font-semibold truncate flex-1">{data.question}</p>
        <Users size={14} className="text-zinc-500" />
        {isLive ? (
          data.phase === 'collecting' ? (
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-40 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-emerald-500/60 to-sky-400/60 rounded-full animate-pulse" />
              </div>
              <span className="text-xs font-medium text-zinc-400">Preparando analise...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-40 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full transition-all duration-[2s] ease-out" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-bold text-zinc-300 tabular-nums">{data.processedCount}/{data.totalCount}</span>
              <span className="text-sm font-black text-emerald-400 tabular-nums">{progress}%</span>
            </div>
          )
        ) : (
          <span className="text-sm font-bold text-zinc-200 tabular-nums">{total.toLocaleString('pt-BR')}</span>
        )}
      </div>

      {/* ═══ HERO ZONE ═══ */}
      <TrendHero
        positive={positive}
        negative={negative}
        neutral={neutral}
        rightSlot={sentimentBar}
      />

      {/* ═══ MAIN GRID: 2 rows × 4 cols + sidebar ═══ */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        <div className="flex-1 flex flex-col gap-2 p-2.5 min-h-0 overflow-hidden">
          {/* Row 1 — Donuts + Rankings (visual variety) */}
          <div className="flex-1 grid grid-cols-4 gap-2 min-h-0">
            <SegmentRanking items={data.segments?.gender}     title="Genero"         accentColor="violet" />
            <DonutCard items={data.segments?.race}            title="Etnia"          accentColor="cyan" />
            <SegmentRanking items={data.segments?.generation} title="Faixa Etaria"   accentColor="sky" />
            <SegmentRanking items={archetypeItems}            title="Arquetipos"     accentColor="orange" />
          </div>
          {/* Row 2 — HBarCharts (dense data) */}
          <div className="flex-1 grid grid-cols-4 gap-2 min-h-0">
            <HBarChart items={data.segments?.religion}    title="Religiao"       accentColor="amber" />
            <HBarChart items={data.segments?.region}      title="Regiao"         accentColor="emerald" />
            <HBarChart items={data.segments?.socialClass} title="Classe Social"  accentColor="rose" />
            <HBarChart items={data.segments?.education}   title="Escolaridade"   accentColor="fuchsia" />
          </div>
        </div>

        {/* Comments sidebar */}
        <div className="w-[280px] shrink-0 flex flex-col min-h-0 border-l border-white/[0.04]">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] shrink-0 bg-white/[0.01]">
            <MessageCircle size={13} className="text-zinc-500" />
            <span className="text-xs font-black uppercase tracking-[0.08em] truncate text-zinc-500 flex-1">Reacoes</span>
            <span className="text-xs text-zinc-600 tabular-nums">{comments.length}</span>
          </div>
          {comments.length > 0 ? (
            <CommentsTicker comments={comments.slice(0, 50)} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-zinc-700">Aguardando...</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar — only when actively streaming */}
      {isLive && data.phase !== 'collecting' && (
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="h-[3px] bg-zinc-900">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-[2s] ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
