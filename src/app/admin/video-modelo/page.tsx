'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Loader2,
  Check,
  AlertCircle,
  Edit,
  Trash2,
  Power,
  Mic,
  Video as VideoIcon,
  Settings2,
  Film,
  Sparkles,
  FileType2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import VideoModeloModal, { BaseModel } from './VideoModeloModal';
import { AdminBackLink } from '@/components/AdminBackLink';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';

function getVideoPublicUrl(path: string | null) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/voice-models/${path}`;
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await readJsonSafe<{ error?: string }>(res);
    if (data?.error?.trim()) return data.error;
    return fallback;
  }
  const text = (await res.text().catch(() => '')).trim();
  return text || fallback;
}

export default function VideoModeloPage() {
  const [models, setModels] = useState<BaseModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalInitial, setModalInitial] = useState<BaseModel | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<{
    totalVoices: number;
    referencedCount: number;
    orphans: Array<{ voice_id: string; name: string; category: string }>;
  } | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{
    deleted: Array<{ voice_id: string; name: string }>;
    failed: Array<{ voice_id: string; name: string; error: string }>;
  } | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/video-modelo');
      if (!res.ok) throw new Error(await readApiError(res, 'Falha ao listar modelos'));
      const data = await readJsonSafe<{ models?: BaseModel[] }>(res);
      setModels(data?.models || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar';
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setModalMode('create');
    setModalInitial(null);
    setModalOpen(true);
  }

  function openEdit(model: BaseModel) {
    setModalMode('edit');
    setModalInitial(model);
    setModalOpen(true);
  }

  function handleSaved(saved: BaseModel) {
    setModalOpen(false);
    setMessage({ type: 'success', text: modalMode === 'create' ? 'Modelo criado!' : 'Modelo atualizado!' });
    setModels((prev) => {
      const idx = prev.findIndex((m) => m.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
  }

  async function toggleActive(model: BaseModel) {
    setBusyId(model.id);
    try {
      const res = await fetch('/api/admin/video-modelo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: model.id, is_active: !model.is_active }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Erro ao alterar status'));
      const data = await readJsonSafe<{ model?: BaseModel }>(res);
      if (data?.model) {
        setModels((prev) => prev.map((m) => (m.id === model.id ? data.model! : m)));
        setMessage({ type: 'success', text: data.model.is_active ? 'Modelo ativado' : 'Modelo desativado' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar status';
      setMessage({ type: 'error', text: msg });
    } finally {
      setBusyId(null);
    }
  }

  async function openCleanup() {
    setCleanupOpen(true);
    setCleanupResult(null);
    setCleanupPreview(null);
    setCleanupLoading(true);
    try {
      const res = await fetch('/api/admin/video-modelo/cleanup-voices');
      if (!res.ok) throw new Error(await readApiError(res, 'Falha ao listar vozes'));
      const data = await readJsonSafe<{
        totalVoices: number;
        referencedCount: number;
        orphans: Array<{ voice_id: string; name: string; category: string }>;
      }>(res);
      if (data) setCleanupPreview(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao listar vozes';
      setMessage({ type: 'error', text: msg });
      setCleanupOpen(false);
    } finally {
      setCleanupLoading(false);
    }
  }

  async function runCleanup() {
    setCleanupRunning(true);
    try {
      const res = await fetch('/api/admin/video-modelo/cleanup-voices', { method: 'POST' });
      if (!res.ok) throw new Error(await readApiError(res, 'Falha na limpeza'));
      const data = await readJsonSafe<{
        deleted: Array<{ voice_id: string; name: string }>;
        failed: Array<{ voice_id: string; name: string; error: string }>;
      }>(res);
      if (data) {
        setCleanupResult(data);
        setMessage({
          type: data.failed.length > 0 ? 'error' : 'success',
          text: `Apagadas ${data.deleted.length} vozes órfãs${data.failed.length ? ` · ${data.failed.length} falhas` : ''}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao limpar';
      setMessage({ type: 'error', text: msg });
    } finally {
      setCleanupRunning(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/video-modelo?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Erro ao desativar'));
      // Soft-delete → atualiza is_active local
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: false } : m)));
      setMessage({ type: 'success', text: 'Modelo desativado' });
      setConfirmDeleteId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao desativar';
      setMessage({ type: 'error', text: msg });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        <AdminBackLink />
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Modelos de Vídeo</h1>
            <p className="text-zinc-500 mt-1">
              Gerencie os vídeos base por político. Cada modelo tem seu próprio prompt, voz clonada e config de lip-sync.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openCleanup}
              title="Apaga do ElevenLabs vozes que não estão referenciadas no banco (libera slots do plano)"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5',
                'bg-white/[0.05] hover:bg-white/[0.1]',
                'text-zinc-300 hover:text-white',
                'border border-white/[0.08] hover:border-white/[0.15]',
                'rounded-xl font-medium text-sm',
                'active:scale-[0.97] transition-all duration-200',
              )}
            >
              <Sparkles size={14} /> Limpar vozes órfãs
            </button>
            <button
              onClick={openCreate}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5',
                'bg-emerald-500 hover:bg-emerald-400',
                'text-black font-semibold text-sm rounded-xl',
                'shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30',
                'active:scale-[0.97] transition-all duration-200',
              )}
            >
              <Plus size={16} /> Novo modelo
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={cn(
              'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm',
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400',
            )}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-zinc-500 hover:text-white transition-colors duration-200 text-xs"
            >
              fechar
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 bg-zinc-900/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
              <VideoIcon size={32} className="text-zinc-600" />
            </div>
            <p className="text-zinc-400 mb-1">Nenhum modelo cadastrado ainda</p>
            <p className="text-zinc-600 text-sm mb-6">Crie o primeiro modelo para começar a receber selfies.</p>
            <button
              onClick={openCreate}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5',
                'bg-emerald-500 hover:bg-emerald-400',
                'text-black font-semibold text-sm rounded-xl',
                'shadow-lg shadow-emerald-500/25',
                'active:scale-[0.97] transition-all duration-200',
              )}
            >
              <Plus size={16} /> Criar primeiro modelo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {models.map((m) => (
              <ModelCard
                key={m.id}
                model={m}
                busy={busyId === m.id}
                onEdit={() => openEdit(m)}
                onToggleActive={() => toggleActive(m)}
                onDelete={() => setConfirmDeleteId(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmDeleteId && (() => {
        const target = models.find((m) => m.id === confirmDeleteId);
        if (!target) return null;
        return (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => !busyId && setConfirmDeleteId(null)}
          >
            <div
              className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-red-500/10">
                  <Trash2 size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Desativar modelo</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Soft-delete · selfies históricas permanecem
                  </p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                O modelo <strong className="text-white">{target.display_name || target.name}</strong> ficará inativo.
                Novas selfies para este político não serão aceitas até reativar.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={!!busyId}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5',
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
                  onClick={() => handleDelete(target.id)}
                  disabled={!!busyId}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5',
                    'bg-red-500 hover:bg-red-400',
                    'text-white font-semibold text-sm',
                    'rounded-xl shadow-lg shadow-red-500/25',
                    'active:scale-[0.97] transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {busyId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Desativar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit/Create modal */}
      <VideoModeloModal
        open={modalOpen}
        mode={modalMode}
        initial={modalInitial}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      {/* Cleanup modal */}
      {cleanupOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => !cleanupRunning && setCleanupOpen(false)}
        >
          <div
            className="bg-zinc-950 border border-white/[0.08] rounded-2xl max-w-lg w-full shadow-2xl shadow-black/60 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <Sparkles size={20} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white">Limpar vozes órfãs no ElevenLabs</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Apaga vozes &quot;cloned/generated&quot; sem referência em <code>voice_models</code>
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {cleanupLoading ? (
                <div className="flex items-center gap-3 text-zinc-400 py-8 justify-center">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Listando vozes no ElevenLabs…</span>
                </div>
              ) : cleanupResult ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Apagadas" value={cleanupResult.deleted.length} accent="emerald" />
                    <Stat label="Falhas" value={cleanupResult.failed.length} accent="red" />
                  </div>
                  {cleanupResult.failed.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {cleanupResult.failed.map((f) => (
                        <div key={f.voice_id} className="text-xs px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg">
                          <div className="text-red-400 font-medium">{f.name}</div>
                          <div className="text-zinc-500 mt-0.5">{f.error}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : cleanupPreview ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Stat label="Total ElevenLabs" value={cleanupPreview.totalVoices} accent="zinc" />
                    <Stat label="Referenciadas" value={cleanupPreview.referencedCount} accent="sky" />
                    <Stat label="Órfãs" value={cleanupPreview.orphans.length} accent="amber" />
                  </div>
                  {cleanupPreview.orphans.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-6">
                      Nenhuma voz órfã. Tudo limpo.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-zinc-500">Serão apagadas no ElevenLabs:</p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {cleanupPreview.orphans.map((o) => (
                          <div
                            key={o.voice_id}
                            className="flex items-center justify-between gap-3 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm"
                          >
                            <div className="min-w-0">
                              <div className="text-zinc-200 truncate">{o.name}</div>
                              <div className="text-xs text-zinc-500 font-mono">{o.voice_id.slice(0, 12)}… · {o.category}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : null}
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => setCleanupOpen(false)}
                disabled={cleanupRunning}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5',
                  'bg-white/[0.05] hover:bg-white/[0.1]',
                  'text-zinc-300 hover:text-white',
                  'border border-white/[0.08] hover:border-white/[0.15]',
                  'rounded-xl font-medium text-sm',
                  'active:scale-[0.97] transition-all duration-200',
                  'disabled:opacity-50',
                )}
              >
                Fechar
              </button>
              {!cleanupResult && cleanupPreview && cleanupPreview.orphans.length > 0 && (
                <button
                  onClick={runCleanup}
                  disabled={cleanupRunning}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5',
                    'bg-red-500 hover:bg-red-400',
                    'text-white font-semibold text-sm rounded-xl',
                    'shadow-lg shadow-red-500/25',
                    'active:scale-[0.97] transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {cleanupRunning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Apagar {cleanupPreview.orphans.length} {cleanupPreview.orphans.length === 1 ? 'voz' : 'vozes'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: 'zinc' | 'sky' | 'emerald' | 'amber' | 'red' }) {
  const colors: Record<string, string> = {
    zinc: 'text-zinc-300',
    sky: 'text-sky-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
      <div className={cn('text-2xl font-bold', colors[accent])}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

function ModelCard({
  model,
  busy,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  model: BaseModel;
  busy: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const videoUrl = getVideoPublicUrl(model.video_storage_path);
  const lipsync = model.lipsync_config || { model: '—', sync_mode: '—', temperature: 0 };
  const hasClosing = !!model.closing_video_path;
  const hasProposta = !!model.proposta_pdf_path;

  return (
    <div className="group bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl overflow-hidden shadow-xl shadow-black/20 transition-all duration-300 ease-out">
      <div className="flex">
        {/* Video preview */}
        <div className="w-40 shrink-0 aspect-[9/12] bg-zinc-900/80 relative overflow-hidden">
          {videoUrl ? (
            <video
              src={videoUrl}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
              <VideoIcon size={28} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-white truncate">
                  {model.display_name || model.name}
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider',
                    model.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/30',
                  )}
                >
                  {model.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1 font-mono truncate">/{model.slug || '—'}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-2">
            <Tag icon={<Mic size={11} />}>
              {model.voice_models?.elevenlabs_voice_id ? 'Voz clonada' : 'Sem voz'}
            </Tag>
            <Tag icon={<Settings2 size={11} />}>{lipsync.model}</Tag>
            <Tag>temp {Number(lipsync.temperature).toFixed(1)}</Tag>
            {hasClosing && <Tag icon={<Film size={11} />}>Encerramento</Tag>}
            {hasProposta && <Tag icon={<FileType2 size={11} />}>Proposta PDF</Tag>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-auto pt-2">
            <button
              onClick={onEdit}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5',
                'bg-white/[0.05] hover:bg-white/[0.1]',
                'text-zinc-300 hover:text-white',
                'border border-white/[0.08] hover:border-white/[0.15]',
                'rounded-lg text-xs font-medium',
                'active:scale-[0.97] transition-all duration-200',
                'disabled:opacity-50',
              )}
            >
              <Edit size={12} /> Editar
            </button>
            <button
              onClick={onToggleActive}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5',
                model.is_active
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20 hover:border-amber-500/30'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/30',
                'border rounded-lg text-xs font-medium',
                'active:scale-[0.97] transition-all duration-200',
                'disabled:opacity-50',
              )}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
              {model.is_active ? 'Desativar' : 'Ativar'}
            </button>
            <button
              onClick={onDelete}
              disabled={busy || !model.is_active}
              title={!model.is_active ? 'Já desativado' : 'Desativar (soft-delete)'}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 ml-auto',
                'bg-red-500/10 hover:bg-red-500/20',
                'text-red-400 hover:text-red-300',
                'border border-red-500/20 hover:border-red-500/30',
                'rounded-lg text-xs font-medium',
                'active:scale-[0.97] transition-all duration-200',
                'disabled:opacity-30 disabled:cursor-not-allowed',
              )}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tag({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] text-zinc-400 rounded-full text-[11px] font-medium">
      {icon}
      {children}
    </span>
  );
}
