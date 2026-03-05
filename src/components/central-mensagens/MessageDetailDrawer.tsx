'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getGroupColor, GROUP_LABELS } from '@/lib/instagram-groups';
import {
  X,
  ExternalLink,
  Send,
  RefreshCw,
  Sparkles,
  Instagram,
  Loader2,
  MessageCircle,
} from 'lucide-react';

interface MessageLog {
  id: string;
  message_content: string;
  channel: string;
  status: string;
  sent_at: string;
}

interface FollowerDetail {
  username: string;
  display_name: string;
  avatar_url: string;
  grupo: string;
  resumo: string;
  frase_comunicacao: string;
  genero: string;
  faixa_etaria: string;
  profissao: string;
  biography: string;
  followers_count: number;
  posts_count: number;
}

interface MessageDetailDrawerProps {
  username: string | null;
  onClose: () => void;
  onResend?: (username: string, message: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  sent: 'Enviado', pending: 'Pendente', failed: 'Erro', delivered: 'Entregue', read: 'Lido',
};

export function MessageDetailDrawer({ username, onClose, onResend }: MessageDetailDrawerProps) {
  const [follower, setFollower] = useState<FollowerDetail | null>(null);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      // Fetch follower details
      const res = await fetch(`/api/central-mensagens/messages?search=${encodeURIComponent(username)}&per_page=100`);
      const data = await res.json();

      if (data.messages?.length > 0) {
        const first = data.messages[0];
        setFollower({
          username: first.target_username,
          display_name: first.display_name,
          avatar_url: first.avatar_url,
          grupo: first.grupo,
          resumo: '',
          frase_comunicacao: first.message_content,
          genero: '',
          faixa_etaria: '',
          profissao: '',
          biography: '',
          followers_count: 0,
          posts_count: 0,
        });
        setMessages(data.messages.map((m: Record<string, unknown>) => ({
          id: m.id,
          message_content: m.message_content,
          channel: m.channel,
          status: m.status,
          sent_at: m.sent_at,
        })));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!username) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [username, onClose]);

  if (!username) return null;

  const groupColors = follower ? getGroupColor(follower.grupo) : getGroupColor('OUTRO');

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={cn(
        'fixed right-0 top-0 bottom-0 w-full max-w-md z-50',
        'bg-zinc-950/98 backdrop-blur-2xl',
        'border-l border-white/[0.08]',
        'shadow-2xl shadow-black/60',
        'flex flex-col',
        'animate-in slide-in-from-right duration-300',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">Detalhes do Disparo</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-zinc-500" />
            </div>
          ) : follower ? (
            <>
              {/* Profile card */}
              <div className="flex items-center gap-4">
                {follower.avatar_url ? (
                  <img src={follower.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border border-white/[0.06]" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-zinc-800/80 flex items-center justify-center">
                    <Instagram size={20} className="text-zinc-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-white truncate">{follower.display_name}</p>
                  <p className="text-sm text-zinc-500">@{follower.username}</p>
                  <div className="mt-1.5">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5',
                      'border rounded-full text-[10px] font-medium',
                      groupColors.bg, groupColors.text, groupColors.border,
                    )}>
                      {GROUP_LABELS[follower.grupo] || follower.grupo}
                    </span>
                  </div>
                </div>
              </div>

              {/* Link to Instagram */}
              <a
                href={`https://instagram.com/${follower.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2',
                  'bg-white/[0.04] hover:bg-white/[0.08]',
                  'border border-white/[0.06] hover:border-white/[0.12]',
                  'rounded-xl text-xs text-zinc-400 hover:text-white',
                  'transition-all duration-200',
                )}
              >
                <ExternalLink size={13} />
                Ver perfil no Instagram
              </a>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

              {/* Message history */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle size={14} className="text-zinc-500" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Historico de Mensagens ({messages.length})
                  </p>
                </div>

                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'bg-white/[0.03] border border-white/[0.06] rounded-xl p-3',
                        'space-y-2',
                      )}
                    >
                      <p className="text-sm text-zinc-300 leading-relaxed">{msg.message_content}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5',
                            'rounded-full text-[9px] font-medium border',
                            msg.status === 'sent' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' :
                            msg.status === 'failed' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                            'bg-amber-500/15 text-amber-400 border-amber-500/25',
                          )}>
                            {STATUS_LABELS[msg.status] || msg.status}
                          </span>
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5',
                            'bg-pink-500/10 text-pink-400 border border-pink-500/20',
                            'rounded-full text-[9px] font-medium',
                          )}>
                            {msg.channel === 'instagram_dm' ? 'Instagram DM' : msg.channel}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-600">
                          {msg.sent_at ? new Date(msg.sent_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          }) : '-'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-zinc-500 text-sm">Nenhum dado encontrado</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {follower && onResend && (
          <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3">
            <button
              onClick={() => onResend(follower.username, follower.frase_comunicacao)}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5',
                'bg-emerald-500 hover:bg-emerald-400',
                'text-black font-semibold text-sm rounded-xl',
                'shadow-lg shadow-emerald-500/25',
                'active:scale-[0.97] transition-all duration-200',
              )}
            >
              <Send size={14} />
              Reenviar Mensagem
            </button>
          </div>
        )}
      </div>
    </>
  );
}
