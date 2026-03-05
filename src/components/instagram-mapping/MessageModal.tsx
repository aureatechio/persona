'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Loader2, Send, AlertCircle, CheckCircle2 } from 'lucide-react';

interface MessageModalProps {
  open: boolean;
  onClose: () => void;
  targetUsername: string;
  targetDisplayName: string;
  defaultMessage: string;
  onSent: (username: string) => void;
}

export function MessageModal({
  open,
  onClose,
  targetUsername,
  targetDisplayName,
  defaultMessage,
  onSent,
}: MessageModalProps) {
  const [message, setMessage] = useState(defaultMessage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const handleSend = async () => {
    if (!message.trim()) {
      setError('A mensagem não pode estar vazia');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/instagram-mapping/send-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername, message: message.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao enviar mensagem');
        setLoading(false);
        return;
      }

      setSent(true);
      onSent(targetUsername);

      // Auto-close after 2s
      setTimeout(() => {
        onClose();
        setSent(false);
        setMessage(defaultMessage);
      }, 2000);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className={cn(
        'relative w-full max-w-lg',
        'bg-zinc-950 border border-white/[0.08]',
        'rounded-2xl shadow-2xl shadow-black/60',
        'overflow-hidden',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20">
              <Send size={16} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">Enviar Mensagem</h2>
              <p className="text-xs text-zinc-500">para @{targetUsername}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {sent ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="p-3 rounded-full bg-emerald-500/15 border border-emerald-500/20">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <p className="text-sm text-emerald-300 font-medium">
                Mensagem enviada para {targetDisplayName}!
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Mensagem
                  </label>
                  <span className="text-[10px] text-zinc-600">
                    Frase gerada pela IA (editável)
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={cn(
                    'w-full px-4 py-3',
                    'bg-white/[0.04] hover:bg-white/[0.06]',
                    'border border-white/[0.08] focus:border-emerald-500/50',
                    'rounded-xl text-sm text-white placeholder:text-zinc-600',
                    'outline-none focus:ring-2 focus:ring-emerald-500/20',
                    'transition-all duration-200',
                    'resize-none leading-relaxed',
                  )}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className={cn(
                    'px-5 py-2.5',
                    'bg-white/[0.05] hover:bg-white/[0.1]',
                    'text-zinc-300 hover:text-white',
                    'border border-white/[0.08]',
                    'rounded-xl font-medium text-sm',
                    'transition-all duration-200',
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5',
                    'bg-emerald-500 hover:bg-emerald-400',
                    'text-black font-semibold text-sm',
                    'rounded-xl',
                    'shadow-lg shadow-emerald-500/25',
                    'active:scale-[0.97]',
                    'transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Enviar DM
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
