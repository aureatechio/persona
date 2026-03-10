'use client';

import { useState, useMemo, useRef } from 'react';
import {
  Users, Zap, Eye, ChevronDown, ChevronUp, ChevronRight,
  Image, Film, Link, Sparkles, MapPin, GraduationCap,
  Activity, Church, Palette, Briefcase, Vote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnhancedSimulationResult, Sentiment } from '@/lib/arena/types';
import type { QuickAnswerResult } from '@/lib/arena/quick-answer';
import type { AllSegments, SegmentItem } from '@/lib/arena/segments';
import { HeroSentimentBar } from '@/components/arena/HeroSentimentBar';
import { IdeologyPanel } from '@/components/arena/IdeologyPanel';
import { CommentBubble } from '@/components/arena/CommentBubble';
import { PoliticalFigurePanel } from '@/components/arena/PoliticalFigurePanel';

/* ============================================================
   Types
   ============================================================ */

interface MediaItem {
  type: 'image' | 'video' | 'url';
  preview?: string;
  name: string;
}

export interface ArenaLiveData {
  question: string;
  phase: 'streaming' | 'aggregating' | 'complete';
  processedCount: number;
  totalCount: number;
  positive: number;
  negative: number;
  neutral: number;
  simulation: EnhancedSimulationResult | null;
  totalPersonas: number;
  media?: MediaItem[];
  mediaContext?: string;
  error?: string;
  isQuickAnswer?: boolean;
  quickAnswer?: QuickAnswerResult;
  segments?: AllSegments;
}

/* ============================================================
   Progress Bar
   ============================================================ */

function LiveProgressBar({ processed, total, phase }: { processed: number; total: number; phase: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const label = phase === 'aggregating'
    ? 'Agregando resultados...'
    : processed === 0
      ? 'Carregando personas...'
      : 'Avaliando personas...';

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs font-semibold text-zinc-400">{label}</span>
        </div>
        <span className="text-xs font-bold text-violet-400 tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-900/80 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
          style={{
            width: `${Math.max(pct, processed === 0 ? 0 : 2)}%`,
            background: 'linear-gradient(90deg, rgb(139,92,246), rgb(236,72,153), rgb(34,211,238))',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-zinc-600">
          {processed.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} personas
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   Sentiment Summary (compact hero)
   ============================================================ */

function SentimentSummary({ positive, negative, neutral, total }: { positive: number; negative: number; neutral: number; total: number }) {
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      <div className="p-4 rounded-xl bg-zinc-950/80 border border-emerald-500/10 text-center transition-all duration-500">
        <p className="text-3xl font-black text-emerald-400 tabular-nums">{pct(positive)}%</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mt-1">A Favor</p>
        <p className="text-[10px] text-zinc-600 tabular-nums mt-0.5">{positive.toLocaleString('pt-BR')}</p>
      </div>
      <div className="p-4 rounded-xl bg-zinc-950/80 border border-rose-500/10 text-center transition-all duration-500">
        <p className="text-3xl font-black text-rose-400 tabular-nums">{pct(negative)}%</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-rose-400/80 mt-1">Contra</p>
        <p className="text-[10px] text-zinc-600 tabular-nums mt-0.5">{negative.toLocaleString('pt-BR')}</p>
      </div>
      <div className="p-4 rounded-xl bg-zinc-950/80 border border-amber-500/10 text-center transition-all duration-500">
        <p className="text-3xl font-black text-amber-400 tabular-nums">{pct(neutral)}%</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 mt-1">Neutros</p>
        <p className="text-[10px] text-zinc-600 tabular-nums mt-0.5">{neutral.toLocaleString('pt-BR')}</p>
      </div>
    </div>
  );
}

/* ============================================================
   Sidebar Segment Card
   ============================================================ */

function SegmentCard({ item, index, accentColor = 'emerald' }: {
  item: SegmentItem;
  index: number;
  accentColor?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = (n: number) => item.count > 0 ? Math.round((n / item.count) * 100) : 0;
  const pctPos = pct(item.positive);
  const pctNeg = pct(item.negative);
  const pctNeu = pct(item.neutral);

  // Determine dominant sentiment color
  const dominant = pctPos >= pctNeg && pctPos >= pctNeu ? 'emerald'
    : pctNeg >= pctPos && pctNeg >= pctNeu ? 'rose'
    : 'amber';

  return (
    <div
      className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden transition-all duration-300 hover:border-white/[0.12] animate-fade-in-up"
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3.5 hover:bg-white/[0.02] transition-colors duration-200"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-zinc-200 truncate">{item.label}</span>
          <span className="text-[10px] text-zinc-600 tabular-nums shrink-0 ml-2">{item.count.toLocaleString('pt-BR')}</span>
        </div>
        {/* Mini sentiment bar */}
        <div className="h-2 rounded-full overflow-hidden flex bg-zinc-900/80">
          <div className="h-full bg-emerald-500 transition-all duration-[1200ms] ease-out rounded-l-full" style={{ width: `${pctPos}%` }} />
          <div className="h-full bg-amber-500 transition-all duration-[1200ms] ease-out" style={{ width: `${pctNeu}%` }} />
          <div className="h-full bg-rose-500 transition-all duration-[1200ms] ease-out rounded-r-full" style={{ width: `${pctNeg}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-3 text-[10px] font-bold tabular-nums">
            <span className="text-emerald-400">{pctPos}%</span>
            <span className="text-rose-400">{pctNeg}%</span>
          </div>
          <ChevronRight
            size={10}
            className={cn('text-zinc-700 transition-transform duration-200', expanded && 'rotate-90')}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/[0.04] pt-2 animate-fade-in-up">
          <div className="grid grid-cols-3 gap-1.5">
            <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
              <p className="text-sm font-black text-emerald-400 tabular-nums">{pctPos}%</p>
              <p className="text-[8px] text-emerald-400/60 font-bold uppercase">Favor</p>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center">
              <p className="text-sm font-black text-rose-400 tabular-nums">{pctNeg}%</p>
              <p className="text-[8px] text-rose-400/60 font-bold uppercase">Contra</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center">
              <p className="text-sm font-black text-amber-400 tabular-nums">{pctNeu}%</p>
              <p className="text-[8px] text-amber-400/60 font-bold uppercase">Neutro</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Sidebar Segment Group
   ============================================================ */

function SegmentGroupSkeleton({ title, icon, count = 2 }: { title: string; icon: React.ReactNode; count?: number }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 flex-1 text-left">{title}</p>
        <div className="w-4 h-2 bg-zinc-800/50 rounded animate-pulse" />
      </div>
      <div className="space-y-2.5">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3.5 animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="h-3 w-20 bg-zinc-800/40 rounded" />
              <div className="h-2 w-8 bg-zinc-800/30 rounded" />
            </div>
            <div className="h-2 rounded-full bg-zinc-900/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SegmentGroup({
  title,
  icon,
  items,
  startIndex = 0,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  items: SegmentItem[];
  startIndex?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [isTransitioning, setIsTransitioning] = useState(false);

  if (items.length === 0) return null;

  const handleToggle = () => {
    if (!open) {
      setIsTransitioning(true);
      setOpen(true);
      // Clear transition state after animations settle
      setTimeout(() => setIsTransitioning(false), Math.min(items.length * 30, 300) + 200);
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="mb-5">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 mb-2.5 px-1 hover:opacity-80 transition-opacity duration-200 w-full"
      >
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 flex-1 text-left">{title}</p>
        <span className="text-[10px] text-zinc-700 font-bold">{items.length}</span>
        {open ? <ChevronUp size={12} className="text-zinc-700" /> : <ChevronDown size={12} className="text-zinc-700" />}
      </button>

      {open && (
        <div className="space-y-2.5">
          {isTransitioning && (
            <div className="flex items-center gap-2 px-1 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-[9px] text-zinc-600 font-medium">Carregando dados...</span>
            </div>
          )}
          {items.map((item, idx) => (
            <SegmentCard key={item.label} item={item} index={startIndex + idx} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Sidebar Panel (left or right)
   ============================================================ */

function SidebarPanel({
  children,
  side,
}: {
  children: React.ReactNode;
  side: 'left' | 'right';
}) {
  return (
    <div className={cn(
      'w-full lg:w-72 xl:w-80 shrink-0 overflow-y-auto max-h-[70vh] lg:max-h-none',
      'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50',
      side === 'left' ? 'pr-1' : 'pl-1',
    )}>
      {children}
    </div>
  );
}

/* ============================================================
   Media Reference
   ============================================================ */

function cleanMediaContext(raw: string): string {
  let text = raw;
  text = text.replace(/```(?:json|JSON)?\s*/gi, '').replace(/```/g, '');
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (typeof parsed.context === 'string') return parsed.context.replace(/\\n/g, ' ').trim();
    }
  } catch { /* not JSON */ }
  text = text
    .replace(/^\s*\{?\s*"context"\s*:\s*"?/i, '')
    .replace(/"?\s*,?\s*"generated_question"\s*:[\s\S]*$/i, '')
    .replace(/"\s*\}\s*$/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\*\*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text;
}

function MediaReference({ media, mediaContext }: { media?: MediaItem[]; mediaContext?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!media || media.length === 0) return null;

  const cleanedContext = useMemo(() => mediaContext ? cleanMediaContext(mediaContext) : '', [mediaContext]);
  const previewText = cleanedContext.length > 200 ? cleanedContext.slice(0, 200) + '...' : cleanedContext;
  const needsExpand = cleanedContext.length > 200;

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
      <div className="flex gap-2 p-3 pb-0">
        {media.map((item, idx) => {
          const TypeIcon = item.type === 'image' ? Image : item.type === 'video' ? Film : Link;
          return (
            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.06] shrink-0">
              {item.preview && item.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.preview} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <TypeIcon size={20} className="text-zinc-700" />
                </div>
              )}
            </div>
          );
        })}
        <div className="flex flex-col justify-center ml-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Sparkles size={10} className="text-violet-400/60 shrink-0" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Midia analisada</p>
          </div>
          <p className="text-[9px] text-zinc-600 truncate">{media.map(m => m.name).join(', ')}</p>
        </div>
      </div>
      {cleanedContext && (
        <div className="px-3 pt-2 pb-3">
          <p className="text-[11px] text-zinc-400 leading-relaxed">{expanded ? cleanedContext : previewText}</p>
          {needsExpand && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1.5 text-[9px] font-semibold text-violet-400/70 hover:text-violet-400 transition-colors duration-200"
            >
              {expanded ? 'Ver menos' : 'Ver tudo'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Main Component: ArenaLiveBlock (3-column dashboard layout)
   ============================================================ */

export function ArenaLiveBlock({ data }: { data: ArenaLiveData }) {
  const {
    question, phase, processedCount, totalCount,
    positive, negative, neutral,
    simulation, totalPersonas, media, mediaContext,
    isQuickAnswer, quickAnswer, segments,
  } = data;
  const [showComments, setShowComments] = useState(true);
  const [commentsToShow, setCommentsToShow] = useState(30);
  const [commentFilter, setCommentFilter] = useState<'all' | Sentiment>('all');
  const blockRef = useRef<HTMLDivElement>(null);

  const isStreaming = phase === 'streaming' || phase === 'aggregating';
  const isComplete = phase === 'complete';

  const finalPositive = isComplete ? (quickAnswer?.positive ?? simulation?.positive ?? positive) : positive;
  const finalNegative = isComplete ? (quickAnswer?.negative ?? simulation?.negative ?? negative) : negative;
  const finalNeutral = isComplete ? (quickAnswer?.neutral ?? simulation?.neutral ?? neutral) : neutral;
  const finalTotal = isComplete ? (quickAnswer?.total ?? simulation?.total ?? totalCount) : totalCount;

  // Segment data — prefer explicit segments, fall back to simulation data
  const hasSegments = !!segments && Object.values(segments).some(arr => arr.length > 0);

  // Comments
  const comments = simulation?.comments ?? [];
  const filteredComments = commentFilter === 'all'
    ? comments
    : comments.filter(c => c.sentiment === commentFilter);
  const visibleComments = filteredComments.slice(0, commentsToShow);

  // Error state
  if (data.error && !simulation && !quickAnswer) {
    return (
      <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-6 text-center">
        <p className="text-sm text-red-400">{data.error}</p>
        <p className="text-xs text-zinc-600 mt-2">&ldquo;{question}&rdquo;</p>
      </div>
    );
  }

  return (
    <div ref={blockRef} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-600">
            Arena {isQuickAnswer ? '• Resposta Direta' : '• Analise'}
          </p>
          {isQuickAnswer && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
              <Zap size={9} /> Instantaneo
            </span>
          )}
          {isStreaming && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-400 animate-pulse">
              <Activity size={9} /> Ao vivo
            </span>
          )}
        </div>
        <p className="text-base font-semibold text-white leading-relaxed">&ldquo;{question}&rdquo;</p>
        {isComplete && (
          <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Users size={10} /> {(totalPersonas || finalTotal).toLocaleString('pt-BR')} personas
            </span>
            {(quickAnswer?.processingTimeMs || simulation?.processingTime) && (
              <span className="flex items-center gap-1">
                <Zap size={10} /> {(quickAnswer?.processingTimeMs ?? simulation?.processingTime ?? 0).toFixed(0)}ms
              </span>
            )}
            <span className="text-emerald-400 font-bold">
              {finalTotal > 0 ? Math.round((finalPositive / finalTotal) * 100) : 0}% a favor
            </span>
          </div>
        )}
      </div>

      {/* 3-Column Dashboard Layout */}
      <div className="flex flex-col lg:flex-row">
        {/* ─── LEFT SIDEBAR: Identity segments ─── */}
        <div className="lg:border-r border-white/[0.04] p-5 lg:p-6 lg:w-72 xl:w-80 shrink-0 order-2 lg:order-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-4">Identidade</p>

          {hasSegments ? (
            <>
              <SegmentGroup
                title="Genero"
                icon={<Users size={11} className="text-violet-400/70" />}
                items={segments!.gender}
                startIndex={0}
                defaultOpen={true}
              />

              <SegmentGroup
                title="Religiao"
                icon={<Church size={11} className="text-amber-400/70" />}
                items={segments!.religion}
                startIndex={10}
              />

              <SegmentGroup
                title="Raca/Etnia"
                icon={<Palette size={11} className="text-cyan-400/70" />}
                items={segments!.race}
                startIndex={20}
              />

              <SegmentGroup
                title="Posicao Politica"
                icon={<Vote size={11} className="text-rose-400/70" />}
                items={segments!.politicalLeaning}
                startIndex={30}
              />
            </>
          ) : (
            <>
              <SegmentGroupSkeleton title="Genero" icon={<Users size={11} className="text-violet-400/70" />} count={2} />
              <SegmentGroupSkeleton title="Religiao" icon={<Church size={11} className="text-amber-400/70" />} count={3} />
              <SegmentGroupSkeleton title="Raca/Etnia" icon={<Palette size={11} className="text-cyan-400/70" />} count={3} />
              <SegmentGroupSkeleton title="Posicao Politica" icon={<Vote size={11} className="text-rose-400/70" />} count={3} />
            </>
          )}
        </div>

        {/* ─── CENTER: Main results ─── */}
        <div className="flex-1 min-w-0 p-5 lg:p-8 order-1 lg:order-2">
          {/* Progress bar (during streaming) */}
          {isStreaming && (
            <LiveProgressBar processed={processedCount} total={totalCount} phase={phase} />
          )}

          {/* Hero Sentiment Bar */}
          {(finalTotal > 0) && (
            <div className="mb-6">
              <HeroSentimentBar
                positive={finalPositive}
                negative={finalNegative}
                neutral={finalNeutral}
                total={finalTotal}
              />
            </div>
          )}

          {/* Stat cards */}
          <SentimentSummary
            positive={finalPositive}
            negative={finalNegative}
            neutral={finalNeutral}
            total={finalTotal}
          />

          {/* Media Reference */}
          <MediaReference media={media} mediaContext={mediaContext} />

          {/* Ideology Panel (full results only) */}
          {simulation && (simulation.quadrants.length > 0 || simulation.clusterResults.length > 0) && (
            <div className="mt-4 animate-fade-in-up">
              <IdeologyPanel
                quadrants={simulation.quadrants}
                clusterResults={simulation.clusterResults}
                total={simulation.total}
              />
            </div>
          )}

          {/* Political Figures */}
          {simulation && simulation.politicalFigures.length > 0 && (
            <div className="mt-4 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <PoliticalFigurePanel figures={simulation.politicalFigures} />
            </div>
          )}

          {/* Comments */}
          {comments.length > 0 && (
            <div className="mt-5 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-800/50 to-transparent mb-4" />

              <button
                onClick={() => setShowComments(!showComments)}
                className="flex items-center gap-2 mb-3 px-1 hover:opacity-80 transition-opacity duration-200"
              >
                <Eye size={14} className="text-zinc-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Reacoes</p>
                <span className="text-[10px] text-zinc-600 font-bold ml-1">{comments.length.toLocaleString('pt-BR')}</span>
                {showComments ? <ChevronUp size={12} className="text-zinc-600" /> : <ChevronDown size={12} className="text-zinc-600" />}
              </button>

              {showComments && (
                <>
                  <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                    {([
                      { key: 'all' as const, label: 'Todos', active: 'bg-white/10 text-white border-white/20' },
                      { key: 'positive' as const, label: 'A Favor', active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                      { key: 'neutral' as const, label: 'Neutros', active: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                      { key: 'negative' as const, label: 'Contra', active: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                    ]).map(({ key, label, active }) => {
                      const count = key === 'all' ? comments.length : comments.filter(c => c.sentiment === key).length;
                      return (
                        <button
                          key={key}
                          onClick={() => { setCommentFilter(key); setCommentsToShow(30); }}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200',
                            commentFilter === key ? active : 'text-zinc-500 border-zinc-800/50 hover:text-zinc-300 hover:border-zinc-700/50',
                          )}
                        >
                          {label} ({count.toLocaleString('pt-BR')})
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visibleComments.map((comment, idx) => (
                      <CommentBubble key={`comment-${commentFilter}-${idx}`} comment={comment} index={idx} />
                    ))}
                  </div>

                  {filteredComments.length > commentsToShow && (
                    <div className="text-center mt-5">
                      <button
                        onClick={() => setCommentsToShow(prev => prev + 30)}
                        className="px-6 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/50 text-sm font-bold text-zinc-400 hover:text-white hover:border-zinc-700/50 transition-all duration-200"
                      >
                        Carregar mais {Math.min(30, filteredComments.length - commentsToShow)}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── RIGHT SIDEBAR: Socioeconomic segments ─── */}
        <div className="lg:border-l border-white/[0.04] p-5 lg:p-6 lg:w-72 xl:w-80 shrink-0 order-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-4">Socioeconomico</p>

          {hasSegments ? (
            <>
              <SegmentGroup
                title="Regiao"
                icon={<MapPin size={11} className="text-cyan-400/70" />}
                items={segments!.region}
                startIndex={40}
                defaultOpen={true}
              />

              <SegmentGroup
                title="Geracao"
                icon={<Users size={11} className="text-amber-400/70" />}
                items={segments!.generation}
                startIndex={50}
              />

              <SegmentGroup
                title="Classe Social"
                icon={<Briefcase size={11} className="text-violet-400/70" />}
                items={segments!.socialClass}
                startIndex={60}
              />

              <SegmentGroup
                title="Escolaridade"
                icon={<GraduationCap size={11} className="text-emerald-400/70" />}
                items={segments!.education}
                startIndex={70}
              />
            </>
          ) : (
            <>
              <SegmentGroupSkeleton title="Regiao" icon={<MapPin size={11} className="text-cyan-400/70" />} count={5} />
              <SegmentGroupSkeleton title="Geracao" icon={<Users size={11} className="text-amber-400/70" />} count={4} />
              <SegmentGroupSkeleton title="Classe Social" icon={<Briefcase size={11} className="text-violet-400/70" />} count={3} />
              <SegmentGroupSkeleton title="Escolaridade" icon={<GraduationCap size={11} className="text-emerald-400/70" />} count={3} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
