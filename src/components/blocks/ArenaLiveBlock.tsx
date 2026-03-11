'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users, Zap, Eye, ChevronDown, ChevronUp, ChevronRight,
  Image, Film, Link, Sparkles, MapPin, GraduationCap,
  Activity, Church, Palette, Briefcase, Vote, FileText, X, Play,
  BarChart3, MessageCircle, TrendingUp, Search, Globe, Brain, UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnhancedSimulationResult, Sentiment, QuadrantResult, ClusterResult, PoliticalFigureDetection, CommentResult } from '@/lib/arena/types';
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
  phase: 'collecting' | 'streaming' | 'aggregating' | 'complete';
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
  liveIdeology?: {
    quadrants: QuadrantResult[];
    clusterResults: ClusterResult[];
    politicalFigures: PoliticalFigureDetection[];
  };
  liveComments?: CommentResult[];
  /** Status message during collecting phase */
  collectingStatus?: string;
}

/* ============================================================
   Tab type
   ============================================================ */

type TabKey = 'principal' | 'segmentos' | 'ideologia' | 'reacoes';

/* ============================================================
   Collecting Phase (pre-processing)
   ============================================================ */

const COLLECTING_STEPS = [
  { key: 'analyzing', label: 'Analisando pergunta', icon: Search, color: 'violet' },
  { key: 'researching', label: 'Pesquisando na web', icon: Globe, color: 'sky' },
  { key: 'context', label: 'Construindo contexto', icon: Brain, color: 'amber' },
  { key: 'loading', label: 'Carregando personas', icon: UserCheck, color: 'emerald' },
] as const;

function CollectingPhase({ status }: { status?: string }) {
  const activeIndex = COLLECTING_STEPS.findIndex(s => status?.includes(s.key));
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const colorMap = {
    violet: { active: 'bg-violet-500/10 border-violet-500/25 shadow-lg shadow-violet-500/10', icon: 'text-violet-400', text: 'text-violet-300', glow: 'bg-violet-400' },
    sky: { active: 'bg-sky-500/10 border-sky-500/25 shadow-lg shadow-sky-500/10', icon: 'text-sky-400', text: 'text-sky-300', glow: 'bg-sky-400' },
    amber: { active: 'bg-amber-500/10 border-amber-500/25 shadow-lg shadow-amber-500/10', icon: 'text-amber-400', text: 'text-amber-300', glow: 'bg-amber-400' },
    emerald: { active: 'bg-emerald-500/10 border-emerald-500/25 shadow-lg shadow-emerald-500/10', icon: 'text-emerald-400', text: 'text-emerald-300', glow: 'bg-emerald-400' },
  };

  return (
    <div className="relative px-4 py-6 md:px-6 md:py-8 flex flex-col items-center justify-center gap-4 md:gap-5 overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute -top-16 -right-16 w-40 h-40 bg-violet-500/[0.07] rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-emerald-500/[0.05] rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Central icon with rotating ring */}
      <div className="relative">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-emerald-500/10 border border-violet-500/20 flex items-center justify-center backdrop-blur-xl shadow-lg shadow-violet-500/10">
          <Activity size={24} className="text-violet-400 md:w-7 md:h-7" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
        </div>
        <div className="absolute inset-[-6px] rounded-2xl border border-violet-500/20" style={{ animation: 'spin 8s linear infinite' }} />
        <div className="absolute inset-[-11px] rounded-3xl border border-dashed border-violet-500/10" style={{ animation: 'spin 12s linear infinite reverse' }} />
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-violet-500 rounded-full ring-2 ring-black" style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
      </div>

      {/* Title and subtitle */}
      <div className="text-center space-y-1">
        <p className="text-sm md:text-base font-semibold text-white tracking-tight">
          Coletando dados{dots}
        </p>
        <p className="text-[11px] text-zinc-500">
          Preparando analise com IA
        </p>
      </div>

      {/* Steps — grid 2x2 on mobile, vertical on md+ */}
      <div className="w-full max-w-md grid grid-cols-2 md:grid-cols-1 md:max-w-sm gap-2">
        {COLLECTING_STEPS.map((step, i) => {
          const isActive = i === activeIndex;
          const isDone = i < activeIndex;
          const isPending = i > activeIndex && activeIndex >= 0;
          const StepIcon = step.icon;
          const colors = colorMap[step.color];

          return (
            <div
              key={step.key}
              className={cn(
                'flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-2.5 rounded-xl border transition-all duration-700 ease-out',
                isActive
                  ? colors.active
                  : isDone
                    ? 'bg-emerald-500/[0.06] border-emerald-500/15'
                    : 'bg-white/[0.02] border-white/[0.04] opacity-50',
                isActive && 'scale-[1.02]',
              )}
              style={isActive ? { animation: 'fadeIn 0.5s ease-out' } : undefined}
            >
              <div className={cn(
                'w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-500',
                isActive
                  ? `bg-${step.color}-500/20`
                  : isDone
                    ? 'bg-emerald-500/15'
                    : 'bg-white/[0.03]',
              )}>
                {isDone ? (
                  <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" style={{ strokeDasharray: 24, strokeDashoffset: 0, animation: 'checkDraw 0.4s ease-out' }} />
                  </svg>
                ) : (
                  <StepIcon size={13} className={cn(
                    'md:w-4 md:h-4 transition-colors duration-500',
                    isActive ? colors.icon : 'text-zinc-600',
                    isActive && 'animate-pulse',
                  )} />
                )}
              </div>
              <span className={cn(
                'text-[11px] md:text-xs font-medium transition-all duration-500 truncate',
                isActive ? colors.text : isDone ? 'text-emerald-400/80' : isPending ? 'text-zinc-600' : 'text-zinc-500',
              )}>
                {step.label}
              </span>
              {isActive && (
                <div className="ml-auto flex items-center gap-0.5 shrink-0">
                  {[0, 150, 300].map(delay => (
                    <span key={delay} className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }}>
                      <span className={cn('block w-full h-full rounded-full', colors.glow)} />
                    </span>
                  ))}
                </div>
              )}
              {isDone && (
                <span className="ml-auto text-[9px] md:text-[10px] text-emerald-400 font-medium shrink-0">✓</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Animated progress line */}
      <div className="w-full max-w-md md:max-w-sm">
        <div className="h-0.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 via-sky-500 to-emerald-500 rounded-full"
            style={{
              width: `${Math.max(5, ((activeIndex + 1) / COLLECTING_STEPS.length) * 100)}%`,
              transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
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
   Sentiment Summary
   ============================================================ */

function SentimentSummary({ positive, negative, neutral, total }: { positive: number; negative: number; neutral: number; total: number }) {
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-3">
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

function SegmentCard({ item, index }: { item: SegmentItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const pct = (n: number) => item.count > 0 ? Math.round((n / item.count) * 100) : 0;
  const pctPos = pct(item.positive);
  const pctNeg = pct(item.negative);
  const pctNeu = pct(item.neutral);

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
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  items: SegmentItem[];
  startIndex?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-2.5 px-1 hover:opacity-80 transition-opacity duration-200 w-full"
      >
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 flex-1 text-left">{title}</p>
        <span className="text-[10px] text-zinc-700 font-bold">{items.length}</span>
        {open ? <ChevronUp size={12} className="text-zinc-700" /> : <ChevronDown size={12} className="text-zinc-700" />}
      </button>

      {open && (
        <div className="space-y-2.5">
          {items.map((item, idx) => (
            <SegmentCard key={item.label} item={item} index={startIndex + idx} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Media helpers
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

function MediaHeaderInline({ media }: { media?: MediaItem[] }) {
  if (!media || media.length === 0) return null;

  const primaryMedia = media[0];
  const isVideo = primaryMedia.type === 'video';
  const isImage = primaryMedia.type === 'image';
  const isUrl = primaryMedia.type === 'url';
  const typeLabel = isImage ? 'Imagem' : isVideo ? 'Video' : 'Link';

  const cleanName = primaryMedia.name.replace(/-\d{10,}/, '').replace(/\.[^.]+$/, '');
  const ext = isUrl ? 'URL' : (primaryMedia.name.split('.').pop()?.toUpperCase() || '');

  return (
    <div className="shrink-0 flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
      <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
        {primaryMedia.preview ? (
          <div className="relative w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={primaryMedia.preview} alt={primaryMedia.name} className="w-full h-full object-cover rounded-lg" />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <Play size={10} className="text-white ml-0.5" />
              </div>
            )}
          </div>
        ) : isUrl ? (
          <div className="w-full h-full flex items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20">
            <Link size={16} className="text-sky-400" />
          </div>
        ) : isVideo ? (
          <div className="w-full h-full flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 border border-violet-500/20">
            <Film size={16} className="text-violet-400" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Image size={16} className="text-emerald-400" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-zinc-200 truncate max-w-[120px]">{cleanName || primaryMedia.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">{ext} • {typeLabel}</span>
          {media.length > 1 && <span className="text-[9px] text-zinc-600">+{media.length - 1}</span>}
        </div>
      </div>
    </div>
  );
}

function MediaSummaryPanel({ cleanedContext, open, onClose }: { cleanedContext: string; open: boolean; onClose: () => void }) {
  if (!open || !cleanedContext) return null;

  const paragraphs = cleanedContext.split(/\n{2,}|\. (?=[A-Z])/).map(p => p.trim()).filter(p => p.length > 0);
  const formattedBlocks = paragraphs.length <= 1
    ? cleanedContext.split(/(?<=\.)\s+/).reduce<string[]>((acc, sentence, i) => {
        const blockIdx = Math.floor(i / 3);
        acc[blockIdx] = (acc[blockIdx] || '') + (acc[blockIdx] ? ' ' : '') + sentence;
        return acc;
      }, [])
    : paragraphs;

  return (
    <div className="mt-4 rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <FileText size={12} className="text-violet-400" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-200">Resumo do Conteudo</p>
            <p className="text-[9px] text-zinc-600">Extraido por IA a partir da midia enviada</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-all duration-200">
          <X size={12} />
        </button>
      </div>
      <div className="px-5 py-4 space-y-3 max-h-40 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
        {formattedBlocks.map((block, idx) => (
          <p key={idx} className="text-[12px] text-zinc-300 leading-[1.7]">{block}</p>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Tab Bar
   ============================================================ */

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  available: boolean;
}

function TabBar({ tabs, active, onChange }: { tabs: TabDef[]; active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <div className="flex items-center gap-1 px-5 py-2 border-b border-white/[0.04] overflow-x-auto scrollbar-none">
      {tabs.filter(t => t.available).map(tab => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 shrink-0 active:scale-[0.97]',
              isActive
                ? 'bg-white/[0.08] border-white/[0.15] text-white shadow-lg shadow-black/20'
                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span className={cn(
                'ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold',
                isActive ? 'bg-white/[0.1] text-zinc-300' : 'bg-white/[0.04] text-zinc-600',
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Tab: Principal
   ============================================================ */

function TabPrincipal({
  isStreaming, phase, processedCount, totalCount,
  finalPositive, finalNegative, finalNeutral, finalTotal,
}: {
  isStreaming: boolean;
  phase: string;
  processedCount: number;
  totalCount: number;
  finalPositive: number;
  finalNegative: number;
  finalNeutral: number;
  finalTotal: number;
}) {
  return (
    <div className="p-5 lg:p-8">
      {isStreaming && (
        <LiveProgressBar processed={processedCount} total={totalCount} phase={phase} />
      )}

      {finalTotal > 0 && (
        <div className="mb-6">
          <HeroSentimentBar
            positive={finalPositive}
            negative={finalNegative}
            neutral={finalNeutral}
            total={finalTotal}
          />
        </div>
      )}

      <SentimentSummary
        positive={finalPositive}
        negative={finalNegative}
        neutral={finalNeutral}
        total={finalTotal}
      />
    </div>
  );
}

/* ============================================================
   Tab: Segmentos (3-col layout with sidebars)
   ============================================================ */

function TabSegmentos({ segments, hasSegments }: { segments?: AllSegments; hasSegments: boolean }) {
  return (
    <div className="flex flex-col lg:flex-row">
      {/* LEFT: Identidade */}
      <div className="lg:border-r border-white/[0.04] p-5 lg:p-6 lg:w-1/2 shrink-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-4">Identidade</p>
        {hasSegments ? (
          <>
            <SegmentGroup title="Genero" icon={<Users size={11} className="text-violet-400/70" />} items={segments!.gender} startIndex={0} defaultOpen={true} />
            <SegmentGroup title="Religiao" icon={<Church size={11} className="text-amber-400/70" />} items={segments!.religion} startIndex={10} defaultOpen={false} />
            <SegmentGroup title="Raca/Etnia" icon={<Palette size={11} className="text-cyan-400/70" />} items={segments!.race} startIndex={20} defaultOpen={false} />
            <SegmentGroup title="Posicao Politica" icon={<Vote size={11} className="text-rose-400/70" />} items={segments!.politicalLeaning} startIndex={30} defaultOpen={false} />
          </>
        ) : (
          <>
            <SegmentGroupSkeleton title="Genero" icon={<Users size={11} className="text-violet-400/70" />} count={2} />
            <SegmentGroupSkeleton title="Religiao" icon={<Church size={11} className="text-amber-400/70" />} count={3} />
            <SegmentGroupSkeleton title="Raca/Etnia" icon={<Palette size={11} className="text-cyan-400/70" />} count={3} />
          </>
        )}
      </div>

      {/* RIGHT: Socioeconomico */}
      <div className="lg:border-l border-white/[0.04] p-5 lg:p-6 lg:w-1/2 shrink-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-4">Socioeconomico</p>
        {hasSegments ? (
          <>
            <SegmentGroup title="Regiao" icon={<MapPin size={11} className="text-cyan-400/70" />} items={segments!.region} startIndex={40} defaultOpen={true} />
            <SegmentGroup title="Geracao" icon={<Users size={11} className="text-amber-400/70" />} items={segments!.generation} startIndex={50} defaultOpen={false} />
            <SegmentGroup title="Classe Social" icon={<Briefcase size={11} className="text-violet-400/70" />} items={segments!.socialClass} startIndex={60} defaultOpen={false} />
            <SegmentGroup title="Escolaridade" icon={<GraduationCap size={11} className="text-emerald-400/70" />} items={segments!.education} startIndex={70} defaultOpen={false} />
          </>
        ) : (
          <>
            <SegmentGroupSkeleton title="Regiao" icon={<MapPin size={11} className="text-cyan-400/70" />} count={5} />
            <SegmentGroupSkeleton title="Geracao" icon={<Users size={11} className="text-amber-400/70" />} count={4} />
            <SegmentGroupSkeleton title="Classe Social" icon={<Briefcase size={11} className="text-violet-400/70" />} count={3} />
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Tab: Ideologia
   ============================================================ */

function TabIdeologia({
  quadrants, clusters, total, figures,
}: {
  quadrants: QuadrantResult[];
  clusters: ClusterResult[];
  total: number;
  figures: PoliticalFigureDetection[];
}) {
  return (
    <div className="p-5 lg:p-8 space-y-6">
      {(quadrants.length > 0 || clusters.length > 0) && (
        <IdeologyPanel quadrants={quadrants} clusterResults={clusters} total={total} />
      )}
      {figures.length > 0 && (
        <PoliticalFigurePanel figures={figures} />
      )}
      {quadrants.length === 0 && clusters.length === 0 && figures.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
            <Sparkles size={28} className="text-zinc-600" />
          </div>
          <p className="text-zinc-500 text-sm">Dados ideologicos ainda nao disponiveis</p>
          <p className="text-zinc-600 text-xs mt-1">Aguarde a conclusao da analise</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Tab: Reacoes (Comments)
   ============================================================ */

function TabReacoes({
  comments,
  commentFilter,
  setCommentFilter,
  commentsToShow,
  setCommentsToShow,
}: {
  comments: CommentResult[];
  commentFilter: 'all' | Sentiment;
  setCommentFilter: (f: 'all' | Sentiment) => void;
  commentsToShow: number;
  setCommentsToShow: (fn: (prev: number) => number) => void;
}) {
  const filteredComments = commentFilter === 'all'
    ? comments
    : comments.filter(c => c.sentiment === commentFilter);
  const visibleComments = filteredComments.slice(0, commentsToShow);

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <MessageCircle size={28} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Reacoes ainda nao disponiveis</p>
        <p className="text-zinc-600 text-xs mt-1">As personas estao sendo avaliadas</p>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8">
      {/* Filter chips */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
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
              onClick={() => { setCommentFilter(key); setCommentsToShow(() => 10); }}
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

      {/* Comments grid */}
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
    </div>
  );
}

/* ============================================================
   Main Component: ArenaLiveBlock — Tab layout
   ============================================================ */

export function ArenaLiveBlock({ data }: { data: ArenaLiveData }) {
  const {
    question, phase, processedCount, totalCount,
    positive, negative, neutral,
    simulation, totalPersonas, media, mediaContext,
    isQuickAnswer, quickAnswer, segments, liveIdeology, liveComments,
  } = data;

  const [activeTab, setActiveTab] = useState<TabKey>('principal');
  const [commentsToShow, setCommentsToShow] = useState(10);
  const [commentFilter, setCommentFilter] = useState<'all' | Sentiment>('all');
  const [showMediaSummary, setShowMediaSummary] = useState(false);
  const cleanedMediaContext = useMemo(() => mediaContext ? cleanMediaContext(mediaContext) : '', [mediaContext]);
  const hasMediaContext = cleanedMediaContext.length > 0;
  const blockRef = useRef<HTMLDivElement>(null);

  const isCollecting = phase === 'collecting';
  const isStreaming = phase === 'streaming' || phase === 'aggregating';
  const isComplete = phase === 'complete';

  const finalPositive = isComplete ? (quickAnswer?.positive ?? simulation?.positive ?? positive) : positive;
  const finalNegative = isComplete ? (quickAnswer?.negative ?? simulation?.negative ?? negative) : negative;
  const finalNeutral = isComplete ? (quickAnswer?.neutral ?? simulation?.neutral ?? neutral) : neutral;
  const finalTotal = isComplete ? (quickAnswer?.total ?? simulation?.total ?? totalCount) : totalCount;

  const hasSegments = !!segments && Object.values(segments).some(arr => arr.length > 0);

  const comments = (simulation?.comments?.length ?? 0) > 0
    ? simulation!.comments
    : liveComments ?? [];

  const quadrants = simulation?.quadrants ?? liveIdeology?.quadrants ?? [];
  const clusters = simulation?.clusterResults ?? liveIdeology?.clusterResults ?? [];
  const figures = simulation?.politicalFigures ?? liveIdeology?.politicalFigures ?? [];
  const hasIdeology = quadrants.length > 0 || clusters.length > 0 || figures.length > 0;

  // Tab definitions
  const tabs: TabDef[] = [
    {
      key: 'principal',
      label: 'Principal',
      icon: <TrendingUp size={13} />,
      available: true,
    },
    {
      key: 'segmentos',
      label: 'Segmentos',
      icon: <BarChart3 size={13} />,
      available: true,
    },
    {
      key: 'ideologia',
      label: 'Ideologia',
      icon: <Sparkles size={13} />,
      available: hasIdeology || (isStreaming && !isCollecting),
    },
    {
      key: 'reacoes',
      label: 'Reacoes',
      icon: <MessageCircle size={13} />,
      badge: comments.length > 0 ? comments.length : undefined,
      available: true,
    },
  ];

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
      {/* ─── Header ─── */}
      <div className="px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-600">
                Arena {isQuickAnswer ? '• Resposta Direta' : '• Analise'}
              </p>
              {isQuickAnswer && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
                  <Zap size={9} /> Instantaneo
                </span>
              )}
              {(isCollecting || isStreaming) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-400 animate-pulse">
                  <Activity size={9} /> {isCollecting ? 'Preparando' : 'Ao vivo'}
                </span>
              )}
              {isComplete && (
                <>
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Users size={10} /> {(totalPersonas || finalTotal).toLocaleString('pt-BR')} personas
                  </span>
                  {(quickAnswer?.processingTimeMs || simulation?.processingTime) && (
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Zap size={10} /> {(quickAnswer?.processingTimeMs ?? simulation?.processingTime ?? 0).toFixed(0)}ms
                    </span>
                  )}
                  <span className="text-[10px] text-emerald-400 font-bold">
                    {finalTotal > 0 ? Math.round((finalPositive / finalTotal) * 100) : 0}% a favor
                  </span>
                </>
              )}
            </div>
          </div>

          {media && media.length > 0 && (
            <div className="shrink-0 flex flex-col items-end gap-2">
              <MediaHeaderInline media={media} />
              {hasMediaContext ? (
                <button
                  onClick={() => setShowMediaSummary(!showMediaSummary)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200',
                    showMediaSummary
                      ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25 shadow-lg shadow-violet-500/10'
                      : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06] hover:bg-violet-500/10 hover:text-violet-300 hover:border-violet-500/20',
                  )}
                >
                  <FileText size={11} />
                  {showMediaSummary ? 'Fechar resumo' : 'Ver Resumo'}
                </button>
              ) : !isComplete ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.02] text-zinc-600 border border-white/[0.04]">
                  <FileText size={11} className="animate-pulse" />
                  Processando...
                </span>
              ) : null}
            </div>
          )}
        </div>

        <MediaSummaryPanel cleanedContext={cleanedMediaContext} open={showMediaSummary} onClose={() => setShowMediaSummary(false)} />
      </div>

      {/* ─── Collecting Phase (before metrics) ─── */}
      {isCollecting && <CollectingPhase status={data.collectingStatus} />}

      {/* ─── Tab Bar ─── */}
      {!isCollecting && <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />}

      {/* ─── Tab Content ─── */}
      {!isCollecting && activeTab === 'principal' && (
        <TabPrincipal
          isStreaming={isStreaming}
          phase={phase}
          processedCount={processedCount}
          totalCount={totalCount}
          finalPositive={finalPositive}
          finalNegative={finalNegative}
          finalNeutral={finalNeutral}
          finalTotal={finalTotal}
        />
      )}

      {activeTab === 'segmentos' && (
        <TabSegmentos segments={segments} hasSegments={hasSegments} />
      )}

      {activeTab === 'ideologia' && (
        <TabIdeologia
          quadrants={quadrants}
          clusters={clusters}
          total={simulation?.total ?? finalTotal}
          figures={figures}
        />
      )}

      {activeTab === 'reacoes' && (
        <TabReacoes
          comments={comments}
          commentFilter={commentFilter}
          setCommentFilter={setCommentFilter}
          commentsToShow={commentsToShow}
          setCommentsToShow={setCommentsToShow}
        />
      )}
    </div>
  );
}
