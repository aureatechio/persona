'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Camera, Instagram, Upload, X } from 'lucide-react';

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddAccountModal({ open, onClose, onAdded }: AddAccountModalProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem deve ter no maximo 5MB');
      return;
    }

    setAvatarFile(file);
    setError('');

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile) return null;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', avatarFile);

      const res = await fetch('/api/instagram-mapping/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha no upload');
      }

      const data = await res.json();
      return data.url;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setSaving(true);
    setError('');

    try {
      // Upload avatar first if present
      let avatarUrl: string | null = null;
      if (avatarFile) {
        avatarUrl = await uploadAvatar();
      }

      const res = await fetch('/api/instagram-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().replace(/^@/, ''),
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl,
          bio: bio.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao cadastrar perfil');
      }

      // Reset form
      setUsername('');
      setDisplayName('');
      setBio('');
      removeAvatar();
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
    'border border-white/[0.08] focus:border-pink-500/50',
    'rounded-xl text-sm text-white placeholder:text-zinc-600',
    'outline-none focus:ring-2 focus:ring-pink-500/20',
    'transition-all duration-200',
  );

  const isBusy = saving || uploading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Perfil Instagram"
      description="Cadastre um novo perfil para mapeamento de seguidores"
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={isBusy}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5',
              'bg-white/[0.05] hover:bg-white/[0.1]',
              'text-zinc-300 hover:text-white',
              'border border-white/[0.08] hover:border-white/[0.15]',
              'rounded-xl font-medium text-sm',
              'active:scale-[0.97] transition-all duration-200',
              'disabled:opacity-50',
            )}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!username.trim() || isBusy}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5',
              'bg-gradient-to-r from-pink-500 to-violet-500',
              'hover:from-pink-400 hover:to-violet-400',
              'text-white font-semibold text-sm',
              'rounded-xl',
              'shadow-lg shadow-pink-500/25',
              'active:scale-[0.97] transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isBusy ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {uploading ? 'Enviando foto...' : 'Salvando...'}
              </>
            ) : (
              <>
                <Instagram size={15} />
                Cadastrar
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

        {/* Avatar upload */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">
            Foto do perfil
          </label>
          <div className="flex items-center gap-4">
            {/* Preview / Upload area */}
            {avatarPreview ? (
              <div className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarPreview}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-pink-500/30"
                />
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white grid place-content-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'w-20 h-20 rounded-full',
                  'bg-white/[0.04] hover:bg-white/[0.08]',
                  'border-2 border-dashed border-white/[0.12] hover:border-pink-500/40',
                  'grid place-content-center',
                  'transition-all duration-300',
                  'group/upload cursor-pointer',
                )}
              >
                <Camera size={22} className="text-zinc-600 group-hover/upload:text-pink-400 transition-colors duration-200" />
              </button>
            )}

            <div className="flex-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2.5',
                  'bg-white/[0.05] hover:bg-white/[0.1]',
                  'text-zinc-300 hover:text-white',
                  'border border-white/[0.08] hover:border-white/[0.15]',
                  'rounded-xl text-xs font-medium',
                  'active:scale-[0.97] transition-all duration-200',
                )}
              >
                <Upload size={13} />
                {avatarPreview ? 'Trocar foto' : 'Carregar foto'}
              </button>
              <p className="text-[10px] text-zinc-600 mt-1.5">
                JPG, PNG ou WebP. Max 5MB.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">
            Username *
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@handle do Instagram"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">
            Nome de exibicao
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nome visivel do perfil"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Descricao curta do perfil..."
            rows={3}
            className={cn(inputClass, 'resize-none')}
          />
        </div>
      </form>
    </Modal>
  );
}
