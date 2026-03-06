'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity,
  User,
  Clock,
  Check,
  AlertCircle,
  Mic,
  MessageCircle,
  Play,
  Send,
  Film,
  Loader2,
  RefreshCw,
  X,
  Sparkles,
  Volume2,
  Hourglass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface Selfie {
  id: string;
  name: string;
  phone: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  whatsapp_sent: boolean;
  videoUrl: string | null;
}

// ── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'queued', label: 'Na fila', icon: Clock, color: 'zinc' },
  { key: 'transcribing', label: 'Transcrevendo', icon: Mic, color: 'sky' },
  { key: 'generating_text', label: 'Gerando texto', icon: MessageCircle, color: 'violet' },
  { key: 'generating_tts', label: 'Gerando voz', icon: Volume2, color: 'amber' },
  { key: 'generating_lipsync', label: 'Lip-sync', icon: Film, color: 'rose' },
  { key: 'composing', label: 'Compondo video', icon: Sparkles, color: 'orange' },
  { key: 'sending', label: 'Enviando WhatsApp', icon: Send, color: 'emerald' },
  { key: 'completed', label: 'Concluido', icon: Check, color: 'emerald' },
] as const;

type StepColor = (typeof STEPS)[number]['color'];

function getStepIndex(status: string): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? -1 : idx;
}

function getStepConfig(status: string) {
  return STEPS.find((s) => s.key === status) ?? null;
}

// ── Color utilities ──────────────────────────────────────────────────────────

const colorMap: Record<StepColor | 'red', { bg: string; border: string; text: string; glow: string; dot: string }> = {
  zinc: { bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', text: 'text-zinc-400', glow: 'shadow-zinc-500/10', dot: 'bg-zinc-500' },
  sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', glow: 'shadow-sky-500/10', dot: 'bg-sky-500' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', glow: 'shadow-violet-500/10', dot: 'bg-violet-500' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/10', dot: 'bg-amber-500' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', glow: 'shadow-rose-500/10', dot: 'bg-rose-500' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', glow: 'shadow-orange-500/10', dot: 'bg-orange-500' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/10', dot: 'bg-emerald-500' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', glow: 'shadow-red-500/10', dot: 'bg-red-500' },
};

// ── Time estimates per step (in seconds) ─────────────────────────────────────
// Based on average observed pipeline times
const STEP_DURATION_ESTIMATES: Record<string, number> = {
  queued: 10,
  transcribing: 15,
  generating_text: 8,
  generating_tts: 12,
  generating_lipsync: 120, // Kling AI is the bottleneck (~2 min)
  composing: 30,
  sending: 5,
};

function estimateRemainingSeconds(status: string): number | null {
  const currentIdx = getStepIndex(status);
  if (currentIdx === -1 || status === 'completed' || status === 'failed') return null;

  let remaining = 0;
  // Add half of current step (assume we're midway through it)
  const currentKey = STEPS[currentIdx].key;
  remaining += (STEP_DURATION_ESTIMATES[currentKey] ?? 0) / 2;

  // Add full duration of remaining steps
  for (let i = currentIdx + 1; i < STEPS.length - 1; i++) {
    remaining += STEP_DURATION_ESTIMATES[STEPS[i].key] ?? 0;
  }
  return Math.round(remaining);
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `~${secs}s`;
  const mins = Math.ceil(secs / 60);
  return `~${mins}min`;
}

// ── Time helper ──────────────────────────────────────────────────────────────

function formatElapsed(from: string): string {
  const ms = Date.now() - new Date(from).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remainSecs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative bg-zinc-950 border border-white/[0.08] rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-white">{name}</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-200"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4">
          <video src={url} controls autoPlay className="w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── Step Progress ────────────────────────────────────────────────────────────

function StepProgress({ status }: { status: string }) {
  const currentIdx = getStepIndex(status);
  const isFailed = status === 'failed';

  return (
    <div className="flex items-center gap-1 mt-3">
      {STEPS.map((step, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        const color = isFailed && isActive ? 'red' : step.color;
        const c = colorMap[color];

        return (
          <div
            key={step.key}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-500',
              isDone ? c.dot : isActive ? cn(c.dot, 'animate-pulse') : 'bg-zinc-800/50',
            )}
            title={step.label}
          />
        );
      })}
    </div>
  );
}

// ── Selfie Card ──────────────────────────────────────────────────────────────

function SelfieCard({ selfie, onPlay }: { selfie: Selfie; onPlay: (s: Selfie) => void }) {
  const [elapsed, setElapsed] = useState(formatElapsed(selfie.created_at));
  const isFailed = selfie.status === 'failed';
  const isCompleted = selfie.status === 'completed' || selfie.whatsapp_sent;
  const stepConfig = getStepConfig(selfie.status);
  const color = isFailed ? 'red' : (stepConfig?.color ?? 'zinc');
  const c = colorMap[color];
  const Icon = isFailed ? AlertCircle : (stepConfig?.icon ?? Clock);
  const label = isFailed ? 'Falhou' : (stepConfig?.label ?? selfie.status);

  // Live elapsed timer
  useEffect(() => {
    if (isCompleted || isFailed) {
      setElapsed(formatElapsed(selfie.created_at));
      return;
    }
    const interval = setInterval(() => setElapsed(formatElapsed(selfie.created_at)), 1000);
    return () => clearInterval(interval);
  }, [selfie.created_at, isCompleted, isFailed]);

  return (
    <div
      className={cn(
        'group relative bg-white/[0.03] hover:bg-white/[0.06]',
        'border border-white/[0.06] hover:border-white/[0.12]',
        'rounded-2xl p-5',
        'shadow-xl shadow-black/20 hover:shadow-2xl',
        'transition-all duration-300 ease-out',
        isCompleted && 'border-emerald-500/20 hover:border-emerald-500/30',
        isFailed && 'border-red-500/20 hover:border-red-500/30',
      )}
    >
      {/* Status glow orb */}
      {!isCompleted && !isFailed && (
        <div className={cn('absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-30', c.dot)} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('p-2 rounded-xl shrink-0', c.bg)}>
            <User size={18} className={c.text} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{selfie.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{selfie.phone}</p>
          </div>
        </div>

        {/* Elapsed */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock size={12} className="text-zinc-600" />
          <span className="text-xs tabular-nums text-zinc-500">{elapsed}</span>
        </div>
      </div>

      {/* Current step badge + ETA */}
      <div className="mt-4 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1',
            c.bg,
            c.text,
            'border',
            c.border,
            'rounded-full text-xs font-medium',
          )}
        >
          <Icon size={12} />
          {label}
          {!isCompleted && !isFailed && <Loader2 size={10} className="animate-spin ml-0.5" />}
        </span>

        <span className="text-[10px] text-zinc-600">{formatTime(selfie.created_at)}</span>
      </div>

      {/* Estimated time remaining */}
      {!isCompleted && !isFailed && (() => {
        const remaining = estimateRemainingSeconds(selfie.status);
        if (remaining === null) return null;
        return (
          <div className="mt-2 flex items-center gap-1.5">
            <Hourglass size={11} className="text-zinc-600" />
            <span className="text-[11px] text-zinc-500">
              Finaliza em <span className="text-zinc-300 font-medium">{formatSeconds(remaining)}</span>
            </span>
          </div>
        );
      })()}

      {/* Error message */}
      {isFailed && selfie.error_message && (
        <p className="mt-3 text-xs text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2 line-clamp-2">
          {selfie.error_message}
        </p>
      )}

      {/* Progress bar */}
      <StepProgress status={selfie.status} />

      {/* Play button for completed */}
      {isCompleted && selfie.videoUrl && (
        <button
          onClick={() => onPlay(selfie)}
          className={cn(
            'mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5',
            'bg-emerald-500 hover:bg-emerald-400',
            'text-black font-semibold text-sm',
            'rounded-xl',
            'shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30',
            'active:scale-[0.97]',
            'transition-all duration-200',
          )}
        >
          <Play size={14} />
          Assistir video
        </button>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SelfieMonitorPage() {
  const [selfies, setSelfies] = useState<Selfie[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingSelfie, setPlayingSelfie] = useState<Selfie | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/selfie-video/monitor', { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      setSelfies(json.selfies ?? []);
    } catch {
      // silently retry on next interval
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 3 seconds
  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const failed = selfies.filter((s) => s.status === 'failed' && !s.whatsapp_sent);
  const completed = selfies.filter((s) => s.status === 'completed' || s.whatsapp_sent);
  const inProgress = selfies.filter((s) => !completed.includes(s) && !failed.includes(s));

  return (
    <div className="min-h-screen bg-black">
      {/* Decorative orbs */}
      <div className="fixed -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Activity size={28} className="text-emerald-400" />
              Monitor de Videos
            </h1>
            <p className="text-zinc-500 mt-1">Pipeline de video selfie em tempo real</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-zinc-400">{inProgress.length} processando</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full">
              <Check size={12} className="text-emerald-400" />
              <span className="text-xs text-zinc-400">{completed.length} concluidos</span>
            </div>
            {failed.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/5 border border-red-500/20 rounded-full">
                <AlertCircle size={12} className="text-red-400" />
                <span className="text-xs text-red-400">{failed.length} falhas</span>
              </div>
            )}
            <button
              onClick={fetchData}
              className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-200"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 bg-zinc-900/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && selfies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
              <Film size={32} className="text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm">Nenhum video nas ultimas 24 horas</p>
          </div>
        )}

        {/* In progress section */}
        {inProgress.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white tracking-tight mb-4 flex items-center gap-2">
              <Loader2 size={18} className="text-sky-400 animate-spin" />
              Em processamento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {inProgress.map((s) => (
                <SelfieCard key={s.id} selfie={s} onPlay={setPlayingSelfie} />
              ))}
            </div>
          </section>
        )}

        {/* Completed section */}
        {completed.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white tracking-tight mb-4 flex items-center gap-2">
              <Check size={18} className="text-emerald-400" />
              Concluidos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {completed.map((s) => (
                <SelfieCard key={s.id} selfie={s} onPlay={setPlayingSelfie} />
              ))}
            </div>
          </section>
        )}

        {/* Failed section */}
        {failed.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white tracking-tight mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-red-400" />
              Falhas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {failed.map((s) => (
                <SelfieCard key={s.id} selfie={s} onPlay={setPlayingSelfie} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Video modal */}
      {playingSelfie?.videoUrl && (
        <VideoModal url={playingSelfie.videoUrl} name={playingSelfie.name} onClose={() => setPlayingSelfie(null)} />
      )}
    </div>
  );
}
