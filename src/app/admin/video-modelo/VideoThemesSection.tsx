'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Film,
  ChevronDown,
  ChevronRight,
  Upload,
  Check,
  Loader2,
  AlertCircle,
  CircleSlash,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeRow {
  id: string;
  theme_slug: string;
  video_storage_path: string | null;
  is_uploaded: boolean;
  updated_at: string | null;
  themes_template: {
    label: string;
    category: string;
    priority: string | null;
    description: string;
    is_default: boolean;
    display_order: number;
  } | null;
}

interface Props {
  baseModelId: string | null;
}

export default function VideoThemesSection({ baseModelId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!expanded || !baseModelId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/video-modelo/themes?baseModelId=${baseModelId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao listar temas');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setThemes(data.themes || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, baseModelId]);

  if (!baseModelId) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Film size={18} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Vídeos por tema</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Salve o modelo primeiro pra subir os 30 vídeos dos temas + vídeo padrão.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const uploadedCount = themes.filter((t) => t.is_uploaded).length;
  const totalCount = themes.length;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className="p-2 rounded-xl bg-violet-500/10">
          <Film size={18} className="text-violet-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white">Vídeos por tema</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {totalCount > 0
              ? `${uploadedCount} de ${totalCount} temas com vídeo enviado`
              : 'Suba 1 vídeo do candidato para cada tema (30 latentes do AM + padrão)'}
          </p>
        </div>
        {expanded ? <ChevronDown size={18} className="text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-500" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-zinc-500" />
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {!loading &&
            !error &&
            themes.map((theme) => (
              <ThemeRowItem
                key={theme.id}
                theme={theme}
                baseModelId={baseModelId}
                busy={!!busy[theme.theme_slug]}
                setBusy={(v) => setBusy((b) => ({ ...b, [theme.theme_slug]: v }))}
                onUpdated={(updated) => {
                  setThemes((prev) =>
                    prev.map((t) => (t.theme_slug === theme.theme_slug ? { ...t, ...updated } : t)),
                  );
                }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function ThemeRowItem({
  theme,
  baseModelId,
  busy,
  setBusy,
  onUpdated,
}: {
  theme: ThemeRow;
  baseModelId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onUpdated: (update: Partial<ThemeRow>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const label = theme.themes_template?.label || theme.theme_slug;
  const category = theme.themes_template?.category || '';
  const isDefault = theme.themes_template?.is_default || false;
  const hasVideo = !!theme.video_storage_path;

  async function handleFile(file: File) {
    setBusy(true);
    setLocalError(null);
    try {
      const ext = file.name.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4';
      const contentType = ext === 'webm' ? 'video/webm' : 'video/mp4';

      // 1. signed URL
      const initRes = await fetch('/api/admin/video-modelo/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload-url',
          baseModelId,
          themeSlug: theme.theme_slug,
          ext,
        }),
      });
      if (!initRes.ok) throw new Error((await initRes.json().catch(() => ({}))).error || 'Falha ao iniciar upload');
      const initData = (await initRes.json()) as { uploadUrl: string; path: string };

      // 2. PUT no Storage — x-upsert obrigatório pra substituir arquivos
      // existentes (mesmo com upsert no token, o Supabase Storage retorna
      // 400 sem esse header quando o path já tem conteúdo).
      const putRes = await fetch(initData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: file,
      });
      if (!putRes.ok) {
        const body = await putRes.text().catch(() => '');
        throw new Error(`Falha no upload (${putRes.status}): ${body.slice(0, 160)}`);
      }

      // 3. Confirma + marca is_uploaded=true
      const confRes = await fetch('/api/admin/video-modelo/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm-upload',
          baseModelId,
          themeSlug: theme.theme_slug,
          path: initData.path,
        }),
      });
      if (!confRes.ok) throw new Error((await confRes.json().catch(() => ({}))).error || 'Falha ao confirmar upload');

      onUpdated({ video_storage_path: initData.path, is_uploaded: true });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  }

  async function toggleUploaded(next: boolean) {
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch('/api/admin/video-modelo/themes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseModelId, themeSlug: theme.theme_slug, is_uploaded: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao alternar status');
      onUpdated({ is_uploaded: next });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-all duration-200',
        busy
          ? 'bg-amber-500/[0.06] border-amber-500/30'
          : theme.is_uploaded
          ? 'bg-emerald-500/[0.04] border-emerald-500/20'
          : 'bg-white/[0.02] border-white/[0.06]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{label}</span>
            {isDefault && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300">
                Padrão
              </span>
            )}
            {category && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/[0.05] text-zinc-400">
                {category}
              </span>
            )}
          </div>
          {hasVideo && !busy && (
            <p className="text-[11px] text-zinc-500 mt-1 truncate font-mono">{theme.video_storage_path}</p>
          )}
          {busy && (
            <p className="text-xs text-amber-300 mt-1.5 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Enviando vídeo, aguarde...
            </p>
          )}
          {localError && (
            <p className="text-xs text-red-300 mt-1.5 flex items-center gap-1">
              <AlertCircle size={12} /> {localError}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle is_uploaded */}
          <button
            type="button"
            onClick={() => toggleUploaded(!theme.is_uploaded)}
            disabled={busy}
            title={theme.is_uploaded ? 'Marcar como não enviado' : 'Marcar como enviado'}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              theme.is_uploaded
                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20',
            )}
          >
            {theme.is_uploaded ? <Check size={12} /> : <CircleSlash size={12} />}
            {theme.is_uploaded ? 'Enviado' : 'Não enviado'}
          </button>

          {/* Upload */}
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
              busy
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white',
              'transition-all duration-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
            title={hasVideo ? 'Substituir vídeo' : 'Subir vídeo'}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {busy ? 'Enviando…' : hasVideo ? 'Substituir' : 'Subir vídeo'}
          </button>
        </div>
      </div>
    </div>
  );
}
