'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
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
  Eye,
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

function getGroupColor(grupo: string) {
  return GROUP_COLORS[grupo] || GROUP_COLORS.OUTRO;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
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

  // Text centered in the image
  const textAreaMaxWidth = w * 0.75;
  const textCenterX = w * 0.5;
  const textStartY = h * 0.15;

  // Font size
  const fontSize = Math.round(w * 0.035);
  ctx.font = `600 ${fontSize}px "Manrope", "Inter", "Segoe UI", Arial, sans-serif`;
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
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = fontSize * 0.4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = fontSize * 0.1;

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
}

function CampaignModal({ open, onClose, frase, displayName }: CampaignModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frase) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      renderCardCanvas(canvas, img, frase);
    };
    img.src = '/templates/campanha-base.jpg';
  }, [frase]);

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

interface FollowerRowProps {
  data: AnalyzedFollowerData;
  index: number;
}

export function FollowerRow({ data, index }: FollowerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [comVisible, setComVisible] = useState(false);
  const { analysis, profile } = data;
  const groupColor = getGroupColor(analysis.grupo);
  const initials = (data.display_name || data.username).slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'group relative',
        'bg-zinc-900/60 hover:bg-zinc-900/80',
        'border border-white/[0.08] hover:border-white/[0.16]',
        'rounded-2xl overflow-hidden',
        'shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30',
        'transition-all duration-300 ease-out',
        expanded && 'border-white/[0.12] shadow-xl',
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
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer"
      >
        {/* Avatar */}
        <div className="shrink-0 relative">
          {data.avatar_url && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.avatar_url}
              alt={data.username}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-11 h-11 rounded-full object-cover border-2 border-white/[0.12] shadow-md shadow-black/30"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border-2 border-white/[0.1] grid place-content-center text-xs font-bold text-zinc-300 shadow-md shadow-black/30">
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
          {profile.followers_count > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Users size={11} className="text-zinc-500" />
              <span className="font-medium tabular-nums">{formatNumber(profile.followers_count)}</span>
            </div>
          )}
          {profile.posts_count > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <ImageIcon size={11} className="text-zinc-500" />
              <span className="font-medium tabular-nums">{formatNumber(profile.posts_count)}</span>
            </div>
          )}
        </div>

        {/* Group tag */}
        <div className="shrink-0">
          <span
            className={cn(
              'inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
              'shadow-sm',
              groupColor.bg,
              groupColor.text,
              groupColor.border,
              groupColor.glow,
            )}
          >
            {analysis.grupo}
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

          {/* ── Como se comunicar — colapsável (surpresa) ── */}
          {analysis.frase_comunicacao && (
            <div className="space-y-0">
              <button
                type="button"
                onClick={() => setComVisible(!comVisible)}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-5 py-3.5',
                  'rounded-2xl border transition-all duration-300 cursor-pointer',
                  comVisible
                    ? 'bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.04] to-transparent border-emerald-500/20'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] hover:border-emerald-500/30',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/15">
                    <MessageCircle size={13} className="text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                    Como se comunicar
                  </span>
                </div>
                <div className={cn(
                  'p-1 rounded-lg transition-all duration-200',
                  comVisible ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500',
                )}>
                  {comVisible ? <ChevronUp size={14} /> : <Eye size={14} />}
                </div>
              </button>

              {comVisible && (
                <div className="mt-3 flex gap-4 items-stretch animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Frase */}
                  <div className="relative flex-1 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.04] to-transparent">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative p-5 flex flex-col justify-center h-full">
                      <p className="text-base md:text-lg leading-relaxed text-zinc-100">
                        <span className="font-bold text-white">{analysis.frase_comunicacao}</span>
                      </p>
                    </div>
                  </div>

                  {/* Arte de campanha — clicável */}
                  <div
                    className="shrink-0 w-[180px] md:w-[220px] relative overflow-hidden rounded-2xl border border-white/[0.1] cursor-pointer group/art hover:border-white/[0.2] transition-all duration-300 hover:shadow-xl hover:shadow-black/40"
                    onClick={() => setModalOpen(true)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/templates/campanha-base.jpg"
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
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
                  />
                </div>
              )}
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
              value={analysis.profissao !== 'indefinido' && analysis.profissao !== 'Indefinido' ? analysis.profissao : '—'}
            />
            <DetailChip
              icon={<DollarSign size={12} />}
              label="Renda"
              value={analysis.renda_estimada !== 'indefinido'
                ? analysis.renda_estimada.charAt(0).toUpperCase() + analysis.renda_estimada.slice(1)
                : '—'}
            />
            <DetailChip
              icon={<Vote size={12} />}
              label="Engaj. Político"
              value={analysis.engajamento_politico !== 'indefinido'
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

          {/* Instagram link */}
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
