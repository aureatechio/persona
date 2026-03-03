'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { UserPlus } from 'lucide-react';
import { ALL_CATEGORIES, CATEGORY_MAP } from '@/lib/instagram-mapping/categories';
import type { FollowerCategory } from '@/lib/instagram-mapping/types';

interface AddFollowerModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  onAdded: () => void;
}

export function AddFollowerModal({ open, onClose, accountId, onAdded }: AddFollowerModalProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [category, setCategory] = useState<FollowerCategory>('outro');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/instagram-mapping/followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          username: username.trim().replace(/^@/, ''),
          display_name: displayName.trim() || null,
          ai_summary: aiSummary.trim() || null,
          category,
          category_label: categoryLabel.trim() || CATEGORY_MAP[category].label,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao adicionar seguidor');
      }

      // Reset form
      setUsername('');
      setDisplayName('');
      setAiSummary('');
      setCategory('outro');
      setCategoryLabel('');
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = cn(
    'w-full px-4 py-3',
    'bg-white/[0.04] hover:bg-white/[0.06]',
    'border border-white/[0.08] focus:border-emerald-500/50',
    'rounded-xl text-sm text-white placeholder:text-zinc-600',
    'outline-none focus:ring-2 focus:ring-emerald-500/20',
    'transition-all duration-200',
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar Seguidor"
      description="Cadastre um novo seguidor com resumo e categoria"
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5',
              'bg-white/[0.05] hover:bg-white/[0.1]',
              'text-zinc-300 hover:text-white',
              'border border-white/[0.08] hover:border-white/[0.15]',
              'rounded-xl font-medium text-sm',
              'active:scale-[0.97] transition-all duration-200',
            )}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!username.trim() || saving}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5',
              'bg-emerald-500 hover:bg-emerald-400',
              'text-black font-semibold text-sm',
              'rounded-xl',
              'shadow-lg shadow-emerald-500/25',
              'active:scale-[0.97] transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <UserPlus size={15} />
                Adicionar
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">
            Username *
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@handle do seguidor"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">
            Nome
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nome de exibicao"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">
            Categoria
          </label>
          <select
            value={category}
            onChange={(e) => {
              const val = e.target.value as FollowerCategory;
              setCategory(val);
              setCategoryLabel(CATEGORY_MAP[val].label);
            }}
            className={cn(inputClass, 'appearance-none cursor-pointer')}
          >
            {ALL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-zinc-900">
                {CATEGORY_MAP[cat].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">
            Resumo IA
          </label>
          <textarea
            value={aiSummary}
            onChange={(e) => setAiSummary(e.target.value)}
            placeholder="Analise do perfil: interesses, comportamento, posicionamentos..."
            rows={4}
            className={cn(inputClass, 'resize-none')}
          />
        </div>
      </form>
    </Modal>
  );
}
