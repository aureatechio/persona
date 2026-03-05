'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getGroupColor, GROUP_LABELS } from '@/lib/instagram-groups';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Send as SendIcon,
  MessageCircle,
  Instagram,
  Clock,
  User,
} from 'lucide-react';

export interface MessageRow {
  id: string;
  target_username: string;
  display_name: string;
  avatar_url: string;
  grupo: string;
  message_content: string;
  channel: string;
  status: string;
  sent_at: string;
  error_message: string | null;
}

interface MessageTableProps {
  messages: MessageRow[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onViewProfile: (username: string) => void;
  onResend?: (message: MessageRow) => void;
}

const STATUS_BADGES: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  sent: { label: 'Enviado', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  pending: { label: 'Pendente', dot: 'bg-amber-400', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  failed: { label: 'Erro', dot: 'bg-red-400', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  delivered: { label: 'Entregue', dot: 'bg-sky-400', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  read: { label: 'Lido', dot: 'bg-violet-400', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
};

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const day = d.getDate();
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const month = months[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${hours}:${mins}`;
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/* ─── Avatar with fallback ─── */
function Avatar({ url, name, size = 40 }: { url: string; name: string; size?: number }) {
  const [error, setError] = useState(false);
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (!url || error) {
    return (
      <div
        className="rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0 border border-white/[0.06]"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] font-bold text-zinc-400">{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      onError={() => setError(true)}
      className="rounded-full object-cover shrink-0 border border-white/[0.06]"
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
}

/* ─── Message Card (card-style row) ─── */
function MessageCard({
  msg,
  onViewProfile,
  onResend,
  index,
}: {
  msg: MessageRow;
  onViewProfile: (username: string) => void;
  onResend?: (msg: MessageRow) => void;
  index: number;
}) {
  const groupColors = getGroupColor(msg.grupo);
  const statusBadge = STATUS_BADGES[msg.status] || STATUS_BADGES.sent;

  return (
    <div
      className={cn(
        'group relative',
        'bg-white/[0.015] hover:bg-white/[0.04]',
        'border border-white/[0.04] hover:border-white/[0.1]',
        'rounded-xl p-4',
        'transition-all duration-300 ease-out',
        'hover:shadow-lg hover:shadow-black/20',
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative">
          <Avatar url={msg.avatar_url} name={msg.display_name} size={44} />
          {/* Status indicator */}
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-black',
            statusBadge.dot,
          )} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: name, badges, time */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white truncate">{msg.display_name}</span>
            <span className="text-[10px] text-zinc-600">@{msg.target_username}</span>
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5',
                groupColors.bg, groupColors.text, groupColors.border,
                'border rounded-md text-[9px] font-semibold',
              )}>
                {GROUP_LABELS[msg.grupo] || msg.grupo}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5',
                statusBadge.bg, statusBadge.text, statusBadge.border,
                'border rounded-md text-[9px] font-semibold',
              )}>
                <span className={cn('w-1 h-1 rounded-full', statusBadge.dot)} />
                {statusBadge.label}
              </span>
            </div>
          </div>

          {/* Message content */}
          <p className="text-[13px] text-zinc-400 leading-relaxed line-clamp-2 mb-2">
            {msg.message_content}
          </p>

          {/* Bottom row: meta + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Channel */}
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600">
                <Instagram size={10} className="text-pink-400/60" />
                Instagram DM
              </span>
              {/* Time */}
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600">
                <Clock size={9} />
                {formatDate(msg.sent_at)}
              </span>
              <span className="text-[9px] text-zinc-700">{timeAgo(msg.sent_at)} atras</span>
            </div>

            {/* Actions (appear on hover) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={() => onViewProfile(msg.target_username)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5',
                  'bg-white/[0.04] hover:bg-white/[0.08]',
                  'border border-white/[0.06] hover:border-white/[0.12]',
                  'rounded-lg text-[10px] text-zinc-400 hover:text-white',
                  'transition-all duration-200',
                )}
              >
                <ExternalLink size={10} />
                Detalhes
              </button>
              {onResend && (
                <button
                  onClick={() => onResend(msg)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1.5',
                    'bg-emerald-500/10 hover:bg-emerald-500/20',
                    'border border-emerald-500/20 hover:border-emerald-500/30',
                    'rounded-lg text-[10px] text-emerald-400',
                    'transition-all duration-200',
                  )}
                >
                  <RefreshCw size={10} />
                  Reenviar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessageTable({
  messages,
  loading,
  page,
  totalPages,
  onPageChange,
  onViewProfile,
  onResend,
}: MessageTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="relative h-[100px] bg-zinc-900/20 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.015] to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn(
        'bg-white/[0.02] border border-white/[0.06] rounded-2xl',
        'flex flex-col items-center justify-center py-20',
      )}>
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 flex items-center justify-center">
            <MessageCircle size={28} className="text-zinc-700" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-[8px] text-zinc-600">0</span>
          </div>
        </div>
        <p className="text-zinc-400 text-sm font-medium">Nenhuma mensagem encontrada</p>
        <p className="text-zinc-600 text-xs mt-1.5 max-w-[280px] text-center leading-relaxed">
          Dispare mensagens na tela de Mapeamento Instagram para visualizar o historico aqui
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-zinc-500" />
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            Historico de Disparos
          </span>
          <span className="text-[10px] text-zinc-700 font-mono">
            ({messages.length} itens)
          </span>
        </div>
      </div>

      {/* Message cards */}
      <div className="space-y-2">
        {messages.map((msg, i) => (
          <MessageCard
            key={msg.id}
            msg={msg}
            onViewProfile={onViewProfile}
            onResend={onResend}
            index={i}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={cn(
              'p-2 rounded-xl border transition-all duration-200',
              'bg-white/[0.03] border-white/[0.06]',
              'hover:bg-white/[0.06] hover:border-white/[0.12]',
              'disabled:opacity-20 disabled:cursor-not-allowed',
              'text-zinc-400',
            )}
          >
            <ChevronLeft size={14} />
          </button>

          {/* Page numbers */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = page <= 3 ? i + 1 : page - 2 + i;
            if (p > totalPages || p < 1) return null;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  'w-8 h-8 rounded-xl text-xs font-medium',
                  'transition-all duration-200',
                  p === page
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-white/[0.03] text-zinc-500 border border-white/[0.04] hover:bg-white/[0.06] hover:text-zinc-300',
                )}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={cn(
              'p-2 rounded-xl border transition-all duration-200',
              'bg-white/[0.03] border-white/[0.06]',
              'hover:bg-white/[0.06] hover:border-white/[0.12]',
              'disabled:opacity-20 disabled:cursor-not-allowed',
              'text-zinc-400',
            )}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
