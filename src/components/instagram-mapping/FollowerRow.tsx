'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Briefcase,
  TrendingUp,
  Users,
  ImageIcon,
  ExternalLink,
  Sparkles,
  DollarSign,
  Vote,
  Tag,
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
  };
  category: string;
  profile: {
    biography: string;
    followers_count: number;
    follows_count: number;
    posts_count: number;
  };
}

const GROUP_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  FUTEBOL:        { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/10' },
  FAMILIA:        { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/30',   glow: 'shadow-amber-500/10' },
  POLITICA:       { bg: 'bg-red-500/15',     text: 'text-red-300',     border: 'border-red-500/30',     glow: 'shadow-red-500/10' },
  EMPREENDEDOR:   { bg: 'bg-violet-500/15',  text: 'text-violet-300',  border: 'border-violet-500/30',  glow: 'shadow-violet-500/10' },
  FE:             { bg: 'bg-orange-500/15',   text: 'text-orange-300',  border: 'border-orange-500/30',  glow: 'shadow-orange-500/10' },
  LIFESTYLE:      { bg: 'bg-pink-500/15',    text: 'text-pink-300',    border: 'border-pink-500/30',    glow: 'shadow-pink-500/10' },
  MODA:           { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30', glow: 'shadow-fuchsia-500/10' },
  TECH:           { bg: 'bg-cyan-500/15',    text: 'text-cyan-300',    border: 'border-cyan-500/30',    glow: 'shadow-cyan-500/10' },
  SAUDE:          { bg: 'bg-rose-500/15',    text: 'text-rose-300',    border: 'border-rose-500/30',    glow: 'shadow-rose-500/10' },
  EDUCACAO:       { bg: 'bg-teal-500/15',    text: 'text-teal-300',    border: 'border-teal-500/30',    glow: 'shadow-teal-500/10' },
  ENTRETENIMENTO: { bg: 'bg-indigo-500/15',  text: 'text-indigo-300',  border: 'border-indigo-500/30',  glow: 'shadow-indigo-500/10' },
  OUTRO:          { bg: 'bg-zinc-500/15',    text: 'text-zinc-300',    border: 'border-zinc-500/30',    glow: 'shadow-zinc-500/10' },
};

function getGroupColor(grupo: string) {
  return GROUP_COLORS[grupo] || GROUP_COLORS.OUTRO;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
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
            {analysis.profissao && analysis.profissao !== 'indefinido' && (
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

          {/* Bio */}
          {profile.biography && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">Bio</p>
              <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3">{profile.biography}</p>
            </div>
          )}

          {/* Stats bar — mobile visible */}
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
              label="Profissao"
              value={analysis.profissao !== 'indefinido' ? analysis.profissao : '—'}
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
              label="Engaj. Politico"
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
