'use client';

import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';
import { Users, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import type { SegmentItem } from '@/lib/arena/segments';

/* ─── Mini Segment Bar ──────────────────────────────────────────────── */

function MiniSegmentBar({ items, title }: { items: SegmentItem[] | undefined; title: string }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 truncate">{title}</span>
      <div className="flex flex-col gap-1.5">
        {items.slice(0, 4).map((item) => {
          const total = item.positive + item.negative + item.neutral;
          const pPos = total > 0 ? (item.positive / total) * 100 : 0;
          const pNeu = total > 0 ? (item.neutral / total) * 100 : 0;
          const pNeg = total > 0 ? (item.negative / total) * 100 : 0;

          return (
            <div key={item.label} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 truncate flex-1 mr-2">{item.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-emerald-400">{pPos.toFixed(0)}%</span>
                  <span className="text-[10px] font-bold text-rose-400">{pNeg.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex bg-zinc-800/50">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${pPos}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${pNeu}%` }} />
                <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${pNeg}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Ideology Mini Card ────────────────────────────────────────────── */

function IdeologyMiniCard({ label, data }: { label: string; data: any }) {
  if (!data) return null;
  const total = data.positive + data.negative + data.neutral;
  const pPos = total > 0 ? (data.positive / total) * 100 : 0;
  const pNeg = total > 0 ? (data.negative / total) * 100 : 0;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 truncate">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-emerald-400">{pPos.toFixed(0)}%</span>
        <span className="text-xs text-zinc-600">favor</span>
        <span className="text-lg font-bold text-rose-400 ml-auto">{pNeg.toFixed(0)}%</span>
        <span className="text-xs text-zinc-600">contra</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex bg-zinc-800/50">
        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${pPos}%` }} />
        <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${100 - pPos - pNeg}%` }} />
        <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${pNeg}%` }} />
      </div>
      <span className="text-[10px] text-zinc-600">{total.toLocaleString()} personas</span>
    </div>
  );
}

/* ─── Main Dashboard Screen ─────────────────────────────────────────── */

export function DashboardScreen() {
  const data = usePresentationData();

  const total = (data?.positive || 0) + (data?.negative || 0) + (data?.neutral || 0);
  const pctPos = total > 0 ? Math.round((data!.positive / total) * 100) : 0;
  const pctNeg = total > 0 ? Math.round((data!.negative / total) * 100) : 0;
  const pctNeu = total > 0 ? Math.round((data!.neutral / total) * 100) : 0;

  // Determine dominant sentiment
  const dominant = pctPos >= pctNeg && pctPos >= pctNeu ? 'positive'
    : pctNeg >= pctPos && pctNeg >= pctNeu ? 'negative'
    : 'neutral';
  const dominantPct = dominant === 'positive' ? pctPos : dominant === 'negative' ? pctNeg : pctNeu;
  const dominantLabel = dominant === 'positive' ? 'A Favor' : dominant === 'negative' ? 'Contra' : 'Neutros';
  const dominantColor = dominant === 'positive' ? 'emerald' : dominant === 'negative' ? 'rose' : 'amber';

  // Build ideology quadrant data from liveIdeology
  const quadrants = data?.liveIdeology?.quadrants || [];
  const quadrantMap: Record<string, any> = {};
  for (const q of quadrants) {
    quadrantMap[q.quadrant] = q;
  }

  if (!data) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/[0.04]">
            <BarChart3 size={48} className="text-zinc-700" />
          </div>
          <p className="text-zinc-600 text-lg">Aguardando analise...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden flex flex-col p-5 gap-4">
      {/* Top: Question + Live indicator */}
      <div className="shrink-0 flex items-center gap-4">
        <div className="flex-1 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl px-5 py-3">
          <p className="text-base text-zinc-300 font-medium truncate">{data.question}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl shrink-0">
          {data.phase !== 'complete' && (
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          )}
          <span className="text-xs text-zinc-400 font-medium">
            {data.phase === 'complete' ? `${total.toLocaleString()} personas` : `${Math.round((data.processedCount / data.totalCount) * 100)}%`}
          </span>
        </div>
      </div>

      {/* Hero Sentiment Bar */}
      <div className="shrink-0">
        <div className="relative">
          <div className="absolute inset-x-0 -bottom-2 h-4 bg-gradient-to-r from-emerald-500/10 via-amber-500/5 to-rose-500/10 blur-xl rounded-full pointer-events-none" />
          <div className="h-14 rounded-2xl overflow-hidden flex bg-zinc-900/80 border border-white/[0.06]">
            <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 flex items-center justify-center transition-all duration-[2500ms] ease-out"
              style={{ width: `${pctPos}%` }}>
              {pctPos > 8 && <span className="text-sm font-black text-white drop-shadow-sm">{pctPos}%</span>}
            </div>
            <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 flex items-center justify-center transition-all duration-[2500ms] ease-out"
              style={{ width: `${pctNeu}%` }}>
              {pctNeu > 8 && <span className="text-sm font-black text-white drop-shadow-sm">{pctNeu}%</span>}
            </div>
            <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 flex items-center justify-center transition-all duration-[2500ms] ease-out"
              style={{ width: `${pctNeg}%` }}>
              {pctNeg > 8 && <span className="text-sm font-black text-white drop-shadow-sm">{pctNeg}%</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Dominance Cards */}
      <div className="shrink-0 grid grid-cols-4 gap-3">
        {/* Large dominant card */}
        <div className={cn(
          'bg-white/[0.04] border rounded-2xl p-4 flex flex-col justify-center',
          dominant === 'positive' ? 'border-emerald-500/30' : dominant === 'negative' ? 'border-rose-500/30' : 'border-amber-500/30'
        )}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Tendencia Dominante</span>
          <span className={cn(
            'text-4xl font-black tracking-tight mt-1',
            dominant === 'positive' ? 'text-emerald-400' : dominant === 'negative' ? 'text-rose-400' : 'text-amber-400'
          )}>{dominantPct}%</span>
          <span className={cn(
            'text-sm font-semibold',
            dominant === 'positive' ? 'text-emerald-500' : dominant === 'negative' ? 'text-rose-500' : 'text-amber-500'
          )}>{dominantLabel}</span>
        </div>

        {/* 3 individual cards */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-emerald-400">{pctPos}%</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/60 mt-1">A Favor</span>
          <span className="text-[10px] text-zinc-600">{(data.positive || 0).toLocaleString()}</span>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-rose-400">{pctNeg}%</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500/60 mt-1">Contra</span>
          <span className="text-[10px] text-zinc-600">{(data.negative || 0).toLocaleString()}</span>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-amber-400">{pctNeu}%</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/60 mt-1">Neutros</span>
          <span className="text-[10px] text-zinc-600">{(data.neutral || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Segments Grid - fills remaining space */}
      <div className="flex-1 grid grid-cols-4 grid-rows-2 gap-3 min-h-0">
        <MiniSegmentBar items={data.segments?.politicalLeaning} title="Posicao Politica" />
        <MiniSegmentBar items={data.segments?.religion} title="Religiao" />
        <MiniSegmentBar items={data.segments?.race} title="Raca / Etnia" />
        <MiniSegmentBar items={data.segments?.generation} title="Geracao" />
        <MiniSegmentBar items={data.segments?.region} title="Regiao" />
        <MiniSegmentBar items={data.segments?.socialClass} title="Classe Social" />
        <MiniSegmentBar items={data.segments?.education} title="Escolaridade" />
        <MiniSegmentBar items={data.segments?.gender} title="Genero" />
      </div>

      {/* Legend */}
      <div className="shrink-0 flex justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-zinc-500 font-medium">Concordam</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-[10px] text-zinc-500 font-medium">Neutros</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="text-[10px] text-zinc-500 font-medium">Discordam</span>
        </div>
      </div>
    </div>
  );
}
