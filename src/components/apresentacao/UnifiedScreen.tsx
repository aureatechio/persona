'use client';

import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Users, MessageCircle } from 'lucide-react';
import type { SegmentItem } from '@/lib/arena/segments';
import type { CommentResult, QuadrantResult, ArchetypeResult, ClusterResult } from '@/lib/arena/types';
import { ScoreHero, ScoreSegmentCard, ScoreBar, SpectrumGauge, QuadrantGrid, AnimatedScore, useLiveJitter } from './charts';
import { scoreToEmoji, scoreToHex } from '@/lib/arena/types';
import { SegmentRanking, Waiting } from './DashboardScreen';

/* ════════════════════════════════════════════════════════════════════
   VoterGaugeCompact — Shows how voters of a political figure react
   Uses voto2022 segment data (avgScore already correct from computePersonaScore)
   ════════════════════════════════════════════════════════════════════ */

function VoterGaugeCompact({ item, partyLabel, isLive = false, progress = 0 }: {
  item: SegmentItem; partyLabel: string; isLive?: boolean; progress?: number;
}) {
  const total = item.count || 0;
  const isEmpty = total === 0;
  const baseScore = isEmpty ? 0 : Math.round((item.avgScore ?? 0) * 10) / 10;
  const jitteredScore = useLiveJitter(baseScore, isLive && !isEmpty, progress);
  const score = isLive && !isEmpty ? jitteredScore : baseScore;
  const hex = scoreToHex(score);

  const concordance = isEmpty
    ? null
    : score > 6
      ? { text: 'Maioria concorda', color: 'text-emerald-400' }
      : score < 4
        ? { text: 'Maioria discorda', color: 'text-red-400' }
        : { text: 'Opinião dividida', color: 'text-amber-400' };

  const positivePct = total > 0 ? Math.round(((item.positive || 0) / total) * 100) : 0;
  const negativePct = total > 0 ? Math.round(((item.negative || 0) / total) * 100) : 0;

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl flex flex-col flex-1 min-w-[140px]">
      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-violet-500/8" />
      <div className="px-3 py-1 border-b border-white/[0.04] shrink-0 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-violet-400" />
        <span className="text-[10px] font-black uppercase tracking-[0.08em] truncate text-violet-400/80">Eleitores de {item.label} ({partyLabel})</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center px-3 py-1.5 gap-1">
        <AnimatedScore value={score} className="text-2xl" duration={isLive ? 2000 : 10000} />
        {concordance && (
          <span className={`text-[9px] font-semibold ${concordance.color}`}>{concordance.text}</span>
        )}
        {/* Score bar */}
        <div className="w-full h-[6px] rounded-full overflow-hidden relative bg-white/[0.03]">
          <div className="absolute inset-0 rounded-full opacity-20" style={{
            background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)',
          }} />
          {!isEmpty && (
            <div
              className="absolute top-0 h-full w-[6px] rounded-full"
              style={{
                left: `calc(${(score / 10) * 100}% - 3px)`,
                backgroundColor: hex,
                boxShadow: `0 0 6px ${hex}80`,
                transition: isLive ? 'all 1.5s cubic-bezier(0.16, 1, 0.3, 1)' : 'all 8s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          )}
        </div>
        {!isEmpty && (
          <div className="flex items-center gap-2 text-[8px] text-zinc-600">
            <span>{positivePct}% concordam</span>
            <span>·</span>
            <span>{negativePct}% discordam</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Comment Card + Ticker
   ════════════════════════════════════════════════════════════════════ */

function CommentCard({ c }: { c: CommentResult }) {
  const approxScore = c.sentiment === 'positive' ? 7.5 : c.sentiment === 'negative' ? 2.5 : 5.0;
  const emoji = scoreToEmoji(approxScore);
  const hex = scoreToHex(approxScore);

  return (
    <div className="py-2 border-b border-white/[0.04]">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-sm leading-none shrink-0">{emoji}</span>
        <span className="text-xs font-semibold text-zinc-100 truncate flex-1">{c.personaName}</span>
        {c.age && <span className="text-[10px] text-zinc-600">{c.age}a</span>}
        <span className="text-[10px] font-bold tabular-nums" style={{ color: hex }}>{approxScore.toFixed(1)}</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 pl-5">{c.comment}</p>
    </div>
  );
}

function CommentsTicker({ comments }: { comments: CommentResult[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const itemHeight = useRef(0);
  const tickCount = useRef(0);
  const MAX_TICKS = 5;

  useEffect(() => {
    if (!containerRef.current) return;
    const firstItem = containerRef.current.querySelector('[data-comment]');
    if (firstItem) itemHeight.current = firstItem.getBoundingClientRect().height;
  }, [comments.length]);

  // Reset tick count when new comments arrive (new search)
  useEffect(() => {
    tickCount.current = 0;
  }, [comments.length]);

  useEffect(() => {
    if (comments.length <= 5) return;
    const timer = setInterval(() => {
      if (tickCount.current >= MAX_TICKS) {
        clearInterval(timer);
        return;
      }
      tickCount.current++;
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

/** Convert categorical counts to a weighted 0-10 score */
function countsToScore(positive: number, negative: number, neutral: number, count: number): number {
  if (count === 0) return 0;
  return Math.round(((positive * 8.5 + neutral * 5.0 + negative * 1.5) / count) * 10) / 10;
}

function quadrantsToSegments(quadrants: QuadrantResult[] | undefined): SegmentItem[] | undefined {
  if (!quadrants || quadrants.length === 0) return undefined;
  return quadrants.map(q => ({ label: q.label, count: q.count, positive: q.positive, negative: q.negative, neutral: q.neutral, avgScore: countsToScore(q.positive, q.negative, q.neutral, q.count) }));
}

function archetypesToSegments(archetypes: ArchetypeResult[] | undefined): SegmentItem[] | undefined {
  if (!archetypes || archetypes.length === 0) return undefined;
  return archetypes.map(a => ({ label: a.name, count: a.count, positive: a.positive, negative: a.negative, neutral: a.neutral, avgScore: countsToScore(a.positive, a.negative, a.neutral, a.count) }));
}

function clustersToSegments(clusters: ClusterResult[] | undefined): SegmentItem[] | undefined {
  if (!clusters || clusters.length === 0) return undefined;
  return clusters.map(c => ({ label: c.name, count: c.count, positive: c.positive, negative: c.negative, neutral: c.neutral, avgScore: countsToScore(c.positive, c.negative, c.neutral, c.count) }));
}

/* ════════════════════════════════════════════════════════════════════
   UNIFIED SCREEN — Dashboard + Politico combined for TV 16:9
   ════════════════════════════════════════════════════════════════════ */

export function UnifiedScreen() {
  const { data, hasEverReceived } = usePresentationData();

  const total = (data.positive || 0) + (data.negative || 0) + (data.neutral || 0);
  const progress = data.totalCount > 0 ? Math.round((data.processedCount / data.totalCount) * 100) : 0;
  const isLive = data.phase !== 'complete';

  const comments = useMemo(() => (
    (data.simulation?.comments?.length ?? 0) > 0
      ? data.simulation!.comments : data.liveComments ?? []
  ), [data.simulation?.comments, data.liveComments]);

  const voto2022 = data.segments?.voto2022 || [];
  const lulaVoters = voto2022.find(s => s.label === 'Lula');
  const bolsonaroVoters = voto2022.find(s => s.label === 'Bolsonaro');
  const quadrantItems = useMemo(
    () => quadrantsToSegments(data.liveIdeology?.quadrants || data.simulation?.quadrants),
    [data.liveIdeology?.quadrants, data.simulation?.quadrants],
  );
  const archetypeItems = useMemo(() => (
    data.segments?.archetype?.length ? data.segments.archetype
    : archetypesToSegments(data.simulation?.archetypes)
  )?.slice(0, 6), [data.segments?.archetype, data.simulation?.archetypes]);
  const clusterItems = useMemo(() => (
    data.segments?.clusterMacro?.length ? data.segments.clusterMacro
    : clustersToSegments(data.liveIdeology?.clusterResults || data.simulation?.clusterResults)
  )?.slice(0, 6), [data.segments?.clusterMacro, data.liveIdeology?.clusterResults, data.simulation?.clusterResults]);

  return (
    <div className="h-screen w-screen bg-[#0a0a0b] overflow-hidden flex flex-col relative">
      {/* Background orbs */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[200px] bg-emerald-500/[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[200px] bg-violet-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* ═══ TOP BAR ═══ */}
      <div className="shrink-0 flex items-center gap-4 px-5 h-[44px] border-b border-white/[0.04] bg-white/[0.01]">
        {data.question ? (
          isLive ? (
            <span className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Ao vivo</span>
            </span>
          ) : (
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Completo</span>
          )
        ) : (
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Aguardando</span>
        )}
        <div className="h-4 w-px bg-white/[0.08]" />
        <div className="flex-1" />
        {data.question && <Users size={14} className="text-zinc-500" />}
        {isLive && data.question ? (
          <div key="progress-bar" className="flex items-center gap-3 flex-1 max-w-lg shrink-0">
            <div className="flex-1 h-3 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full" style={{ width: `${progress}%`, transition: progress <= 2 ? 'none' : 'width 2s ease-out' }} />
            </div>
            <span className="text-xs font-bold text-zinc-300 tabular-nums shrink-0">{data.processedCount}/{data.totalCount}</span>
            <span className="text-sm font-black text-emerald-400 tabular-nums shrink-0">{progress}%</span>
          </div>
        ) : total > 0 ? (
          <span className="text-sm font-bold text-zinc-200 tabular-nums">{total.toLocaleString('pt-BR')}</span>
        ) : null}
      </div>

      {/* ═══ HERO ZONE (compact) ═══ */}
      <ScoreHero
        avgScore={data.avgScore ?? 0}
        totalCount={data.totalCount}
        processedCount={data.processedCount}
        isLive={isLive}
        progress={progress}
        rightSlot={
          <div className="flex items-stretch gap-2 flex-1">
            {lulaVoters ? <VoterGaugeCompact item={lulaVoters} partyLabel="PT" isLive={isLive} progress={progress} /> : (
              <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center">
                <p className="text-[10px] text-zinc-700">Lula</p>
              </div>
            )}
            {bolsonaroVoters ? <VoterGaugeCompact item={bolsonaroVoters} partyLabel="PL" isLive={isLive} progress={progress} /> : (
              <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center">
                <p className="text-[10px] text-zinc-700">Bolsonaro</p>
              </div>
            )}
          </div>
        }
      />

      {/* ═══ MAIN: 3x5 Grid + Sidebar ═══ */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col gap-1.5 p-1.5 min-h-0 overflow-hidden">

          {/* Row 1 — Demografico */}
          <div className="flex-1 grid grid-cols-5 gap-1.5 min-h-0">
            <SegmentRanking    items={data.segments?.gender}     title="Gênero"       accentColor="violet" isLive={isLive} progress={progress} />
            <ScoreSegmentCard items={data.segments?.race}       title="Etnia"        accentColor="cyan" isLive={isLive} progress={progress} />
            <SegmentRanking    items={data.segments?.generation} title="Faixa Etária" accentColor="sky" isLive={isLive} progress={progress} />
            <ScoreSegmentCard items={data.segments?.religion}   title="Religião"     accentColor="amber" isLive={isLive} progress={progress} />
            <ScoreSegmentCard items={data.segments?.region}     title="Região"       accentColor="emerald" isLive={isLive} progress={progress} />
          </div>

          {/* Row 2 — Socioeconomico + Eleitoral */}
          <div className="flex-1 grid grid-cols-5 gap-1.5 min-h-0">
            <ScoreSegmentCard items={data.segments?.socialClass}      title="Classe Social"  accentColor="rose" isLive={isLive} progress={progress} />
            <ScoreSegmentCard items={data.segments?.education}        title="Escolaridade"   accentColor="fuchsia" isLive={isLive} progress={progress} />
            <ScoreSegmentCard items={data.segments?.voto2022}         title="Voto 2022"      accentColor="violet" isLive={isLive} progress={progress} />
            <ScoreSegmentCard items={data.segments?.voto2026}         title="Intenção 2026"  accentColor="emerald" isLive={isLive} progress={progress} />
            <ScoreSegmentCard items={data.segments?.politicalLeaning} title="Pos. Política"  accentColor="sky" isLive={isLive} progress={progress} />
          </div>

          {/* Row 3 — Ideologico */}
          <div className="flex-1 grid grid-cols-4 gap-1.5 min-h-0">
            <SpectrumGauge items={data.segments?.scoreEco}  title="Espectro Econ."  accentColor="sky"  leftLabel="Esquerda"     rightLabel="Direita" isLive={isLive} progress={progress} />
            <SpectrumGauge items={data.segments?.scoreCost} title="Espectro Comp." accentColor="pink" leftLabel="Progressista" rightLabel="Conservador" isLive={isLive} progress={progress} />
            <QuadrantGrid  items={quadrantItems}            title="Quadrante"       accentColor="cyan" isLive={isLive} progress={progress} />
            <SegmentRanking items={clusterItems}   title="Cluster Macro" accentColor="indigo" isLive={isLive} progress={progress} />
          </div>
        </div>

        {/* Comments sidebar */}
        <div className="w-[240px] shrink-0 flex flex-col min-h-0 border-l border-white/[0.04]">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] shrink-0 bg-white/[0.01]">
            <MessageCircle size={13} className="text-zinc-500" />
            <span className="text-xs font-black uppercase tracking-[0.08em] truncate text-zinc-500 flex-1">Reações</span>
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

      {/* Progress bar — only when actively streaming with real data */}
      {isLive && data.question && data.phase !== 'collecting' && data.processedCount > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="h-[3px] bg-zinc-900">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500" style={{ width: `${progress}%`, transition: progress <= 2 ? 'none' : 'width 2s ease-out' }} />
          </div>
        </div>
      )}
    </div>
  );
}

