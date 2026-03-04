'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
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
} from 'lucide-react';

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

/* ─── 20 Tags — Colors ─── */

const GROUP_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  FAMILIA:      { bg: 'bg-amber-500/15',    text: 'text-amber-300',    border: 'border-amber-500/30',    glow: 'shadow-amber-500/10' },
  EMPREENDEDOR: { bg: 'bg-violet-500/15',   text: 'text-violet-300',   border: 'border-violet-500/30',   glow: 'shadow-violet-500/10' },
  FE:           { bg: 'bg-orange-500/15',    text: 'text-orange-300',   border: 'border-orange-500/30',   glow: 'shadow-orange-500/10' },
  ESPORTE:      { bg: 'bg-emerald-500/15',   text: 'text-emerald-300',  border: 'border-emerald-500/30',  glow: 'shadow-emerald-500/10' },
  EDUCACAO:     { bg: 'bg-teal-500/15',      text: 'text-teal-300',     border: 'border-teal-500/30',     glow: 'shadow-teal-500/10' },
  SAUDE:        { bg: 'bg-rose-500/15',      text: 'text-rose-300',     border: 'border-rose-500/30',     glow: 'shadow-rose-500/10' },
  TECH:         { bg: 'bg-cyan-500/15',      text: 'text-cyan-300',     border: 'border-cyan-500/30',     glow: 'shadow-cyan-500/10' },
  POLITICA:     { bg: 'bg-red-500/15',       text: 'text-red-300',      border: 'border-red-500/30',      glow: 'shadow-red-500/10' },
  MODA:         { bg: 'bg-fuchsia-500/15',   text: 'text-fuchsia-300',  border: 'border-fuchsia-500/30',  glow: 'shadow-fuchsia-500/10' },
  ARTE:         { bg: 'bg-purple-500/15',    text: 'text-purple-300',   border: 'border-purple-500/30',   glow: 'shadow-purple-500/10' },
  MUSICA:       { bg: 'bg-indigo-500/15',    text: 'text-indigo-300',   border: 'border-indigo-500/30',   glow: 'shadow-indigo-500/10' },
  GASTRONOMIA:  { bg: 'bg-yellow-500/15',    text: 'text-yellow-300',   border: 'border-yellow-500/30',   glow: 'shadow-yellow-500/10' },
  AGRO:         { bg: 'bg-lime-500/15',      text: 'text-lime-300',     border: 'border-lime-500/30',     glow: 'shadow-lime-500/10' },
  PET:          { bg: 'bg-amber-400/15',     text: 'text-amber-200',    border: 'border-amber-400/30',    glow: 'shadow-amber-400/10' },
  VIAGEM:       { bg: 'bg-sky-500/15',       text: 'text-sky-300',      border: 'border-sky-500/30',      glow: 'shadow-sky-500/10' },
  FITNESS:      { bg: 'bg-green-500/15',     text: 'text-green-300',    border: 'border-green-500/30',    glow: 'shadow-green-500/10' },
  JURIDICO:     { bg: 'bg-slate-400/15',     text: 'text-slate-300',    border: 'border-slate-400/30',    glow: 'shadow-slate-400/10' },
  INFLUENCER:   { bg: 'bg-pink-500/15',      text: 'text-pink-300',     border: 'border-pink-500/30',     glow: 'shadow-pink-500/10' },
  COMUNIDADE:   { bg: 'bg-blue-500/15',      text: 'text-blue-300',     border: 'border-blue-500/30',     glow: 'shadow-blue-500/10' },
  LIFESTYLE:    { bg: 'bg-pink-400/15',      text: 'text-pink-200',     border: 'border-pink-400/30',     glow: 'shadow-pink-400/10' },
  OUTRO:        { bg: 'bg-zinc-500/15',      text: 'text-zinc-300',     border: 'border-zinc-500/30',     glow: 'shadow-zinc-500/10' },
};

const GROUP_LABELS: Record<string, string> = {
  FAMILIA: 'Família', EMPREENDEDOR: 'Empreendedor', FE: 'Fé', ESPORTE: 'Esporte',
  EDUCACAO: 'Educação', SAUDE: 'Saúde', TECH: 'Tech', POLITICA: 'Política',
  MODA: 'Moda', ARTE: 'Arte', MUSICA: 'Música', GASTRONOMIA: 'Gastronomia',
  AGRO: 'Agro', PET: 'Pet', VIAGEM: 'Viagem', FITNESS: 'Fitness',
  JURIDICO: 'Jurídico', INFLUENCER: 'Influencer', COMUNIDADE: 'Comunidade', LIFESTYLE: 'Lifestyle',
  OUTRO: 'Outro',
};

function getGroupColor(grupo: string) {
  return GROUP_COLORS[grupo] || GROUP_COLORS.OUTRO;
}

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

  // Convert text to uppercase
  const upperFrase = frase.toUpperCase();

  // Text centered in the upper area of the image
  const textAreaMaxWidth = w * 0.75;
  const textCenterX = w * 0.5;
  const textStartY = h * 0.08;

  // Only reduce font size for very long texts (180+ chars)
  const charCount = upperFrase.length;
  let fontScale = 0.035;
  if (charCount > 220) fontScale = 0.028;
  else if (charCount > 180) fontScale = 0.031;

  const fontSize = Math.round(w * fontScale);
  ctx.font = `700 ${fontSize}px "Manrope", "Inter", "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Word wrap
  const words = upperFrase.split(' ');
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
    img.onload = () => {
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
  isRegenerating?: boolean;
}

export function FollowerRow({ data, index, campaignImageUrl, isRegenerating }: FollowerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
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
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-1.5 text-left cursor-pointer"
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

                  {/* Arte de campanha — clicável */}
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
                disabled
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2',
                  'bg-white/[0.06] border border-white/[0.1]',
                  'rounded-xl text-xs font-medium text-zinc-300',
                  'cursor-not-allowed',
                  'hover:bg-white/[0.1] hover:border-white/[0.18] hover:text-zinc-200',
                  'transition-all duration-200',
                )}
              >
                <UserPlus size={12} />
                Seguir
              </button>
              <button
                type="button"
                disabled
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2',
                  'bg-white/[0.06] border border-white/[0.1]',
                  'rounded-xl text-xs font-medium text-zinc-300',
                  'cursor-not-allowed',
                  'hover:bg-white/[0.1] hover:border-white/[0.18] hover:text-zinc-200',
                  'transition-all duration-200',
                )}
              >
                <Send size={12} />
                Mensagem
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
