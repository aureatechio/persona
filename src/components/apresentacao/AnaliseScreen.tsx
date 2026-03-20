'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Zap, ChevronDown, Clock, Download, Share2, RefreshCw, Copy,
  Video, MessageCircle, MapPin, Globe, Target, TrendingUp, Mic, Image, Layout,
  Instagram, Youtube, Tv, Radio, Megaphone, Newspaper, MonitorPlay,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';

/* ─── Types ────────────────────────────────────────────────────────── */

interface AnaliseData {
  headline: string;
  score: number;
  tags: string[];
  stats: { value: string; label: string }[];
  recommendations: { icon: string; text: string; priority: string; detail: string }[];
  insight: { title: string; description: string; action: string };
  nextSteps: { title: string; benefit: string; deadline: string }[];
}

/* ─── Icon mapping ─────────────────────────────────────────────────── */

const iconMap: Record<string, typeof Video> = {
  video: Video,
  message: MessageCircle,
  map: MapPin,
  sparkles: Sparkles,
  globe: Globe,
  target: Target,
  trending: TrendingUp,
  mic: Mic,
  image: Image,
  layout: Layout,
};

/* ─── Priority badge config ────────────────────────────────────────── */

const priorityConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  prioridade: { label: 'PRIORIDADE', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  importante: { label: 'IMPORTANTE', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  oportunidade: { label: 'OPORTUNIDADE', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
};

/* ─── Platform badge config ────────────────────────────────────────── */

const platformConfig: Record<string, { label: string; icon: typeof Instagram; color: string; bg: string; border: string }> = {
  instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  tiktok: { label: 'TikTok', icon: MonitorPlay, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  youtube: { label: 'YouTube', icon: Youtube, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  tv: { label: 'TV', icon: Tv, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  radio: { label: 'Rádio', icon: Radio, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  outdoor: { label: 'Outdoor', icon: Megaphone, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  impresso: { label: 'Impresso', icon: Newspaper, color: 'text-zinc-300', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
};

/* ─── Animated Waiting Screen ───────────────────────────────────────── */

function WaitingScreen() {
  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      <div className="absolute w-[500px] h-[500px] bg-emerald-500/[0.04] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float1 8s ease-in-out infinite' }} />
      <div className="absolute w-[400px] h-[400px] bg-rose-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float2 10s ease-in-out infinite' }} />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative w-32 h-32">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20"
            style={{ animation: 'spin 8s linear infinite' }} />
          <div className="absolute inset-3 rounded-full border-2 border-dashed border-rose-500/15"
            style={{ animation: 'spin 12s linear infinite reverse' }} />
          <div className="absolute inset-6 rounded-full border border-amber-500/10"
            style={{ animation: 'spin 6s linear infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={40} className="text-emerald-400/60" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
          </div>
          <div className="absolute inset-[-8px]" style={{ animation: 'spin 4s linear infinite' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-lg shadow-emerald-500/50" />
          </div>
          <div className="absolute inset-[-16px]" style={{ animation: 'spin 6s linear infinite reverse' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-rose-400 rounded-full shadow-lg shadow-rose-500/50" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-white tracking-tight">Análise IA</p>
          <p className="text-sm text-zinc-500">Aguardando dados completos para análise...</p>
        </div>

        <div className="flex gap-2">
          {[0, 200, 400].map(delay => (
            <div key={delay} className="w-2 h-2 bg-emerald-400/60 rounded-full"
              style={{ animation: `bounce 1.4s ease-in-out ${delay}ms infinite` }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(-100px, -50px); } 50% { transform: translate(100px, 50px); } }
        @keyframes float2 { 0%, 100% { transform: translate(80px, 60px); } 50% { transform: translate(-120px, -40px); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>
    </div>
  );
}

/* ─── Loading Skeleton ──────────────────────────────────────────────── */

function AnalysisLoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-4 mt-2 animate-pulse">
      {/* Hero skeleton */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="h-4 w-24 bg-zinc-800/60 rounded-lg mb-4" />
        <div className="h-7 w-3/4 bg-zinc-800/60 rounded-lg mb-6" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-zinc-800/40 rounded-xl" />
          ))}
        </div>
      </div>
      {/* Recommendations skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-48 bg-zinc-800/60 rounded-lg mb-3" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-14 bg-zinc-800/30 rounded-xl" />
        ))}
      </div>
      {/* Next steps skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-36 bg-zinc-800/60 rounded-lg mb-3" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-zinc-800/30 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/* ─── Score Ring ─────────────────────────────────────────────────────── */

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (pct / 100) * circumference;

  const color = score >= 7 ? 'text-emerald-400' : score >= 4 ? 'text-amber-400' : 'text-red-400';
  const strokeColor = score >= 7 ? 'stroke-emerald-400' : score >= 4 ? 'stroke-amber-400' : 'stroke-red-400';
  const glowColor = score >= 7 ? 'shadow-emerald-500/20' : score >= 4 ? 'shadow-amber-500/20' : 'shadow-red-500/20';

  return (
    <div className={cn('relative w-24 h-24 shrink-0 rounded-full shadow-lg', glowColor)}>
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="3"
          className="text-zinc-800/50" />
        <circle cx="48" cy="48" r="42" fill="none" strokeWidth="3"
          className={cn(strokeColor, 'transition-all duration-1000 ease-out')}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold', color)}>{score.toFixed(1)}</span>
        <span className="text-[10px] text-zinc-500 font-medium">/10</span>
      </div>
    </div>
  );
}

/* ─── Recommendation Row ────────────────────────────────────────────── */

function RecommendationRow({ rec, index }: { rec: AnaliseData['recommendations'][0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconMap[rec.icon] || Sparkles;
  const priority = priorityConfig[rec.priority] || priorityConfig.importante;

  return (
    <div
      className={cn(
        'bg-zinc-900/40 border border-white/[0.06] rounded-xl overflow-hidden',
        'hover:bg-zinc-900/60 hover:border-white/[0.1] transition-all duration-300',
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 text-left cursor-pointer"
      >
        <div className="p-2 rounded-xl bg-white/[0.04] shrink-0">
          <Icon size={18} className="text-zinc-400" />
        </div>
        <span className="flex-1 text-sm font-medium text-zinc-200">{rec.text}</span>
        <span className={cn(
          'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0',
          priority.bg, priority.color, priority.border,
        )}>
          {priority.label}
        </span>
        <ChevronDown size={16} className={cn(
          'text-zinc-500 shrink-0 transition-transform duration-200',
          expanded && 'rotate-180',
        )} />
      </button>
      {expanded && rec.detail && (
        <div className="px-4 pb-4 pl-14">
          <p className="text-xs text-zinc-400 leading-relaxed">{rec.detail}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main Analise Screen ───────────────────────────────────────────── */

export function AnaliseScreen() {
  const { data, hasEverReceived } = usePresentationData();
  const [analise, setAnalise] = useState<AnaliseData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hasCalledRef = useRef(false);
  const lastQuestion = useRef('');

  // Reset when new question arrives
  useEffect(() => {
    if (data.question !== lastQuestion.current) {
      lastQuestion.current = data.question;
      hasCalledRef.current = false;
      setAnalise(null);
      setError('');
    }
  }, [data.question]);

  const callAnalise = useCallback(async () => {
    if (!hasEverReceived) return;

    setIsLoading(true);
    setAnalise(null);
    setError('');

    try {
      const res = await fetch('/api/arena/analise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: data.question,
          positive: data.positive,
          negative: data.negative,
          neutral: data.neutral,
          totalPersonas: data.totalPersonas,
          segments: data.segments,
          phase: 'complete',
          contentMeta: data.contentMeta,
        }),
      });

      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAnalise(json);
    } catch (err: any) {
      console.error('[Analise] Error:', err);
      setError('Falha ao gerar análise');
    } finally {
      setIsLoading(false);
    }
  }, [data, hasEverReceived]);

  // Trigger when complete
  useEffect(() => {
    if (!data || hasCalledRef.current) return;
    if (data.phase === 'complete' && data.segments) {
      hasCalledRef.current = true;
      callAnalise();
    }
  }, [data, callAnalise]);

  // No data yet
  if (!hasEverReceived) return <WaitingScreen />;

  const total = (data.positive || 0) + (data.negative || 0) + (data.neutral || 0);
  const isWaitingForComplete = !analise && !isLoading && data.phase !== 'complete';
  const platform = platformConfig[data.contentMeta?.mediaType || ''];

  // Format date
  const dateStr = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative flex flex-col">
      {/* Background effects */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float1 8s ease-in-out infinite' }} />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float2 10s ease-in-out infinite' }} />

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto px-6 md:px-8 py-5">
        {isWaitingForComplete ? (
          /* Waiting for simulation to complete */
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" style={{ animation: 'spin 6s linear infinite' }} />
              <div className="absolute inset-3 rounded-full border-2 border-dashed border-rose-500/15" style={{ animation: 'spin 10s linear infinite reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={32} className="text-emerald-400/60 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg text-zinc-400">Aguardando conclusão da pesquisa...</p>
              <div className="w-48 h-1.5 bg-zinc-900 rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-rose-400 rounded-full"
                  style={{ width: `${data.totalCount > 0 ? (data.processedCount / data.totalCount) * 100 : 0}%`, transition: data.processedCount <= 1 ? 'none' : 'width 1s ease-out' }} />
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <AnalysisLoadingSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="p-4 rounded-2xl bg-red-500/10">
              <Sparkles size={32} className="text-red-400" />
            </div>
            <p className="text-zinc-400 text-sm">{error}</p>
            <button onClick={callAnalise} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl text-sm text-zinc-300 transition-all duration-200">
              Tentar novamente
            </button>
          </div>
        ) : analise ? (
          <div className="max-w-4xl mx-auto space-y-5">

            {/* ═══ TOP BAR — Tags + Date ═══ */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {analise.tags?.map((tag, i) => (
                  <span key={i} className="inline-flex items-center px-4 py-1.5 bg-zinc-800/60 border border-white/[0.08] rounded-full text-xs font-medium text-zinc-300">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-xs text-zinc-500">{dateStr}</span>
            </div>

            {/* ═══ HERO CARD — Headline + Score + Stats ═══ */}
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mb-3 block">
                    SUA ANÁLISE
                  </span>
                  <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-snug">
                    {analise.headline}
                  </h1>
                </div>
                <ScoreRing score={analise.score} />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                {analise.stats?.map((stat, i) => (
                  <div key={i} className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl p-3 text-center">
                    <span className={cn(
                      'text-lg font-bold block',
                      stat.value.startsWith('+') ? 'text-emerald-400' : 'text-white'
                    )}>
                      {stat.value}
                    </span>
                    <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ ACTION BUTTONS BAR ═══ */}
            <div className="flex items-center gap-2">
              {[
                { icon: Download, label: 'Exportar PDF' },
                { icon: Share2, label: 'Compartilhar' },
                { icon: Copy, label: 'Copiar Insights' },
                { icon: RefreshCw, label: 'Nova Análise' },
              ].map(({ icon: BtnIcon, label }) => (
                <button key={label} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.12] rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-all duration-200 active:scale-[0.97]">
                  <BtnIcon size={14} />
                  {label}
                </button>
              ))}
              <div className="flex-1" />
              {total > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
                    {total > 0 ? Math.round((data.positive / total) * 100) : 0}% ✓
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400">
                    {total > 0 ? Math.round((data.negative / total) * 100) : 0}% ✗
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400">
                    {total > 0 ? Math.round((data.neutral / total) * 100) : 0}% ~
                  </span>
                </div>
              )}
            </div>

            {/* ═══ EVOLUA SEU CONTEÚDO ═══ */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <Sparkles size={16} className="text-zinc-500" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Evolua seu conteúdo
                </h2>
              </div>
              <div className="space-y-2">
                {analise.recommendations?.map((rec, i) => (
                  <RecommendationRow key={i} rec={rec} index={i} />
                ))}
              </div>
            </div>

            {/* ═══ INSIGHT DESTAQUE ═══ */}
            {analise.insight && (
              <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 shrink-0 mt-0.5">
                    <Sparkles size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-400 mb-1">
                      {analise.insight.title}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-2">
                      {analise.insight.description}
                    </p>
                    <p className="text-xs text-zinc-300 font-medium">
                      → {analise.insight.action}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ PRÓXIMOS PASSOS ═══ */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <Zap size={16} className="text-zinc-500" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Próximos Passos
                </h2>
              </div>
              <div className="space-y-2">
                {analise.nextSteps?.map((step, i) => (
                  <div
                    key={i}
                    className="bg-zinc-900/40 border border-white/[0.06] rounded-xl p-4 flex items-center gap-4 hover:bg-zinc-900/60 hover:border-white/[0.1] transition-all duration-300"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/[0.08] flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="text-xs text-emerald-400 mt-0.5">{step.benefit}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-zinc-500">
                      <Clock size={12} />
                      <span className="text-xs font-medium">{step.deadline}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom spacer */}
            <div className="h-4" />
          </div>
        ) : null}
      </div>

      {/* ═══ BOTTOM SENTIMENT BAR ═══ */}
      {total > 0 && (
        <div className="shrink-0 h-[3px]">
          <div className="h-full flex">
            <div className="h-full bg-emerald-500 transition-all duration-[2000ms]" style={{ width: `${Math.round((data.positive / total) * 100)}%` }} />
            <div className="h-full bg-amber-500 transition-all duration-[2000ms]" style={{ width: `${Math.round((data.neutral / total) * 100)}%` }} />
            <div className="h-full bg-rose-500 transition-all duration-[2000ms]" style={{ width: `${Math.round((data.negative / total) * 100)}%` }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(-60px, -30px); } 50% { transform: translate(60px, 30px); } }
        @keyframes float2 { 0%, 100% { transform: translate(40px, 40px); } 50% { transform: translate(-80px, -20px); } }
      `}</style>
    </div>
  );
}
