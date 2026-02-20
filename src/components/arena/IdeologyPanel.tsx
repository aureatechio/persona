'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Target, Users } from 'lucide-react';
import type { QuadrantResult, ClusterResult } from '@/lib/arena/types';
import { CLUSTERS, MACRO_COLORS, MACRO_GROUPS } from '@/lib/arena';
import { cn } from '@/lib/utils';

interface IdeologyPanelProps {
  quadrants: QuadrantResult[];
  clusterResults: ClusterResult[];
  total: number;
}

const QUADRANT_CONFIG: Record<string, {
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
  glowColor: string;
}> = {
  esq_progressista: {
    label: 'Esquerda Progressista',
    shortLabel: 'Esq. Prog.',
    color: 'from-rose-500/20 to-fuchsia-500/20',
    textColor: 'text-rose-400',
    borderColor: 'border-rose-500/15',
    bgColor: 'bg-rose-500/[0.04]',
    glowColor: 'shadow-rose-500/10',
  },
  dir_progressista: {
    label: 'Direita Progressista',
    shortLabel: 'Dir. Prog.',
    color: 'from-amber-500/20 to-orange-500/20',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/15',
    bgColor: 'bg-amber-500/[0.04]',
    glowColor: 'shadow-amber-500/10',
  },
  esq_conservador: {
    label: 'Esquerda Conservadora',
    shortLabel: 'Esq. Cons.',
    color: 'from-violet-500/20 to-indigo-500/20',
    textColor: 'text-violet-400',
    borderColor: 'border-violet-500/15',
    bgColor: 'bg-violet-500/[0.04]',
    glowColor: 'shadow-violet-500/10',
  },
  dir_conservador: {
    label: 'Direita Conservadora',
    shortLabel: 'Dir. Cons.',
    color: 'from-sky-500/20 to-cyan-500/20',
    textColor: 'text-sky-400',
    borderColor: 'border-sky-500/15',
    bgColor: 'bg-sky-500/[0.04]',
    glowColor: 'shadow-sky-500/10',
  },
};

const MACRO_LABELS: Record<string, string> = {
  Progressista: 'Progressistas',
  Moderado: 'Moderados',
  Conservador: 'Conservadores',
  Transversal: 'Transversais',
};

const MACRO_ICONS: Record<string, string> = {
  Progressista: 'P',
  Moderado: 'M',
  Conservador: 'C',
  Transversal: 'T',
};

function MiniSentimentBar({ positive, negative, neutral, total }: { positive: number; negative: number; neutral: number; total: number }) {
  if (total === 0) return null;
  const pP = (positive / total) * 100;
  const pN = (negative / total) * 100;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800/60 w-full">
      <div
        className="h-full bg-emerald-500/80 transition-all duration-[2500ms] ease-out"
        style={{ width: `${pP}%` }}
      />
      <div
        className="h-full bg-amber-500/60 transition-all duration-[2500ms] ease-out"
        style={{ width: `${100 - pP - pN}%` }}
      />
      <div
        className="h-full bg-rose-500/80 transition-all duration-[2500ms] ease-out"
        style={{ width: `${pN}%` }}
      />
    </div>
  );
}

function QuadrantCard({ quadrant, total }: { quadrant: QuadrantResult; total: number }) {
  const config = QUADRANT_CONFIG[quadrant.quadrant];
  if (!config) return null;

  const pctFavor = quadrant.count > 0 ? Math.round((quadrant.positive / quadrant.count) * 100) : 0;
  const pctOfTotal = total > 0 ? Math.round((quadrant.count / total) * 100) : 0;

  // Resolve cluster names from IDs
  const clusterNames = (quadrant.dominantClusters || [])
    .slice(0, 3)
    .map(id => CLUSTERS.find(c => c.id === id)?.name || id);

  return (
    <div className={cn(
      'relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-300 hover:scale-[1.01]',
      config.borderColor,
      config.bgColor,
    )}>
      {/* Glow accent */}
      <div className={cn('absolute top-0 left-0 w-full h-px bg-gradient-to-r', config.color)} />

      <div className="flex items-start justify-between mb-2.5">
        <div>
          <p className={cn('text-[10px] font-black uppercase tracking-[0.15em]', config.textColor)}>
            {config.shortLabel}
          </p>
          <p className="text-lg font-black text-white tabular-nums mt-0.5">
            {quadrant.count.toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="text-right">
          <span className={cn('text-[10px] font-bold', config.textColor)}>{pctOfTotal}%</span>
          <p className="text-emerald-400 text-sm font-black tabular-nums">{pctFavor}%<span className="text-[8px] text-zinc-500 ml-0.5 font-bold">fav</span></p>
        </div>
      </div>

      <MiniSentimentBar
        positive={quadrant.positive}
        negative={quadrant.negative}
        neutral={quadrant.neutral}
        total={quadrant.count}
      />

      {/* Dominant clusters as pills */}
      {clusterNames.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {clusterNames.map((name) => (
            <span
              key={name}
              className={cn(
                'px-2 py-0.5 rounded-md text-[9px] font-bold border',
                config.borderColor,
                config.textColor,
                'bg-white/[0.02]',
              )}
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MacroGroupRow({ macro, results, total }: { macro: string; results: ClusterResult[]; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const colors = MACRO_COLORS[macro];

  const totalCount = results.reduce((s, r) => s + r.count, 0);
  const totalPositive = results.reduce((s, r) => s + r.positive, 0);
  const totalNegative = results.reduce((s, r) => s + r.negative, 0);
  const totalNeutral = results.reduce((s, r) => s + r.neutral, 0);
  const pctPositive = totalCount > 0 ? Math.round((totalPositive / totalCount) * 100) : 0;
  const pctOfTotal = total > 0 ? Math.round((totalCount / total) * 100) : 0;

  // Sort clusters by count descending
  const sorted = [...results].sort((a, b) => b.count - a.count);

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] overflow-hidden transition-all duration-300">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors duration-200"
      >
        {/* Macro icon */}
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0',
          colors.bg, colors.text, 'border', colors.border,
        )}>
          {MACRO_ICONS[macro]}
        </div>

        {/* Label + count */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-black', colors.text)}>
              {MACRO_LABELS[macro]}
            </span>
            <span className="text-[10px] text-zinc-600 font-bold tabular-nums">
              {totalCount.toLocaleString('pt-BR')} ({pctOfTotal}%)
            </span>
          </div>

          {/* Inline sentiment bar */}
          <div className="mt-1.5">
            <MiniSentimentBar
              positive={totalPositive}
              negative={totalNegative}
              neutral={totalNeutral}
              total={totalCount}
            />
          </div>
        </div>

        {/* Sentiment numbers */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-emerald-400 text-xs font-black tabular-nums">{pctPositive}%</span>
            <span className="text-[9px] text-zinc-600 ml-1 font-bold">fav</span>
          </div>
          <span className="text-emerald-400 text-xs font-black tabular-nums sm:hidden">{pctPositive}%</span>
          {expanded ? (
            <ChevronUp size={14} className="text-zinc-500" />
          ) : (
            <ChevronDown size={14} className="text-zinc-500" />
          )}
        </div>
      </button>

      {/* Expanded: individual clusters */}
      {expanded && (
        <div className="px-4 pb-3 space-y-1 border-t border-white/[0.04]">
          <div className="pt-2">
            {sorted.map((cluster) => {
              const pctP = cluster.count > 0 ? Math.round((cluster.positive / cluster.count) * 100) : 0;
              const pctN = cluster.count > 0 ? Math.round((cluster.negative / cluster.count) * 100) : 0;
              return (
                <div
                  key={cluster.id}
                  className="flex items-center gap-2.5 py-1.5 group"
                >
                  {/* ID badge */}
                  <span className={cn(
                    'w-7 text-center text-[9px] font-black rounded-md py-0.5',
                    colors.bg, colors.text, 'border', colors.border,
                  )}>
                    {cluster.id}
                  </span>

                  {/* Name */}
                  <span className="text-[11px] text-zinc-300 font-medium flex-1 min-w-0 truncate">
                    {cluster.name}
                  </span>

                  {/* Inline micro bar */}
                  <div className="w-16 hidden sm:block">
                    <MiniSentimentBar
                      positive={cluster.positive}
                      negative={cluster.negative}
                      neutral={cluster.neutral}
                      total={cluster.count}
                    />
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 shrink-0 tabular-nums">
                    <span className="text-emerald-400/80 text-[10px] font-bold w-7 text-right">{pctP}%</span>
                    <span className="text-rose-400/60 text-[10px] font-bold w-7 text-right">{pctN}%</span>
                    <span className="text-zinc-600 text-[10px] font-bold w-10 text-right">{cluster.count.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function IdeologyPanel({ quadrants, clusterResults, total }: IdeologyPanelProps) {
  const hasQuadrants = quadrants.length > 0;
  const hasClusters = clusterResults.length > 0;

  if (!hasQuadrants && !hasClusters) return null;

  // Order quadrants for 2x2 grid
  const quadrantOrder = ['esq_progressista', 'dir_progressista', 'esq_conservador', 'dir_conservador'];
  const orderedQuadrants = quadrantOrder
    .map(q => quadrants.find(qr => qr.quadrant === q))
    .filter(Boolean) as QuadrantResult[];

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
      {/* Section: Quadrant Grid */}
      {hasQuadrants && orderedQuadrants.length > 0 && (
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500/20 to-sky-500/20 border border-white/[0.08] flex items-center justify-center">
              <Target size={12} className="text-white/60" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Espectro Ideologico
            </p>
          </div>

          {/* 2x2 Grid with axis labels */}
          <div className="relative">
            {/* Axis labels */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600/70 bg-zinc-950 px-2">Progressista</span>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 z-10">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600/70 bg-zinc-950 px-2">Conservador</span>
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 -left-1 z-10 -rotate-90">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600/70 bg-zinc-950 px-2">Estado</span>
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 -right-1 z-10 rotate-90">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600/70 bg-zinc-950 px-2">Mercado</span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-2 px-3 py-2">
              {orderedQuadrants.map((q) => (
                <QuadrantCard key={q.quadrant} quadrant={q} total={total} />
              ))}
            </div>

            {/* Cross lines */}
            <div className="absolute top-1/2 left-3 right-3 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />
            <div className="absolute left-1/2 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent pointer-events-none" />
          </div>
        </div>
      )}

      {/* Divider */}
      {hasQuadrants && hasClusters && (
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mx-5" />
      )}

      {/* Section: Cluster Breakdown */}
      {hasClusters && (
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center">
                <Users size={12} className="text-white/60" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                Grupos Ideologicos
              </p>
            </div>
            <span className="text-[9px] text-zinc-600 font-bold tabular-nums">
              {clusterResults.length} clusters
            </span>
          </div>

          <div className="space-y-2">
            {MACRO_GROUPS.map(macro => {
              const results = clusterResults.filter(r => r.macro === macro);
              if (results.length === 0) return null;
              return (
                <MacroGroupRow
                  key={macro}
                  macro={macro}
                  results={results}
                  total={total}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-emerald-500/80" />
              <span className="text-[9px] text-zinc-600 font-bold">A favor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-amber-500/60" />
              <span className="text-[9px] text-zinc-600 font-bold">Neutro</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-rose-500/80" />
              <span className="text-[9px] text-zinc-600 font-bold">Contra</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
