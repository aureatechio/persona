'use client';

import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';
import { useState, useEffect, useRef } from 'react';
import { Users, MessageCircle } from 'lucide-react';
import type { SegmentItem } from '@/lib/arena/segments';
import type { CommentResult, QuadrantResult, ArchetypeResult, ClusterResult, PoliticalFigureDetection } from '@/lib/arena/types';
import { TrendHero, SentimentBar, DonutCard, HBarChart, SpectrumGauge, QuadrantGrid } from './charts';
import { SegmentRanking, Waiting } from './DashboardScreen';

/* ════════════════════════════════════════════════════════════════════
   FigureGaugeCompact — Political figure approval gauge (compact)
   ════════════════════════════════════════════════════════════════════ */

function FigureGaugeCompact({ figure }: { figure: PoliticalFigureDetection }) {
  const total = figure.supportCount + figure.attackCount + figure.neutralCount;
  if (total === 0) return null;
  const pctSupport = Math.round((figure.supportCount / total) * 100);
  const pctAttack = Math.round((figure.attackCount / total) * 100);
  const pctNeutral = Math.round((figure.neutralCount / total) * 100);
  const isPositive = pctSupport > pctAttack;

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl flex flex-col flex-1 min-w-[140px]">
      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-violet-500/8" />
      <div className="px-3 py-1 border-b border-white/[0.04] shrink-0 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-violet-400" />
        <span className="text-xs font-black uppercase tracking-[0.08em] truncate text-violet-400/80">{figure.label}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center px-3 py-1.5 gap-1.5">
        <div className="text-center">
          <p className={cn('text-2xl font-black tabular-nums leading-none', isPositive ? 'text-emerald-400' : 'text-rose-400')}>
            {isPositive ? pctSupport : pctAttack}%
          </p>
          <p className={cn('text-[10px] font-bold mt-0.5', isPositive ? 'text-emerald-400/70' : 'text-rose-400/70')}>
            {isPositive ? 'Aprovacao' : 'Rejeicao'}
          </p>
        </div>
        <div className="h-[8px] rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-400 transition-all duration-[1.5s]" style={{ width: `${pctSupport}%` }} />
          <div className="h-full bg-amber-400 transition-all duration-[1.5s]" style={{ width: `${pctNeutral}%` }} />
          <div className="h-full bg-rose-400 transition-all duration-[1.5s]" style={{ width: `${pctAttack}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Comment Card + Ticker
   ════════════════════════════════════════════════════════════════════ */

function CommentCard({ c }: { c: CommentResult }) {
  const dot = c.sentiment === 'positive' ? 'bg-emerald-400' : c.sentiment === 'negative' ? 'bg-rose-400' : 'bg-amber-400';
  const sentimentLabel = c.sentiment === 'positive' ? 'A Favor' : c.sentiment === 'negative' ? 'Contra' : 'Neutro';
  const sentimentColor = c.sentiment === 'positive' ? 'text-emerald-500' : c.sentiment === 'negative' ? 'text-rose-500' : 'text-amber-500';

  return (
    <div className="py-2 border-b border-white/[0.04]">
      <div className="flex items-center gap-2 mb-0.5">
        <div className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
        <span className="text-xs font-semibold text-zinc-100 truncate flex-1">{c.personaName}</span>
        {c.age && <span className="text-[10px] text-zinc-600">{c.age}a</span>}
        <span className={cn('text-[10px] font-bold uppercase', sentimentColor)}>{sentimentLabel}</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 pl-4">{c.comment}</p>
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
        className={cn('px-4', isTransitioning && 'transition-transform duration-500 ease-out')}
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
   Helpers
   ════════════════════════════════════════════════════════════════════ */

function quadrantsToSegments(quadrants: QuadrantResult[] | undefined): SegmentItem[] | undefined {
  if (!quadrants || quadrants.length === 0) return undefined;
  return quadrants.map(q => ({ label: q.label, count: q.count, positive: q.positive, negative: q.negative, neutral: q.neutral }));
}

function archetypesToSegments(archetypes: ArchetypeResult[] | undefined): SegmentItem[] | undefined {
  if (!archetypes || archetypes.length === 0) return undefined;
  return archetypes.map(a => ({ label: a.name, count: a.count, positive: a.positive, negative: a.negative, neutral: a.neutral }));
}

function clustersToSegments(clusters: ClusterResult[] | undefined): SegmentItem[] | undefined {
  if (!clusters || clusters.length === 0) return undefined;
  return clusters.map(c => ({ label: c.name, count: c.count, positive: c.positive, negative: c.negative, neutral: c.neutral }));
}

/* ════════════════════════════════════════════════════════════════════
   UNIFIED SCREEN — Dashboard + Politico combined for TV 16:9
   ════════════════════════════════════════════════════════════════════ */

export function UnifiedScreen() {
  const { data, hasEverReceived } = usePresentationData();
  if (!hasEverReceived) return <Waiting />;

  const total = (data.positive || 0) + (data.negative || 0) + (data.neutral || 0);
  const progress = data.totalCount > 0 ? Math.round((data.processedCount / data.totalCount) * 100) : 0;
  const isLive = data.phase !== 'complete';

  const comments = (data.simulation?.comments?.length ?? 0) > 0
    ? data.simulation!.comments : data.liveComments ?? [];

  const figures = data.liveIdeology?.politicalFigures || data.simulation?.politicalFigures || [];
  const lula = figures.find(f => f.figure === 'lula');
  const bolsonaro = figures.find(f => f.figure === 'bolsonaro');
  const quadrantItems = quadrantsToSegments(data.liveIdeology?.quadrants || data.simulation?.quadrants);
  const archetypeItems = (
    data.segments?.archetype?.length ? data.segments.archetype
    : archetypesToSegments(data.simulation?.archetypes)
  )?.slice(0, 6);
  const clusterItems = (
    data.segments?.clusterMacro?.length ? data.segments.clusterMacro
    : clustersToSegments(data.liveIdeology?.clusterResults || data.simulation?.clusterResults)
  )?.slice(0, 6);

  return (
    <div className="h-screen w-screen bg-[#0a0a0b] overflow-hidden flex flex-col relative">
      {/* Background orbs */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[200px] bg-emerald-500/[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[200px] bg-violet-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* ═══ TOP BAR ═══ */}
      <div className="shrink-0 flex items-center gap-4 px-5 h-[44px] border-b border-white/[0.04] bg-white/[0.01]">
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
        <span className="text-sm font-bold text-zinc-200 tabular-nums">{isLive ? `${progress}%` : total.toLocaleString('pt-BR')}</span>
      </div>

      {/* ═══ HERO ZONE (compact) ═══ */}
      <div className="shrink-0 flex items-stretch gap-2 px-3 py-2 border-b border-white/[0.04]">
        {/* 3 Stat Cards */}
        <TrendHeroCompact positive={data.positive || 0} negative={data.negative || 0} neutral={data.neutral || 0} />

        {/* SentimentBar + Political Figures */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <SentimentBar positive={data.positive || 0} negative={data.negative || 0} neutral={data.neutral || 0} />
          <div className="flex items-stretch gap-2 flex-1">
            {lula ? <FigureGaugeCompact figure={lula} /> : (
              <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center">
                <p className="text-[10px] text-zinc-700">Lula</p>
              </div>
            )}
            {bolsonaro ? <FigureGaugeCompact figure={bolsonaro} /> : (
              <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center">
                <p className="text-[10px] text-zinc-700">Bolsonaro</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MAIN: 3x5 Grid + Sidebar ═══ */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col gap-1.5 p-1.5 min-h-0 overflow-hidden">

          {/* Row 1 — Demografico */}
          <div className="flex-1 grid grid-cols-5 gap-1.5 min-h-0">
            <SegmentRanking items={data.segments?.gender}     title="Genero"       accentColor="violet" />
            <DonutCard      items={data.segments?.race}       title="Etnia"        accentColor="cyan" />
            <SegmentRanking items={data.segments?.generation} title="Faixa Etaria" accentColor="sky" />
            <HBarChart      items={data.segments?.religion}   title="Religiao"     accentColor="amber" />
            <HBarChart      items={data.segments?.region}     title="Regiao"       accentColor="emerald" />
          </div>

          {/* Row 2 — Socioeconomico + Eleitoral */}
          <div className="flex-1 grid grid-cols-5 gap-1.5 min-h-0">
            <HBarChart items={data.segments?.socialClass}      title="Classe Social"  accentColor="rose" />
            <HBarChart items={data.segments?.education}        title="Escolaridade"   accentColor="fuchsia" />
            <DonutCard items={data.segments?.voto2022}         title="Voto 2022"      accentColor="violet" />
            <DonutCard items={data.segments?.voto2026}         title="Intencao 2026"  accentColor="emerald" />
            <DonutCard items={data.segments?.politicalLeaning} title="Pos. Politica"  accentColor="sky" />
          </div>

          {/* Row 3 — Ideologico */}
          <div className="flex-1 grid grid-cols-5 gap-1.5 min-h-0">
            <SpectrumGauge items={data.segments?.scoreEco}  title="Espectro Eco"   accentColor="sky"  leftLabel="Esquerda"     rightLabel="Direita" />
            <SpectrumGauge items={data.segments?.scoreCost} title="Espectro Comp"  accentColor="pink" leftLabel="Progressista" rightLabel="Conservador" />
            <QuadrantGrid  items={quadrantItems}            title="Quadrante"      accentColor="cyan" />
            <SegmentRanking items={archetypeItems} title="Arquetipos" accentColor="orange" />
            <SegmentRanking items={clusterItems}   title="Cluster Macro" accentColor="indigo" />
          </div>
        </div>

        {/* Comments sidebar */}
        <div className="w-[240px] shrink-0 flex flex-col min-h-0 border-l border-white/[0.04]">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] shrink-0 bg-white/[0.01]">
            <MessageCircle size={13} className="text-zinc-500" />
            <span className="text-xs font-black uppercase tracking-[0.08em] truncate text-zinc-500 flex-1">Reacoes</span>
            <span className="text-xs text-zinc-600 tabular-nums">{comments.length}</span>
          </div>
          {comments.length > 0 ? (
            <CommentsTicker comments={comments.slice(0, 50)} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-zinc-700">Aguardando...</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isLive && (
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="h-[3px] bg-zinc-900">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   TrendHeroCompact — Inline stat cards for the unified hero zone
   ════════════════════════════════════════════════════════════════════ */

function TrendHeroCompact({ positive, negative, neutral }: { positive: number; negative: number; neutral: number }) {
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

  const colorMap = {
    emerald: { text: 'text-emerald-400', sub: 'text-emerald-500/60' },
    amber:   { text: 'text-amber-400',   sub: 'text-amber-500/60' },
    rose:    { text: 'text-rose-400',     sub: 'text-rose-500/60' },
  };

  return (
    <div className="flex items-stretch gap-2 shrink-0">
      {stats.map((s, i) => {
        const c = colorMap[s.color];
        if (i === dominantIdx) {
          return (
            <div key={s.key} className={cn(
              'relative overflow-hidden w-[200px] shrink-0',
              'bg-white/[0.03] backdrop-blur-xl rounded-xl',
              'border', s.border,
              'flex flex-col items-center justify-center px-4 py-2',
            )}>
              <div className={cn('absolute inset-0 bg-gradient-to-br opacity-40 pointer-events-none', s.glow)} />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 relative">Tendencia</p>
              <p className={cn('text-4xl font-black tabular-nums leading-none relative', c.text)}>{s.value}%</p>
              <p className={cn('text-xs font-bold relative mt-0.5', c.sub)}>{s.label}</p>
              <p className="text-[10px] text-zinc-600 tabular-nums relative">{s.count.toLocaleString('pt-BR')}</p>
            </div>
          );
        }
        return (
          <div key={s.key} className="relative overflow-hidden bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-1.5 flex flex-col items-center justify-center min-w-[120px]">
            <p className={cn('text-3xl font-black tabular-nums leading-none', c.text)}>{s.value}%</p>
            <p className={cn('text-[10px] font-bold uppercase tracking-wider mt-0.5', c.sub)}>{s.label}</p>
            <p className="text-[10px] text-zinc-600 tabular-nums">{s.count.toLocaleString('pt-BR')}</p>
          </div>
        );
      })}
    </div>
  );
}
