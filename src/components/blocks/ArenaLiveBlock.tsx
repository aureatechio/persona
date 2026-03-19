'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Users, Zap, Eye, ChevronDown, ChevronUp, ChevronRight,
  Image, Film, Link, Sparkles, MapPin, GraduationCap,
  Activity, Church, Palette, Briefcase, Vote, FileText, X, Play,
  BarChart3, MessageCircle, TrendingUp, Search, Globe, Brain, UserCheck, Check,
  Shield, Target, AlertTriangle, Lightbulb, Crosshair, HeartHandshake,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnhancedSimulationResult, Sentiment, QuadrantResult, ClusterResult, PoliticalFigureDetection, CommentResult, ContentMeta, GeoCity } from '@/lib/arena/types';
import { scoreToEmoji, scoreToLabel, scoreToHex } from '@/lib/arena/types';
import type { AllSegments, SegmentItem } from '@/lib/arena/segments';

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
  /** Average 0-10 impact score across all processed personas */
  avgScore: number;
  /** Running sum of scores (for incremental average computation) */
  scoreSum: number;
  simulation: EnhancedSimulationResult | null;
  totalPersonas: number;
  media?: MediaItem[];
  mediaContext?: string;
  error?: string;
  segments?: AllSegments;
  liveIdeology?: {
    quadrants: QuadrantResult[];
    clusterResults: ClusterResult[];
    politicalFigures: PoliticalFigureDetection[];
  };
  liveComments?: CommentResult[];
  /** State-level sentiment breakdown for Brazil heat map */
  stateBreakdown?: Record<string, { count: number; positive: number; negative: number; neutral: number }>;
  /** City-level breakdown grouped by state sigla for map drill-down */
  cityBreakdown?: import('@/lib/arena/types').CityBreakdown;
  /** Status message during collecting phase */
  collectingStatus?: string;
  /** Content metadata from UI selectors (media type, ideology, region) */
  contentMeta?: ContentMeta;
  /** Cities used in geo-filtered analysis (for map zoom + markers) */
  geoCities?: GeoCity[];
}

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
    <div className="px-5 py-4 md:px-6">
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
   Markdown Renderer (for locutor analysis)
   ============================================================ */

/** Parse markdown into sections — handles ## headers, # headers, AND bold-prefixed lines like **CENÁRIO GERAL:** */
function parseMarkdownSections(text: string): { title: string; body: string }[] {
  const lines = text.split('\n');
  const sections: { title: string; body: string }[] = [];
  let currentTitle = '';
  let currentBody: string[] = [];

  // Regex: line starts with **SOME TITLE:** or **SOME TITLE**: (bold label followed by colon)
  const boldSectionRe = /^\*\*([^*]+?)\s*:?\*\*\s*:?\s*(.*)/;

  const flush = () => {
    if (currentTitle || currentBody.length > 0) {
      sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
    }
    currentTitle = '';
    currentBody = [];
  };

  for (const line of lines) {
    // Match any markdown header (# , ## , ### , #### , etc.)
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      flush();
      currentTitle = headerMatch[2].replace(/\*\*/g, '').trim();
    } else {
      // Check if line starts with a bold section label
      const boldMatch = line.match(boldSectionRe);
      if (boldMatch) {
        const label = boldMatch[1].trim();
        const rest = boldMatch[2].trim();
        // Only treat as section if the label looks like a title (mostly uppercase or known keywords)
        const isTitle = label === label.toUpperCase() ||
          /cenar|grupo|ponto|recomend|estrateg|apoio|rejei|critic|vulnerab|panorama|visao|analise|resumo/i.test(label);
        if (isTitle) {
          flush();
          currentTitle = label;
          if (rest) currentBody.push(rest);
          continue;
        }
      }
      currentBody.push(line);
    }
  }
  flush();
  return sections.filter(s => s.title && s.body);
}

function RenderInlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2);
          if (inner.toLowerCase().match(/rejeic|negativ|contra|devastador|critic/)) {
            return <span key={j} className="font-bold text-rose-400">{inner}</span>;
          }
          if (inner.toLowerCase().match(/favor|positiv|aprovac|oportunidade/)) {
            return <span key={j} className="font-bold text-emerald-400">{inner}</span>;
          }
          if (inner.toLowerCase().match(/recomend|estrateg|urgente|sugest/)) {
            return <span key={j} className="font-bold text-amber-400">{inner}</span>;
          }
          return <span key={j} className="font-semibold text-white">{inner}</span>;
        }
        return part;
      })}
    </>
  );
}

/* ── Section theming: icon, colors, glow per section type ── */

interface SectionTheme {
  icon: LucideIcon;
  border: string;
  text: string;
  bg: string;
  glow: string;
  iconBg: string;
  dot: string;
}

function getSectionTheme(title: string, index: number): SectionTheme {
  const t = title.toLowerCase();

  if (t.includes('recomend') || t.includes('estrateg') || t.includes('sugest') || t.includes('caminho'))
    return {
      icon: Lightbulb, border: 'border-amber-500/20', text: 'text-amber-400',
      bg: 'bg-amber-500/[0.04]', glow: 'bg-amber-500/10', iconBg: 'bg-amber-500/15 border-amber-500/25',
      dot: 'bg-amber-400',
    };
  if (t.includes('rejei') || t.includes('critic') || t.includes('risco') || t.includes('ponto') || t.includes('vulnerab'))
    return {
      icon: AlertTriangle, border: 'border-rose-500/20', text: 'text-rose-400',
      bg: 'bg-rose-500/[0.04]', glow: 'bg-rose-500/10', iconBg: 'bg-rose-500/15 border-rose-500/25',
      dot: 'bg-rose-400',
    };
  if (t.includes('apoio') || t.includes('favor') || t.includes('grupo') || t.includes('base'))
    return {
      icon: HeartHandshake, border: 'border-emerald-500/20', text: 'text-emerald-400',
      bg: 'bg-emerald-500/[0.04]', glow: 'bg-emerald-500/10', iconBg: 'bg-emerald-500/15 border-emerald-500/25',
      dot: 'bg-emerald-400',
    };
  if (t.includes('cenar') || t.includes('panorama') || t.includes('geral') || t.includes('visao'))
    return {
      icon: Globe, border: 'border-sky-500/20', text: 'text-sky-400',
      bg: 'bg-sky-500/[0.04]', glow: 'bg-sky-500/10', iconBg: 'bg-sky-500/15 border-sky-500/25',
      dot: 'bg-sky-400',
    };

  // Cycle through themes for unrecognized sections
  const fallbacks: SectionTheme[] = [
    { icon: Crosshair, border: 'border-violet-500/20', text: 'text-violet-400', bg: 'bg-violet-500/[0.04]', glow: 'bg-violet-500/10', iconBg: 'bg-violet-500/15 border-violet-500/25', dot: 'bg-violet-400' },
    { icon: Target, border: 'border-cyan-500/20', text: 'text-cyan-400', bg: 'bg-cyan-500/[0.04]', glow: 'bg-cyan-500/10', iconBg: 'bg-cyan-500/15 border-cyan-500/25', dot: 'bg-cyan-400' },
    { icon: Shield, border: 'border-fuchsia-500/20', text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/[0.04]', glow: 'bg-fuchsia-500/10', iconBg: 'bg-fuchsia-500/15 border-fuchsia-500/25', dot: 'bg-fuchsia-400' },
  ];
  return fallbacks[index % fallbacks.length];
}

/* ── Animated section card ── */

function AnalysisCard({ section, index }: { section: { title: string; body: string }; index: number }) {
  const theme = getSectionTheme(section.title, index);
  const Icon = theme.icon;
  // Join body into sentences, split by ". " for cleaner paragraphs
  const bodyText = section.body.replace(/\n+/g, ' ').trim();

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border backdrop-blur-xl',
        'transition-all duration-500 ease-out',
        'hover:shadow-2xl hover:shadow-black/40',
        theme.border, theme.bg,
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Glow orb */}
      <div className={cn(
        'absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity duration-500',
        theme.glow,
      )} />

      {/* Header: icon + title + accent line */}
      <div className="relative px-5 pt-5 pb-3 flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0',
          'transition-transform duration-300 group-hover:scale-110',
          theme.iconBg,
        )}>
          <Icon size={18} className={theme.text} />
        </div>
        <div className="flex-1 min-w-0">
          {section.title && (
            <h3 className={cn(
              'text-sm font-black uppercase tracking-[0.08em] leading-tight',
              theme.text,
            )}>
              {section.title}
            </h3>
          )}
        </div>
      </div>

      {/* Accent divider */}
      <div className="mx-5">
        <div className={cn('h-px opacity-30', theme.dot)} />
      </div>

      {/* Body text — readable size */}
      <div className="relative px-5 pb-5 pt-3">
        <p className="text-sm text-zinc-300 leading-relaxed">
          <RenderInlineMarkdown text={bodyText} />
        </p>
      </div>
    </div>
  );
}

function RenderMarkdown({ text }: { text: string }) {
  const sections = parseMarkdownSections(text);

  // 2+ sections → rich card grid
  if (sections.length >= 2) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section, i) => (
          <AnalysisCard key={i} section={section} index={i} />
        ))}
      </div>
    );
  }

  // Fallback: single section — still use a card
  if (sections.length === 1 && sections[0].title) {
    return <AnalysisCard section={sections[0]} index={0} />;
  }

  // Raw text without headers
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (/^#{1,6}\s+/.test(line)) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-white tracking-tight mb-2">
          {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
        </h2>
      );
    } else {
      elements.push(
        <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-1.5">
          <RenderInlineMarkdown text={line} />
        </p>
      );
    }
  }
  return <>{elements}</>;
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
   Main Component: ArenaLiveBlock — Input + Locutor Analysis
   ============================================================ */

export function ArenaLiveBlock({ data }: { data: ArenaLiveData }) {
  const {
    question, phase, processedCount, totalCount,
    positive, negative, neutral,
    simulation, totalPersonas, media, mediaContext,
    segments,
  } = data;

  const [showMediaSummary, setShowMediaSummary] = useState(false);
  const cleanedMediaContext = useMemo(() => mediaContext ? cleanMediaContext(mediaContext) : '', [mediaContext]);
  const hasMediaContext = cleanedMediaContext.length > 0;
  const blockRef = useRef<HTMLDivElement>(null);

  // Locutor analysis state
  const [analysisText, setAnalysisText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const hasCalledAnalysis = useRef(false);
  const lastQuestion = useRef('');
  const charIndex = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isCollecting = phase === 'collecting';
  const isStreaming = phase === 'streaming' || phase === 'aggregating';
  const isComplete = phase === 'complete';

  const finalPositive = isComplete ? (simulation?.positive ?? positive) : positive;
  const finalNegative = isComplete ? (simulation?.negative ?? negative) : negative;
  const finalNeutral = isComplete ? (simulation?.neutral ?? neutral) : neutral;
  const finalTotal = isComplete ? (simulation?.total ?? totalCount) : totalCount;

  // Reset when new question arrives
  useEffect(() => {
    if (question && question !== lastQuestion.current) {
      lastQuestion.current = question;
      hasCalledAnalysis.current = false;
      setAnalysisText('');
      setDisplayedText('');
      charIndex.current = 0;
      if (typingTimer.current) clearInterval(typingTimer.current);
      if (abortRef.current) abortRef.current.abort();
    }
  }, [question]);

  // Call locutor API — ONLY when complete
  const callLocutor = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsAnalyzing(true);
    setAnalysisText('');
    setDisplayedText('');
    charIndex.current = 0;
    if (typingTimer.current) clearInterval(typingTimer.current);

    let accumulated = '';

    try {
      const res = await fetch('/api/arena/locutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          positive: finalPositive,
          negative: finalNegative,
          neutral: finalNeutral,
          totalPersonas: totalPersonas || finalTotal,
          segments,
          phase: 'complete',
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('Failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              accumulated += parsed.text;
              setAnalysisText(accumulated);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('[Locutor] Error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [question, finalPositive, finalNegative, finalNeutral, totalPersonas, finalTotal, segments]);

  // Trigger analysis ONLY when complete
  useEffect(() => {
    if (!isComplete || hasCalledAnalysis.current) return;
    if (segments) {
      hasCalledAnalysis.current = true;
      callLocutor();
    }
  }, [isComplete, segments, callLocutor]);

  // Typing animation
  useEffect(() => {
    if (!analysisText) return;
    if (typingTimer.current) clearInterval(typingTimer.current);

    typingTimer.current = setInterval(() => {
      if (charIndex.current < analysisText.length) {
        const charsToAdd = Math.min(3, analysisText.length - charIndex.current);
        charIndex.current += charsToAdd;
        setDisplayedText(analysisText.slice(0, charIndex.current));
      } else {
        if (typingTimer.current) clearInterval(typingTimer.current);
      }
    }, 15);

    return () => { if (typingTimer.current) clearInterval(typingTimer.current); };
  }, [analysisText]);

  // Auto-scroll as text appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedText]);

  // Check if presentation mode is active (via URL param)
  const isPresentationMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('apresentacao');
  }, []);

  // Error state
  if (data.error && !simulation) {
    return (
      <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-6 text-center">
        <p className="text-sm text-red-400">{data.error}</p>
        <p className="text-xs text-zinc-600 mt-2">&ldquo;{question}&rdquo;</p>
      </div>
    );
  }

  // ── Presentation Mode: show ONLY loading/progress ──────────────────
  if (isPresentationMode) {
    const progress = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;

    return (
      <div ref={blockRef} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-600">
              Arena • Apresentacao
            </p>
            {(isCollecting || isStreaming) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 animate-pulse">
                <Activity size={9} /> Ao vivo
              </span>
            )}
            {isComplete && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
                <Check size={9} /> Completo
              </span>
            )}
          </div>
          {isCollecting && <CollectingPhase status={data.collectingStatus} />}
          {!isCollecting && !isComplete && (
            <div className="space-y-2">
              <div className="h-2 bg-zinc-900/80 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-zinc-500 text-center">{progress.toFixed(0)}% processado</p>
            </div>
          )}
          {isComplete && (
            <p className="text-xs text-zinc-500 text-center">{finalTotal.toLocaleString()} personas processadas</p>
          )}
        </div>
      </div>
    );
  }

  // ── Normal Mode: Collecting + Progress + Analysis ──────────────────
  const total = finalPositive + finalNegative + finalNeutral;

  const showAnalysis = isComplete && (displayedText || isAnalyzing);
  const waitingForAnalysis = isComplete && !displayedText && !isAnalyzing && !analysisText;

  return (
    <div ref={blockRef} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* ─── Header ─── */}
      <div className="px-6 pt-4 pb-3 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-600">
              Arena • Analise
            </p>
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
                {simulation?.processingTime && (
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Zap size={10} /> {(simulation?.processingTime ?? 0).toFixed(0)}ms
                  </span>
                )}
              </>
            )}
            {isAnalyzing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-400 animate-pulse">
                <Sparkles size={9} /> Analisando
              </span>
            )}
          </div>

          {/* Score gauge when complete */}
          {isComplete && total > 0 && (() => {
            const score = data.avgScore ?? 5.0;
            const emoji = scoreToEmoji(score);
            const label = scoreToLabel(score);
            const hex = scoreToHex(score);
            return (
              <div className="flex items-center gap-4">
                {/* Score badge — hero size */}
                <div className="relative flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl" style={{ borderColor: `${hex}30` }}>
                  <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-20" style={{ background: `radial-gradient(ellipse at center, ${hex}25, transparent 70%)` }} />
                  <span className="text-3xl leading-none relative">{emoji}</span>
                  <div className="flex flex-col relative">
                    <span className="text-3xl font-black tabular-nums leading-none tracking-tight" style={{ color: hex }}>{score.toFixed(1)}</span>
                    <span className="text-xs font-bold mt-0.5" style={{ color: `${hex}cc` }}>{label}</span>
                  </div>
                </div>
                {/* Gradient bar */}
                <div className="flex-1 h-2.5 rounded-full overflow-hidden relative bg-zinc-900/80">
                  <div className="absolute inset-0 rounded-full opacity-30"
                    style={{ background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)' }} />
                  <div className="absolute top-0 h-full w-[7px] rounded-full transition-all duration-[3s]"
                    style={{ left: `calc(${(score / 10) * 100}% - 3.5px)`, backgroundColor: hex, boxShadow: `0 0 10px ${hex}90` }} />
                </div>
              </div>
            );
          })()}

          <MediaSummaryPanel cleanedContext={cleanedMediaContext} open={showMediaSummary} onClose={() => setShowMediaSummary(false)} />
        </div>

        {/* Right column: Media + Ver Resumo */}
        {media && media.length > 0 && (
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <MediaHeaderInline media={media} />
            {hasMediaContext ? (
              <button
                onClick={() => setShowMediaSummary(!showMediaSummary)}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200',
                  showMediaSummary
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25 shadow-lg shadow-violet-500/10'
                    : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06] hover:bg-violet-500/10 hover:text-violet-300 hover:border-violet-500/20',
                )}
              >
                <FileText size={11} />
                {showMediaSummary ? 'Fechar resumo' : 'Ver Resumo'}
              </button>
            ) : !isComplete ? (
              <span className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.02] text-zinc-600 border border-white/[0.04]">
                <FileText size={11} className="animate-pulse" />
                Processando...
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Divider */}
      {!isCollecting && <div className="h-px bg-gradient-to-r from-transparent via-zinc-800/50 to-transparent" />}

      {/* ─── Collecting Phase ─── */}
      {isCollecting && <CollectingPhase status={data.collectingStatus} />}

      {/* ─── Streaming Progress + "analyzing" teaser ─── */}
      {isStreaming && (
        <>
          <LiveProgressBar processed={processedCount} total={totalCount} phase={phase} />
          <div className="px-6 pb-14 pt-10 flex flex-col items-center justify-center gap-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-violet-500/30" style={{ animation: 'spin 4s linear infinite' }} />
              <div className="absolute inset-3 rounded-full border-2 border-dashed border-emerald-500/25" style={{ animation: 'spin 7s linear infinite reverse' }} />
              <div className="absolute inset-[-10px] rounded-full border border-violet-500/10" style={{ animation: 'spin 12s linear infinite' }} />
              <div className="absolute inset-[-18px] rounded-full border border-dashed border-fuchsia-500/[0.07]" style={{ animation: 'spin 16s linear infinite reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={36} className="text-violet-400 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-2xl font-bold text-violet-400 tracking-tight">Analisando opiniões</p>
              <p className="text-base text-zinc-500">O parecer estratégico será gerado ao final</p>
            </div>
          </div>
        </>
      )}

      {/* ─── Complete: Waiting for analysis ─── */}
      {waitingForAnalysis && (
        <div className="px-6 py-8 flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" style={{ animation: 'spin 6s linear infinite' }} />
            <div className="absolute inset-3 rounded-full border-2 border-dashed border-emerald-500/15" style={{ animation: 'spin 10s linear infinite reverse' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles size={24} className="text-violet-400/60 animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-zinc-500">Preparando analise...</p>
        </div>
      )}

      {/* ─── Complete: Analysis text (compact card grid, no scroll) ─── */}
      {showAnalysis && (
        <div ref={scrollRef} className="px-5 py-4">
          <RenderMarkdown text={displayedText} />
          {(isAnalyzing || charIndex.current < analysisText.length) && (
            <span className="inline-block w-0.5 h-4 bg-violet-400 ml-1 animate-pulse" />
          )}
        </div>
      )}

      {/* No bottom bar during streaming — only progress + teaser above */}
    </div>
  );
}
