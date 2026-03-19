'use client';

import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';
import { Users, Vote } from 'lucide-react';
import { Waiting } from './DashboardScreen';
import { ScoreHero, ScoreSegmentCard, ScoreBar, SpectrumGauge, QuadrantGrid, AnimatedScore } from './charts';
import { scoreToEmoji, scoreToHex } from '@/lib/arena/types';
import type { SegmentItem } from '@/lib/arena/segments';
import type { QuadrantResult, PoliticalFigureDetection } from '@/lib/arena/types';

/* ════════════════════════════════════════════════════════════════════
   FigureGaugeCompact — Fits in hero zone (~140px height)
   ════════════════════════════════════════════════════════════════════ */

function FigureGaugeCompact({ figure }: { figure: PoliticalFigureDetection }) {
  const total = figure.supportCount + figure.attackCount + figure.neutralCount;
  if (total === 0) return null;
  // Score reflects agreement with the STATEMENT, not approval of the figure.
  const rawScore = total > 0
    ? ((figure.attackCount * 9 + figure.neutralCount * 5 + figure.supportCount * 1) / total)
    : 5.0;
  const score = Math.round(rawScore * 10) / 10;
  const emoji = scoreToEmoji(score);
  const hex = scoreToHex(score);
  const barPos = (score / 10) * 100;

  return (
    <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl flex flex-col flex-1 min-w-[180px]">
      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-violet-500/8" />
      <div className="px-3 py-1.5 border-b border-white/[0.04] shrink-0 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-violet-400" />
        <span className="text-xs font-black uppercase tracking-[0.08em] truncate text-violet-400/80">{figure.label}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-2 gap-2">
        <AnimatedScore value={score} className="text-3xl" duration={3500} />
        <div className="w-full h-[8px] rounded-full overflow-hidden relative bg-white/[0.03]">
          <div className="absolute inset-0 rounded-full opacity-20" style={{ background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)' }} />
          <div className="absolute top-0 h-full w-[8px] rounded-full transition-all duration-[4s] ease-out" style={{ left: `calc(${barPos}% - 4px)`, backgroundColor: hex, boxShadow: `0 0 8px ${hex}80` }} />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════════ */

function quadrantsToSegments(quadrants: QuadrantResult[] | undefined): SegmentItem[] | undefined {
  if (!quadrants || quadrants.length === 0) return undefined;
  return quadrants.map(q => ({
    label: q.label,
    count: q.count,
    positive: q.positive,
    negative: q.negative,
    neutral: q.neutral,
    avgScore: q.count > 0 ? Math.round(((q.positive / q.count) * 10) * 10) / 10 : 5.0,
  }));
}

/* ════════════════════════════════════════════════════════════════════
   POLITICO SCREEN — TV 16:9
   ════════════════════════════════════════════════════════════════════ */

export function PoliticoScreen() {
  const { data, hasEverReceived } = usePresentationData();
  if (!hasEverReceived) return <Waiting />;

  const total = (data.positive || 0) + (data.negative || 0) + (data.neutral || 0);
  const progress = data.totalCount > 0 ? Math.round((data.processedCount / data.totalCount) * 100) : 0;
  const isLive = data.phase !== 'complete';

  const quadrantItems = quadrantsToSegments(data.liveIdeology?.quadrants || data.simulation?.quadrants);

  // Political figures
  const figures = data.liveIdeology?.politicalFigures || data.simulation?.politicalFigures || [];
  const lula = figures.find(f => f.figure === 'lula');
  const bolsonaro = figures.find(f => f.figure === 'bolsonaro');

  return (
    <div className="h-screen w-screen bg-[#0a0a0b] overflow-hidden flex flex-col relative">

      <div className="absolute top-0 right-1/4 w-[400px] h-[200px] bg-violet-500/[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[200px] bg-sky-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* ═══ TOP BAR ═══ */}
      <div className="shrink-0 flex items-center gap-4 px-6 h-[48px] border-b border-white/[0.04] bg-white/[0.01]">
        {data.question ? (
          isLive ? (
            <span className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
              </span>
              <span className="text-xs font-black text-violet-400 uppercase tracking-widest">Ao vivo</span>
            </span>
          ) : (
            <span className="text-xs font-black text-violet-400 uppercase tracking-widest">Completo</span>
          )
        ) : (
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Aguardando</span>
        )}
        <div className="h-4 w-px bg-white/[0.08]" />
        <Vote size={14} className="text-zinc-500" />
        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Painel Político</span>
        <div className="h-4 w-px bg-white/[0.08]" />
        <div className="flex-1" />
        {data.question && <Users size={14} className="text-zinc-500" />}
        {isLive && data.question ? (
          data.phase === 'collecting' ? (
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-40 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-violet-500/60 to-sky-400/60 rounded-full animate-pulse" />
              </div>
              <span className="text-xs font-medium text-zinc-400">Preparando análise...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-40 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-sky-400 rounded-full transition-all duration-[2s] ease-out" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-bold text-zinc-300 tabular-nums">{data.processedCount}/{data.totalCount}</span>
              <span className="text-sm font-black text-violet-400 tabular-nums">{progress}%</span>
            </div>
          )
        ) : total > 0 ? (
          <span className="text-sm font-bold text-zinc-200 tabular-nums">{total.toLocaleString('pt-BR')}</span>
        ) : null}
      </div>

      {/* ═══ HERO ZONE — Score + Figure Gauges ═══ */}
      <ScoreHero
        avgScore={data.avgScore ?? 5.0}
        totalCount={data.totalCount}
        processedCount={data.processedCount}
        rightSlot={
          <div className="flex items-stretch gap-3 flex-1">
            {lula ? <FigureGaugeCompact figure={lula} /> : (
              <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center min-w-[180px]">
                <p className="text-xs text-zinc-700">Lula — sem dados</p>
              </div>
            )}
            {bolsonaro ? <FigureGaugeCompact figure={bolsonaro} /> : (
              <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center min-w-[180px]">
                <p className="text-xs text-zinc-700">Bolsonaro — sem dados</p>
              </div>
            )}
          </div>
        }
      />

      {/* ═══ MAIN GRID — Uniform 3x2 ═══ */}
      <div className="flex-1 flex flex-col gap-2.5 p-2.5 min-h-0 overflow-hidden">

        {/* Row 1 — Electoral Donuts */}
        <div className="flex-1 grid grid-cols-3 gap-2.5 min-h-0">
          <ScoreSegmentCard items={data.segments?.voto2022}          title="Voto 2022"        accentColor="violet" />
          <ScoreSegmentCard items={data.segments?.voto2026}          title="Intenção 2026"    accentColor="emerald" />
          <ScoreSegmentCard items={data.segments?.politicalLeaning}  title="Pos. Política"    accentColor="sky" />
        </div>

        {/* Row 2 — Ideological Axes */}
        <div className="flex-1 grid grid-cols-3 gap-2.5 min-h-0">
          <SpectrumGauge items={data.segments?.scoreEco}  title="Espectro Econômico"      accentColor="sky"  leftLabel="Esquerda" rightLabel="Direita" />
          <SpectrumGauge items={data.segments?.scoreCost} title="Espectro Comportamental"  accentColor="pink" leftLabel="Progressista" rightLabel="Conservador" />
          <QuadrantGrid  items={quadrantItems}            title="Quadrante Ideológico"     accentColor="cyan" />
        </div>
      </div>

      {/* Progress bar — only when actively streaming */}
      {isLive && data.question && data.phase !== 'collecting' && (
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="h-[3px] bg-zinc-900">
            <div className="h-full bg-gradient-to-r from-violet-500 to-sky-500 transition-all duration-[2s] ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
