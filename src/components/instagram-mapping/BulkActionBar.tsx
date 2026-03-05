'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UserPlus, Send, X, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ConfirmModal, type SendChannel } from './ConfirmModal';

interface BulkTarget {
  username: string;
  displayName: string;
  message?: string;
}

interface BulkActionBarProps {
  selectedCount: number;
  targets: BulkTarget[];
  onClearSelection: () => void;
  hasSession: boolean;
  onNoSession: () => void;
  onActionComplete: (action: 'follow' | 'send-dm', results: Array<{ username: string; success: boolean }>) => void;
}

interface BulkResult {
  username: string;
  success: boolean;
  error?: string;
}

export function BulkActionBar({
  selectedCount,
  targets,
  onClearSelection,
  hasSession,
  onNoSession,
  onActionComplete,
}: BulkActionBarProps) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'follow' | 'send-dm' | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [confirmAction, setConfirmAction] = useState<'follow' | 'send-dm' | null>(null);

  if (selectedCount === 0 && !results) return null;

  const handleAction = async (type: 'follow' | 'send-dm') => {
    if (!hasSession) {
      onNoSession();
      return;
    }
    setConfirmAction(type);
  };

  const executeAction = async (channel?: SendChannel) => {
    const type = confirmAction!;
    setConfirmAction(null);

    // WhatsApp flow not yet implemented — just close the modal
    if (channel === 'whatsapp' || channel === 'both') {
      // TODO: implement WhatsApp sending
      return;
    }

    setLoading(true);
    setAction(type);
    setResults(null);

    try {
      const body = {
        action: type,
        targets: targets.map((t) => ({
          username: t.username,
          message: t.message,
        })),
      };

      const res = await fetch('/api/instagram-mapping/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setResults(targets.map((t) => ({ username: t.username, success: false, error: data.error })));
      } else {
        setResults(data.results);
        onActionComplete(type, data.results);
      }
    } catch {
      setResults(targets.map((t) => ({ username: t.username, success: false, error: 'Erro de conexão' })));
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const successCount = results?.filter((r) => r.success).length || 0;
  const failCount = results?.filter((r) => !r.success).length || 0;

  return (
    <>
      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeAction}
        title={confirmAction === 'follow' ? `Seguir ${selectedCount} perfis?` : `Enviar mensagem para ${selectedCount} perfis?`}
        description={
          confirmAction === 'follow'
            ? `Confirma seguir ${selectedCount} perfis?`
            : `Confirma o envio de mensagem para ${selectedCount} perfis?`
        }
        confirmLabel={confirmAction === 'follow' ? 'Seguir todos' : 'Enviar todas'}
        confirmIcon={confirmAction === 'follow' ? <UserPlus size={14} /> : <Send size={14} />}
        variant="warning"
        showChannelPicker={confirmAction === 'send-dm'}
      />

      {/* Floating bar */}
      <div className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
        'bg-zinc-900/95 backdrop-blur-2xl',
        'border border-white/[0.1]',
        'rounded-2xl shadow-2xl shadow-black/50',
        'px-5 py-3',
        'flex items-center gap-4',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
      )}>
        {loading ? (
          <div className="flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-emerald-400" />
            <p className="text-sm text-zinc-300">
              {action === 'follow' ? 'Seguindo' : 'Enviando mensagens'} ({selectedCount} perfis)...
            </p>
          </div>
        ) : results ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {successCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 size={12} /> {successCount} OK
                </span>
              )}
              {failCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-red-400">
                  <XCircle size={12} /> {failCount} falha
                </span>
              )}
            </div>
            <button
              onClick={() => { setResults(null); onClearSelection(); }}
              className="text-xs text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                {selectedCount}
              </span>
              <p className="text-sm text-zinc-300">selecionados</p>
            </div>

            <div className="h-5 w-px bg-zinc-700/50" />

            <button
              onClick={() => handleAction('follow')}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2',
                'bg-white/[0.06] hover:bg-emerald-500/15',
                'border border-white/[0.1] hover:border-emerald-500/30',
                'rounded-xl text-xs font-medium text-zinc-300 hover:text-emerald-300',
                'transition-all duration-200',
              )}
            >
              <UserPlus size={12} />
              Seguir todos
            </button>

            <button
              onClick={() => handleAction('send-dm')}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2',
                'bg-white/[0.06] hover:bg-emerald-500/15',
                'border border-white/[0.1] hover:border-emerald-500/30',
                'rounded-xl text-xs font-medium text-zinc-300 hover:text-emerald-300',
                'transition-all duration-200',
              )}
            >
              <Send size={12} />
              Mensagem para todos
            </button>

            <button
              onClick={onClearSelection}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors duration-200"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </>
  );
}
