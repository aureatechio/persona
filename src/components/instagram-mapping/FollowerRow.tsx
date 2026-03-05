'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronDown,
  Briefcase,
  Users,
  ImageIcon,
  ExternalLink,
  Sparkles,
  DollarSign,
  Vote,
  Tag,
  MessageCircle,
  X,
  Maximize2,
  Play,
  Loader2,
  Pause,
  UserPlus,
  Send,
  AlertCircle,
} from 'lucide-react';
import type { VoiceModelState } from './VoiceModelModal';

export interface AnalyzedFollowerData {
  username: string;
  display_name: string;
  avatar_url: string;
  analysis: {
    resumo: string;
    genero: string;
    faixa_etaria: string;
    renda_estimada: string;
    profissao: string;
    grupo: string;
    engajamento_politico: string;
    temas_interesse: string[];
    categoria: string;
    categoria_label: string;
    frase_comunicacao?: string;
  };
  category: string;
  profile: {
    biography: string;
    followers_count: number;
    follows_count: number;
    posts_count: number;
  };
}

/* ─── 20 Tags — Colors (shared) ─── */

import { GROUP_COLORS, GROUP_LABELS, getGroupColor } from '@/lib/instagram-groups';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ─── Audio Helpers ─── */

function formatAudioTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function generateWaveform(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i);
    h |= 0;
  }
  return Array.from({ length: count }, (_, i) => {
    h = ((h * 1103515245 + 12345) & 0x7fffffff);
    const base = 0.25 + Math.sin(i * 0.4 + (h % 7)) * 0.15;
    const noise = (h % 100) / 100;
    return Math.min(1, Math.max(0.08, base + noise * 0.6));
  });
}

/* ─── Canvas: render phrase text on top of template image ─── */

function renderCardCanvas(
  canvas: HTMLCanvasElement,
  templateImg: HTMLImageElement,
  frase: string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = templateImg.naturalWidth;
  const h = templateImg.naturalHeight;
  canvas.width = w;
  canvas.height = h;

  // Draw original template — untouched
  ctx.drawImage(templateImg, 0, 0, w, h);

  if (!frase) return;

  // Text centered in the upper area of the image
  const textAreaMaxWidth = w * 0.75;
  const textCenterX = w * 0.5;
  const textStartY = h * 0.08;

  // Only reduce font size for very long texts (180+ chars)
  const charCount = frase.length;
  let fontScale = 0.035;
  if (charCount > 220) fontScale = 0.028;
  else if (charCount > 180) fontScale = 0.031;

  const fontSize = Math.round(w * fontScale);
  ctx.font = `600 ${fontSize}px "Raleway", "Manrope", "Inter", "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Word wrap
  const words = frase.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > textAreaMaxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.6;

  // White text with clean drop shadow
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = fontSize * 0.3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = fontSize * 0.08;

  lines.forEach((line, i) => {
    ctx.fillText(line, textCenterX, textStartY + i * lineHeight);
  });

  ctx.shadowColor = 'transparent';
}

/* ─── Fullscreen Campaign Modal (Canvas-rendered text) ─── */

interface CampaignModalProps {
  open: boolean;
  onClose: () => void;
  frase: string;
  displayName: string;
  campaignImageUrl?: string;
}

function CampaignModal({ open, onClose, frase, displayName, campaignImageUrl }: CampaignModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frase) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      // Wait for Raleway font to be available for canvas rendering
      await document.fonts.ready;
      renderCardCanvas(canvas, img, frase);
    };
    img.src = campaignImageUrl || '/templates/campanha-base.jpg';
  }, [frase, campaignImageUrl]);

  // Render every time modal opens (canvas is fresh each mount)
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => renderCanvas());
    }
  }, [open, renderCanvas]);

  // Escape key + body scroll lock
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 z-10 p-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] text-zinc-300 hover:text-white transition-all duration-200 active:scale-[0.95]"
      >
        <X size={20} />
      </button>

      {/* Modal content */}
      <div
        className="relative w-[90vw] max-w-[520px] animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.12] shadow-2xl shadow-black/60">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
            aria-label={`Card de campanha - ${displayName}`}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GenderBadge({ genero }: { genero: string }) {
  if (genero === 'homem') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
        Homem
      </span>
    );
  }
  if (genero === 'mulher') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
        Mulher
      </span>
    );
  }
  return null;
}

/* ─── WhatsApp-style Audio Player ─── */

function WhatsAppPlayer({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  const BAR_COUNT = 63;
  const waveform = useMemo(() => generateWaveform(text, BAR_COUNT), [text]);

  // Reset when text changes (e.g. phrase regenerated)
  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, [text]);

  // Animation loop for progress
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
      if (!isNaN(audio.duration)) setDuration(audio.duration);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) rafRef.current = requestAnimationFrame(tick);
    else cancelAnimationFrame(rafRef.current);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  const handlePlayPause = useCallback(async () => {
    // Already loaded — toggle
    if (ready && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        setPlaying(true);
        await audioRef.current.play();
      }
      return;
    }

    // First time — generate via TTS
    setLoading(true);
    try {
      const res = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error('TTS failed');

      const blob = await res.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.playbackRate = speed;

      audio.onloadedmetadata = () => setDuration(audio.duration);
      audio.onended = () => {
        setPlaying(false);
        setCurrentTime(0);
      };

      setReady(true);
      setPlaying(true);
      setLoading(false);
      await audio.play();
    } catch (err) {
      console.error('[TTS] error:', err);
      setLoading(false);
    }
  }, [ready, playing, text, speed]);

  const handleSpeed = useCallback(() => {
    const speeds = [1, 1.5, 2];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  }, [duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (audioRef.current) audioRef.current.pause();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="bg-[#025144] rounded-lg px-2 py-2 transition-all duration-200">
      {/* Top row: icon + play + waveform + speed — all on same baseline */}
      <div className="flex items-center gap-1.5">
        {/* WhatsApp icon */}
        <div className="shrink-0 w-[40px] h-[40px] grid place-content-center">
          <svg viewBox="0 0 32 32" className="w-[36px] h-[36px]" fill="none">
            <path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.44 1.64 6.32L3 29l6.88-1.6A12.94 12.94 0 0016 29c7.18 0 13-5.82 13-13S23.18 3 16 3z" fill="#00a884"/>
            <path d="M22.36 19.18c-.35-.17-2.05-1.01-2.37-1.13-.32-.11-.55-.17-.78.17-.23.35-.9 1.13-1.1 1.36-.2.23-.41.26-.76.09-.35-.17-1.47-.54-2.8-1.73-1.04-.92-1.73-2.06-1.94-2.41-.2-.35-.02-.54.15-.71.16-.16.35-.41.52-.61.18-.21.23-.35.35-.59.12-.23.06-.44-.03-.61-.09-.17-.78-1.88-1.07-2.58-.28-.68-.57-.59-.78-.6h-.67c-.23 0-.61.09-.93.44-.32.35-1.22 1.19-1.22 2.9s1.25 3.37 1.42 3.6c.18.23 2.46 3.75 5.95 5.26.83.36 1.48.57 1.99.73.84.27 1.6.23 2.2.14.67-.1 2.05-.84 2.34-1.65.29-.81.29-1.5.2-1.65-.09-.14-.32-.23-.67-.4z" fill="#fff"/>
          </svg>
        </div>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={loading}
          className={cn(
            'shrink-0 w-8 h-8 grid place-content-center',
            'transition-all duration-150 active:scale-[0.9]',
            loading ? 'text-[#8aaea7] cursor-wait' : 'text-[#8aaea7] hover:text-[#a8cec7]',
          )}
        >
          {loading ? (
            <Loader2 size={22} className="animate-spin" />
          ) : playing ? (
            <Pause size={22} fill="currentColor" />
          ) : (
            <Play size={22} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        {/* Waveform */}
        <div
          className="relative flex-1 flex items-center gap-[1.5px] h-[28px] cursor-pointer min-w-0"
          onClick={handleSeek}
        >
          {waveform.map((h, i) => {
            const played = i / BAR_COUNT <= progress;
            return (
              <div
                key={i}
                className="flex-1 flex items-center justify-center"
                style={{ height: '100%' }}
              >
                <div
                  className={cn(
                    'w-[2.5px] rounded-full transition-colors duration-75',
                    played ? 'bg-[#b5d4cd]' : 'bg-[#57877e]',
                  )}
                  style={{ height: `${Math.max(8, h * 100)}%` }}
                />
              </div>
            );
          })}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-[11px] h-[11px] bg-[#d9ece8] rounded-full shadow-sm pointer-events-none z-10"
            style={{ left: `calc(${progress * 100}% - 5px)` }}
          />
        </div>

        {/* Speed */}
        <button
          type="button"
          onClick={handleSpeed}
          className={cn(
            'shrink-0 w-[30px] h-[22px] rounded-full grid place-content-center',
            'text-[10px] font-bold tabular-nums',
            'bg-[#16655a] text-[#8aaea7] hover:bg-[#1d7a6d] hover:text-[#a8cec7]',
            'transition-all duration-150 active:scale-[0.95]',
          )}
        >
          {speed}x
        </button>
      </div>

      {/* Bottom row: time under waveform area */}
      <div className="ml-[88px] mr-[38px]">
        <span className="text-[11px] text-[#6ba69d] tabular-nums leading-none">
          {ready ? formatAudioTime(currentTime) : '0:00'}
        </span>
      </div>
    </div>
  );
}

interface FollowerRowProps {
  data: AnalyzedFollowerData;
  index: number;
  campaignImageUrl?: string;
  voiceModel?: VoiceModelState;
  isRegenerating?: boolean;
  hasSession?: boolean;
  isFollowed?: boolean;
  isMessaged?: boolean;
  isSelected?: boolean;
  onFollow?: (username: string) => void;
  onMessage?: (username: string, displayName: string, defaultMessage: string) => void;
  onSelect?: (username: string, selected: boolean) => void;
}

export function FollowerRow({ data, index, campaignImageUrl, voiceModel, isRegenerating, hasSession, isFollowed, isMessaged, isSelected, onFollow, onMessage, onSelect }: FollowerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [localFollowed, setLocalFollowed] = useState(false);
  const { analysis, profile } = data;
  const groupColor = getGroupColor(analysis.grupo);
  const initials = (data.display_name || data.username).slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'group relative',
        'bg-zinc-900/60 hover:bg-zinc-900/80',
        'border border-white/[0.08] hover:border-white/[0.16]',
        'rounded-xl overflow-hidden',
        'shadow-sm shadow-black/10 hover:shadow-md hover:shadow-black/20',
        'transition-all duration-200 ease-out',
        expanded && 'border-white/[0.12] shadow-md',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Colored left accent bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl transition-all duration-300',
          expanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
        )}
        style={{
          background: `linear-gradient(to bottom, var(--tw-shadow-color, rgba(255,255,255,0.1)), transparent)`,
        }}
      />
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl transition-all duration-300',
          groupColor.text.replace('text-', 'bg-').replace('300', '500'),
          expanded ? 'opacity-80' : 'opacity-0 group-hover:opacity-40',
        )}
      />

      {/* Main row */}
      <div className="w-full flex items-center gap-3 px-4 py-1.5 text-left">
        {/* Selection checkbox */}
        {onSelect && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(data.username, !isSelected);
            }}
            className="shrink-0 group/check"
          >
            <div
              className={cn(
                'w-5 h-5 rounded-lg flex items-center justify-center transition-all duration-300',
                isSelected
                  ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30 scale-100'
                  : 'bg-white/[0.04] border border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/10 scale-100 group-hover/check:scale-110',
              )}
            >
              {isSelected && (
                <Check size={12} strokeWidth={3} className="text-black animate-in zoom-in-50 duration-200" />
              )}
            </div>
          </button>
        )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex-1 flex items-center gap-3 text-left cursor-pointer"
      >
        {/* Avatar */}
        <div className="shrink-0 relative">
          {data.avatar_url && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(data.avatar_url)}`}
              alt={data.username}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-9 h-9 rounded-full object-cover border-2 border-white/[0.12] shadow-md shadow-black/30"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border-2 border-white/[0.1] grid place-content-center text-[10px] font-bold text-zinc-300 shadow-md shadow-black/30">
              {initials}
            </div>
          )}
          {analysis.genero === 'homem' && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-sky-500 rounded-full border-2 border-zinc-900" />
          )}
          {analysis.genero === 'mulher' && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-pink-500 rounded-full border-2 border-zinc-900" />
          )}
        </div>

        {/* Name + username + profession */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              {data.display_name || data.username}
            </p>
            {analysis.faixa_etaria !== 'indefinido' && (
              <span className="hidden sm:inline-flex text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md font-medium">
                {analysis.faixa_etaria}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-zinc-500 truncate">@{data.username}</p>
            {analysis.profissao && analysis.profissao !== 'indefinido' && analysis.profissao !== 'Indefinido' && (
              <>
                <span className="text-zinc-700">·</span>
                <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
                  {analysis.profissao}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Stats pills */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <Users size={11} className="text-zinc-500 shrink-0" />
            <span className="font-medium tabular-nums w-[32px] text-right">{formatNumber(profile.followers_count || 0)}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <ImageIcon size={11} className="text-zinc-500 shrink-0" />
            <span className="font-medium tabular-nums w-[32px] text-right">{formatNumber(profile.posts_count || 0)}</span>
          </div>
        </div>

        {/* Group tag */}
        <div className="shrink-0">
          <span
            className={cn(
              'inline-flex items-center justify-center min-w-[120px] px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
              'shadow-sm',
              groupColor.bg,
              groupColor.text,
              groupColor.border,
              groupColor.glow,
            )}
          >
            {GROUP_LABELS[analysis.grupo] || analysis.grupo}
          </span>
        </div>

        {/* Expand chevron */}
        <div className={cn(
          'shrink-0 p-1 rounded-lg transition-all duration-200',
          expanded ? 'bg-white/[0.06] text-zinc-300' : 'text-zinc-600 group-hover:text-zinc-400',
        )}>
          <ChevronDown
            size={14}
            className={cn(
              'transition-transform duration-300',
              expanded && 'rotate-180',
            )}
          />
        </div>
      </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-white/[0.06] space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* AI Summary */}
          <div className="mt-4 flex gap-3">
            <div className="shrink-0 mt-0.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <Sparkles size={12} className="text-emerald-400" />
              </div>
            </div>
            <p className="text-sm text-zinc-200 leading-relaxed">{analysis.resumo}</p>
          </div>

          {/* ── Como se comunicar — sempre visível ── */}
          {analysis.frase_comunicacao && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 px-1">
                <div className="p-1.5 rounded-lg bg-emerald-500/15">
                  <MessageCircle size={13} className="text-emerald-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Como se comunicar
                </span>
              </div>

              <div className="flex gap-4 items-stretch">
                  {/* Frase + Audio */}
                  <div className="relative flex-1 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.04] to-transparent">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative p-5 flex flex-col justify-center h-full gap-5">
                      {isRegenerating ? (
                        <div className="flex items-center gap-3">
                          <Loader2 size={16} className="text-violet-400 animate-spin shrink-0" />
                          <span className="text-sm text-violet-300 animate-pulse">Regenerando frase...</span>
                        </div>
                      ) : (
                        <p className="text-base md:text-lg leading-relaxed text-zinc-100">
                          <span className="font-bold text-white">{analysis.frase_comunicacao}</span>
                        </p>
                      )}

                      {/* WhatsApp-style audio player */}
                      {analysis.frase_comunicacao && !isRegenerating && (
                        <WhatsAppPlayer text={analysis.frase_comunicacao} />
                      )}
                    </div>
                  </div>

                  {/* Arte de campanha OU Video lip-sync */}
                  {voiceModel && analysis.frase_comunicacao ? (
                    <LipSyncVideoPlayer
                      voiceModelId={voiceModel.id}
                      username={data.username}
                      phrase={analysis.frase_comunicacao}
                    />
                  ) : (
                    <>
                      <div
                        className="shrink-0 w-[180px] md:w-[220px] relative overflow-hidden rounded-2xl border border-emerald-500/20 cursor-pointer group/art hover:border-emerald-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 hover:scale-[1.03]"
                        onClick={() => setModalOpen(true)}
                      >
                        {/* Vibrant glow overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-emerald-500/10 z-[1] pointer-events-none" />
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none z-[1]" />
                        <div className="absolute -top-4 -left-4 w-20 h-20 bg-violet-500/15 rounded-full blur-2xl pointer-events-none z-[1]" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={campaignImageUrl || '/templates/campanha-base.jpg'}
                          alt=""
                          loading="eager"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover brightness-110 contrast-105 saturate-[1.2] group-hover/art:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/50 backdrop-blur-sm opacity-0 group-hover/art:opacity-100 transition-opacity duration-200">
                          <Maximize2 size={12} className="text-white/80" />
                        </div>
                        <div className="relative h-full min-h-[140px]" />
                      </div>

                      <CampaignModal
                        open={modalOpen}
                        onClose={() => setModalOpen(false)}
                        frase={analysis.frase_comunicacao || ''}
                        displayName={data.display_name || data.username}
                        campaignImageUrl={campaignImageUrl}
                      />
                    </>
                  )}
                </div>
            </div>
          )}

          {/* Bio */}
          {profile.biography && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">Bio</p>
              <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3">{profile.biography}</p>
            </div>
          )}

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-2">
            <StatMini
              icon={<Users size={12} />}
              label="Seguidores"
              value={formatNumber(profile.followers_count)}
            />
            <StatMini
              icon={<Users size={12} />}
              label="Seguindo"
              value={formatNumber(profile.follows_count)}
            />
            <StatMini
              icon={<ImageIcon size={12} />}
              label="Posts"
              value={formatNumber(profile.posts_count)}
            />
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <DetailChip
              icon={<Briefcase size={12} />}
              label="Profissão"
              value={analysis.profissao && analysis.profissao !== 'indefinido' && analysis.profissao !== 'Indefinido' ? analysis.profissao : '—'}
            />
            <DetailChip
              icon={<DollarSign size={12} />}
              label="Renda"
              value={analysis.renda_estimada && analysis.renda_estimada !== 'indefinido'
                ? analysis.renda_estimada.charAt(0).toUpperCase() + analysis.renda_estimada.slice(1)
                : '—'}
            />
            <DetailChip
              icon={<Vote size={12} />}
              label="Engaj. Político"
              value={analysis.engajamento_politico && analysis.engajamento_politico !== 'indefinido'
                ? analysis.engajamento_politico.charAt(0).toUpperCase() + analysis.engajamento_politico.slice(1)
                : '—'}
            />
            <DetailChip
              icon={<Tag size={12} />}
              label="Categoria"
              value={analysis.categoria_label || analysis.categoria}
            />
          </div>

          {/* Gender + Age badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <GenderBadge genero={analysis.genero} />
            {analysis.faixa_etaria !== 'indefinido' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-800/80 text-zinc-300 border border-zinc-700/40">
                {analysis.faixa_etaria} anos
              </span>
            )}
          </div>

          {/* Themes */}
          {analysis.temas_interesse && analysis.temas_interesse.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Temas de Interesse
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.temas_interesse.map((tema) => (
                  <span
                    key={tema}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/[0.06] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.1] transition-colors duration-200"
                  >
                    {tema}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <a
              href={`https://instagram.com/${data.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2',
                'bg-gradient-to-r from-pink-500/10 to-violet-500/10',
                'border border-pink-500/20 hover:border-pink-500/40',
                'rounded-xl text-xs font-medium text-pink-300 hover:text-pink-200',
                'transition-all duration-200 hover:shadow-lg hover:shadow-pink-500/10',
              )}
            >
              <ExternalLink size={12} />
              Ver perfil no Instagram
            </a>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isFollowed || localFollowed || followLoading || !hasSession}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!hasSession) { onFollow?.(data.username); return; }
                  setFollowLoading(true);
                  try {
                    const res = await fetch('/api/instagram-mapping/follow', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ targetUsername: data.username }),
                    });
                    if (res.ok) {
                      setLocalFollowed(true);
                      onFollow?.(data.username);
                    }
                  } finally {
                    setFollowLoading(false);
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2',
                  'rounded-xl text-xs font-medium',
                  'transition-all duration-200',
                  (isFollowed || localFollowed)
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 cursor-default'
                    : hasSession
                      ? 'bg-white/[0.06] border border-white/[0.1] text-zinc-300 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-300 active:scale-[0.97]'
                      : 'bg-white/[0.04] border border-white/[0.06] text-zinc-600 cursor-not-allowed',
                )}
              >
                {followLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <UserPlus size={12} />
                )}
                {(isFollowed || localFollowed) ? 'Seguindo' : 'Seguir'}
              </button>
              <button
                type="button"
                disabled={!hasSession}
                onClick={(e) => {
                  e.stopPropagation();
                  onMessage?.(data.username, data.display_name, analysis.frase_comunicacao || '');
                }}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2',
                  'rounded-xl text-xs font-medium',
                  'transition-all duration-200',
                  isMessaged
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 cursor-default'
                    : hasSession
                      ? 'bg-white/[0.06] border border-white/[0.1] text-zinc-300 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-300 active:scale-[0.97]'
                      : 'bg-white/[0.04] border border-white/[0.06] text-zinc-600 cursor-not-allowed',
                )}
              >
                <Send size={12} />
                {isMessaged ? 'Enviada' : 'Mensagem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatMini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-zinc-800/50 border border-white/[0.06] rounded-xl px-3 py-2.5">
      <span className="text-zinc-500">{icon}</span>
      <div>
        <p className="text-xs font-bold text-white tabular-nums">{value}</p>
        <p className="text-[9px] text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

function DetailChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-zinc-800/40 border border-white/[0.08] rounded-xl px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-zinc-400">{icon}</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </span>
      </div>
      <p className="text-xs text-white font-medium truncate">{value}</p>
    </div>
  );
}

/* ─── Simple Hash ─── */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/* ─── LipSync Video Player ─── */
function LipSyncVideoPlayer({ voiceModelId, username, phrase }: {
  voiceModelId: string;
  username: string;
  phrase: string;
}) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'failed'>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const phraseHash = useMemo(() => simpleHash(phrase), [phrase]);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(
          `/api/voice-model/poll-status?username=${encodeURIComponent(username)}&voice_model_id=${voiceModelId}&phrase_hash=${phraseHash}`,
        );
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'completed' && data.video_url) {
          setVideoUrl(data.video_url);
          setStatus('completed');
        } else if (data.status === 'generating_lipsync' || data.status === 'generating_tts') {
          setStatus('generating');
          startPolling();
        } else if (data.status === 'failed') {
          setStatus('failed');
        }
      } catch {
        // No record yet — stay idle
      }
    }

    check();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [voiceModelId, username, phraseHash]);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/voice-model/poll-status?username=${encodeURIComponent(username)}&voice_model_id=${voiceModelId}&phrase_hash=${phraseHash}`,
        );
        const data = await res.json();
        if (data.status === 'completed' && data.video_url) {
          setVideoUrl(data.video_url);
          setStatus('completed');
          clearInterval(pollRef.current);
        } else if (data.status === 'failed') {
          setStatus('failed');
          clearInterval(pollRef.current);
        }
      } catch {
        // Retry on next interval
      }
    }, 10000);
  }

  async function triggerGeneration() {
    setStatus('generating');
    try {
      await fetch('/api/voice-model/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_model_id: voiceModelId,
          username,
          phrase,
          phrase_hash: phraseHash,
        }),
      });
      startPolling();
    } catch {
      setStatus('failed');
    }
  }

  if (status === 'idle') {
    return (
      <div
        className={cn(
          'shrink-0 w-[180px] md:w-[220px] relative overflow-hidden rounded-2xl',
          'border border-violet-500/20 cursor-pointer group/art',
          'hover:border-violet-500/40 transition-all duration-300',
          'hover:shadow-xl hover:shadow-violet-500/10',
          'flex items-center justify-center bg-zinc-900/60 min-h-[140px]',
        )}
        onClick={triggerGeneration}
      >
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-violet-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 group-hover/art:bg-violet-500/20 transition-colors duration-200">
            <Play size={20} className="text-violet-400" />
          </div>
          <span className="text-xs text-zinc-400 group-hover/art:text-zinc-300 transition-colors duration-200">
            Gerar video personalizado
          </span>
        </div>
      </div>
    );
  }

  if (status === 'generating') {
    return (
      <div className={cn(
        'shrink-0 w-[180px] md:w-[220px] relative overflow-hidden rounded-2xl',
        'border border-violet-500/20',
        'flex items-center justify-center bg-zinc-900/60 min-h-[140px]',
      )}>
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none animate-pulse" />
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <Loader2 size={24} className="text-violet-400 animate-spin" />
          <span className="text-xs text-zinc-400 animate-pulse">Gerando video...</span>
          <span className="text-[10px] text-zinc-600">Pode levar 1-2 min</span>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        className={cn(
          'shrink-0 w-[180px] md:w-[220px] relative overflow-hidden rounded-2xl',
          'border border-red-500/20 cursor-pointer',
          'flex items-center justify-center bg-zinc-900/60 min-h-[140px]',
          'hover:border-red-500/30 transition-all duration-200',
        )}
        onClick={triggerGeneration}
      >
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <AlertCircle size={24} className="text-red-400" />
          <span className="text-xs text-red-300">Falha ao gerar</span>
          <span className="text-[10px] text-zinc-500">Clique para tentar novamente</span>
        </div>
      </div>
    );
  }

  // Completed: show video player
  return (
    <div className={cn(
      'shrink-0 w-[180px] md:w-[220px] relative overflow-hidden rounded-2xl',
      'border border-emerald-500/20 bg-black min-h-[140px]',
      'shadow-xl shadow-emerald-500/5',
    )}>
      <video
        src={videoUrl!}
        controls
        playsInline
        className="w-full h-full object-cover rounded-2xl"
        preload="metadata"
      />
    </div>
  );
}
