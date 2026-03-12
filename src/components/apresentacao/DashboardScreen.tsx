'use client';

import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';
import { Users, BarChart3, MessageCircle, Sparkles } from 'lucide-react';
import type { SegmentItem } from '@/lib/arena/segments';
import type { CommentResult } from '@/lib/arena/types';

/* ─── Mini Segment Bar (compact) ────────────────────────────────────── */

function MiniSegmentBar({ items, title }: { items: SegmentItem[] | undefined; title: string }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 flex flex-col gap-1.5 min-w-0 overflow-hidden">
      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 truncate">{title}</span>
      {items.slice(0, 5).map((item) => {
        const total = item.positive + item.negative + item.neutral;
        const pPos = total > 0 ? (item.positive / total) * 100 : 0;
        const pNeu = total > 0 ? (item.neutral / total) * 100 : 0;
        const pNeg = total > 0 ? (item.negative / total) * 100 : 0;
        return (
          <div key={item.label} className="flex flex-col gap-px">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 truncate flex-1 mr-1">{item.label}</span>
              <span className="text-[9px] font-bold text-emerald-400 shrink-0">{pPos.toFixed(0)}%</span>
              <span className="text-[9px] font-bold text-rose-400 shrink-0 ml-1">{pNeg.toFixed(0)}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden flex bg-zinc-800/50">
              <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${pPos}%` }} />
              <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${pNeu}%` }} />
              <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${pNeg}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Comment Bubble (compact) ──────────────────────────────────────── */

function MiniComment({ comment }: { comment: CommentResult }) {
  const sentColor = comment.sentiment === 'positive' ? 'emerald' : comment.sentiment === 'negative' ? 'rose' : 'amber';
  return (
    <div className={cn(
      'bg-white/[0.02] border rounded-xl p-2.5 flex flex-col gap-1',
      `border-${sentColor}-500/15`
    )}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-zinc-300 truncate">{comment.personaName}</span>
        {comment.age && <span className="text-[9px] text-zinc-600">{comment.age}a</span>}
        {comment.location && <span className="text-[9px] text-zinc-600">{comment.location}</span>}
        <span className={cn(
          'ml-auto text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0',
          comment.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
          comment.sentiment === 'negative' ? 'bg-rose-500/10 text-rose-400' :
          'bg-amber-500/10 text-amber-400'
        )}>
          {comment.sentiment === 'positive' ? 'Favor' : comment.sentiment === 'negative' ? 'Contra' : 'Neutro'}
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">{comment.comment}</p>
    </div>
  );
}

/* ─── Animated Waiting ──────────────────────────────────────────────── */

function DashWaiting() {
  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      <div className="absolute w-[500px] h-[500px] bg-sky-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'dFloat1 8s ease-in-out infinite' }} />
      <div className="absolute w-[400px] h-[400px] bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'dFloat2 10s ease-in-out infinite' }} />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative w-28 h-28">
          <div className="absolute inset-0 rounded-full border-2 border-sky-500/20" style={{ animation: 'spin 6s linear infinite' }} />
          <div className="absolute inset-4 rounded-full border border-dashed border-emerald-500/15" style={{ animation: 'spin 8s linear infinite reverse' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <BarChart3 size={36} className="text-sky-400/50 animate-pulse" />
          </div>
        </div>
        <p className="text-lg text-zinc-500">Aguardando dados...</p>
        <div className="flex gap-2">
          {[0, 200, 400].map(d => <div key={d} className="w-2 h-2 bg-sky-400/50 rounded-full" style={{ animation: `dBounce 1.4s ease-in-out ${d}ms infinite` }} />)}
        </div>
      </div>
      <style>{`
        @keyframes dFloat1 { 0%,100% { transform: translate(-80px,-40px); } 50% { transform: translate(80px,40px); } }
        @keyframes dFloat2 { 0%,100% { transform: translate(60px,50px); } 50% { transform: translate(-100px,-30px); } }
        @keyframes dBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>
    </div>
  );
}

/* ─── Main Dashboard Screen ─────────────────────────────────────────── */

export function DashboardScreen() {
  const data = usePresentationData();

  if (!data) return <DashWaiting />;

  const total = (data.positive || 0) + (data.negative || 0) + (data.neutral || 0);
  const pctPos = total > 0 ? Math.round((data.positive / total) * 100) : 0;
  const pctNeg = total > 0 ? Math.round((data.negative / total) * 100) : 0;
  const pctNeu = total > 0 ? Math.round((data.neutral / total) * 100) : 0;

  const dominant = pctPos >= pctNeg && pctPos >= pctNeu ? 'positive'
    : pctNeg >= pctPos && pctNeg >= pctNeu ? 'negative' : 'neutral';
  const dominantPct = dominant === 'positive' ? pctPos : dominant === 'negative' ? pctNeg : pctNeu;
  const dominantLabel = dominant === 'positive' ? 'A Favor' : dominant === 'negative' ? 'Contra' : 'Neutros';

  // Comments from simulation or live
  const comments = (data.simulation?.comments?.length ?? 0) > 0
    ? data.simulation!.comments
    : data.liveComments ?? [];

  return (
    <div className="h-screen w-screen bg-black overflow-hidden flex flex-col p-4 gap-3">
      {/* Top: Question + status */}
      <div className="shrink-0 flex items-center gap-3">
        <div className="flex-1 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl px-4 py-2.5">
          <p className="text-sm text-zinc-300 font-medium truncate">{data.question}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl shrink-0">
          {data.phase !== 'complete' && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
          <span className="text-[11px] text-zinc-400 font-medium">
            {data.phase === 'complete' ? `${total.toLocaleString()} personas` : `${Math.round((data.processedCount / data.totalCount) * 100)}%`}
          </span>
        </div>
      </div>

      {/* Hero bar + dominance — compact row */}
      <div className="shrink-0 flex gap-3">
        {/* Hero sentiment bar */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-12 rounded-xl overflow-hidden flex bg-zinc-900/80 border border-white/[0.06]">
            <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 flex items-center justify-center transition-all duration-[2500ms]"
              style={{ width: `${pctPos}%` }}>
              {pctPos > 8 && <span className="text-xs font-black text-white">{pctPos}%</span>}
            </div>
            <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 flex items-center justify-center transition-all duration-[2500ms]"
              style={{ width: `${pctNeu}%` }}>
              {pctNeu > 8 && <span className="text-xs font-black text-white">{pctNeu}%</span>}
            </div>
            <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 flex items-center justify-center transition-all duration-[2500ms]"
              style={{ width: `${pctNeg}%` }}>
              {pctNeg > 8 && <span className="text-xs font-black text-white">{pctNeg}%</span>}
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-zinc-500 px-1">
            <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Concordam</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Neutros</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" />Discordam</span>
          </div>
        </div>

        {/* Dominance card */}
        <div className={cn(
          'w-36 bg-white/[0.04] border rounded-xl p-3 flex flex-col items-center justify-center shrink-0',
          dominant === 'positive' ? 'border-emerald-500/30' : dominant === 'negative' ? 'border-rose-500/30' : 'border-amber-500/30'
        )}>
          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Dominante</span>
          <span className={cn('text-3xl font-black tracking-tight',
            dominant === 'positive' ? 'text-emerald-400' : dominant === 'negative' ? 'text-rose-400' : 'text-amber-400'
          )}>{dominantPct}%</span>
          <span className={cn('text-[10px] font-semibold',
            dominant === 'positive' ? 'text-emerald-500' : dominant === 'negative' ? 'text-rose-500' : 'text-amber-500'
          )}>{dominantLabel}</span>
        </div>

        {/* 3 stat cards */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="bg-white/[0.03] border border-emerald-500/15 rounded-xl px-4 py-1.5 text-center">
            <span className="text-xl font-black text-emerald-400">{pctPos}%</span>
            <span className="text-[9px] text-emerald-500/60 ml-1.5">Favor</span>
          </div>
          <div className="bg-white/[0.03] border border-rose-500/15 rounded-xl px-4 py-1.5 text-center">
            <span className="text-xl font-black text-rose-400">{pctNeg}%</span>
            <span className="text-[9px] text-rose-500/60 ml-1.5">Contra</span>
          </div>
          <div className="bg-white/[0.03] border border-amber-500/15 rounded-xl px-4 py-1.5 text-center">
            <span className="text-xl font-black text-amber-400">{pctNeu}%</span>
            <span className="text-[9px] text-amber-500/60 ml-1.5">Neutros</span>
          </div>
        </div>
      </div>

      {/* Main grid: Segments (left 3 cols) + Comments (right col) */}
      <div className="flex-1 grid grid-cols-5 gap-3 min-h-0">
        {/* Segments — 4 cols, 2 rows */}
        <div className="col-span-4 grid grid-cols-4 grid-rows-2 gap-2 min-h-0">
          <MiniSegmentBar items={data.segments?.politicalLeaning} title="Pos. Politica" />
          <MiniSegmentBar items={data.segments?.religion} title="Religiao" />
          <MiniSegmentBar items={data.segments?.race} title="Raca / Etnia" />
          <MiniSegmentBar items={data.segments?.generation} title="Geracao" />
          <MiniSegmentBar items={data.segments?.region} title="Regiao" />
          <MiniSegmentBar items={data.segments?.socialClass} title="Classe Social" />
          <MiniSegmentBar items={data.segments?.education} title="Escolaridade" />
          <MiniSegmentBar items={data.segments?.gender} title="Genero" />
        </div>

        {/* Comments column */}
        <div className="col-span-1 flex flex-col gap-2 min-h-0 overflow-hidden">
          <div className="flex items-center gap-1.5 px-1">
            <MessageCircle size={11} className="text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Reacoes ({comments.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {comments.length > 0 ? (
              comments.slice(0, 20).map((c, i) => <MiniComment key={i} comment={c} />)
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle size={20} className="text-zinc-700 mb-2" />
                <p className="text-[10px] text-zinc-600">Gerando comentarios...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
