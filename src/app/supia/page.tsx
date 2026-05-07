'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Sparkles, Store, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusResponse = {
  id: string;
  supermarketName: string;
  status: string;
  error: string | null;
  videoUrl: string | null;
};

type GalleryItem = {
  id: string;
  supermarketName: string;
  videoUrl: string;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  queued: 'Na fila…',
  generating_tts: 'Gerando voz (1/3)',
  generating_lipsync: 'Aplicando lip-sync (2/3)',
  finalizing: 'Finalizando (3/3)',
  completed: 'Pronto',
  failed: 'Falhou',
};

const STATUS_PROGRESS: Record<string, number> = {
  queued: 5,
  generating_tts: 25,
  generating_lipsync: 65,
  finalizing: 90,
  completed: 100,
  failed: 100,
};

async function downloadBlob(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function SupiaPage() {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentJob, setCurrentJob] = useState<StatusResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadGallery = useCallback(async () => {
    try {
      const r = await fetch('/api/supia/list?limit=50', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d.items)) setGallery(d.items);
    } catch {
      // silent — gallery is best-effort
    }
  }, []);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/supia/status?id=${id}`, { cache: 'no-store' });
      const d: StatusResponse = await r.json();
      setCurrentJob(d);

      if (d.status === 'completed' || d.status === 'failed') {
        if (d.status === 'completed') loadGallery();
        return;
      }
      pollTimer.current = setTimeout(() => pollStatus(id), 3000);
    } catch {
      pollTimer.current = setTimeout(() => pollStatus(id), 5000);
    }
  }, [loadGallery]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const handleGenerate = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    setCurrentJob(null);

    try {
      const r = await fetch('/api/supia/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supermarketName: trimmed }),
      });
      const d = await r.json();
      if (!r.ok) {
        setSubmitError(d.error || 'Falha ao enfileirar');
        setSubmitting(false);
        return;
      }
      setCurrentJob({
        id: d.id,
        supermarketName: trimmed,
        status: 'queued',
        error: null,
        videoUrl: null,
      });
      pollStatus(d.id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setSubmitting(false);
    }
  };

  const isProcessing =
    currentJob &&
    currentJob.status !== 'completed' &&
    currentJob.status !== 'failed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950 text-white">
      {/* Decorative orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <main className="relative max-w-5xl mx-auto px-6 md:px-8 py-10 md:py-14 space-y-10">
        {/* Header */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
            <Sparkles size={12} />
            Supia · Vídeo de supermercado
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Gere seu vídeo personalizado
          </h1>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            Digite o nome do supermercado. A locução é fixa: <span className="text-zinc-300">&ldquo;Aqui no [nome], você encontra as melhores ofertas… venha conferir.&rdquo;</span>
          </p>
        </header>

        {/* Form card */}
        <section className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 md:p-8 shadow-xl shadow-black/20 backdrop-blur-2xl">
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3 block">
            Nome do supermercado
          </label>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Store size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerate();
                }}
                disabled={submitting || !!isProcessing}
                placeholder="Hipermix"
                maxLength={60}
                className={cn(
                  'w-full pl-11 pr-4 py-3.5',
                  'bg-white/[0.04] hover:bg-white/[0.06]',
                  'border border-white/[0.08] focus:border-emerald-500/50',
                  'rounded-xl text-base text-white placeholder:text-zinc-600',
                  'outline-none focus:ring-2 focus:ring-emerald-500/20',
                  'transition-all duration-200',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={!name.trim() || submitting || !!isProcessing}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-6 py-3.5',
                'bg-emerald-500 hover:bg-emerald-400',
                'text-black font-semibold text-sm',
                'rounded-xl',
                'shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30',
                'active:scale-[0.97]',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
              )}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Gerar vídeo
            </button>
          </div>

          {submitError && (
            <div className="mt-4 flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Live job */}
          {currentJob && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {currentJob.status === 'completed' ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : currentJob.status === 'failed' ? (
                    <AlertCircle size={16} className="text-red-400" />
                  ) : (
                    <Loader2 size={16} className="animate-spin text-emerald-400" />
                  )}
                  <span className="text-zinc-300">
                    {STATUS_LABEL[currentJob.status] || currentJob.status}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-500">{currentJob.supermarketName}</span>
                </div>
                <span className="text-xs text-zinc-500">
                  {STATUS_PROGRESS[currentJob.status] ?? 0}%
                </span>
              </div>

              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500 ease-out',
                    currentJob.status === 'failed'
                      ? 'bg-red-500'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-400',
                  )}
                  style={{ width: `${STATUS_PROGRESS[currentJob.status] ?? 0}%` }}
                />
              </div>

              {currentJob.status === 'failed' && currentJob.error && (
                <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="break-all">{currentJob.error}</span>
                </div>
              )}

              {currentJob.status === 'completed' && currentJob.videoUrl && (
                <div className="space-y-3">
                  <video
                    src={currentJob.videoUrl}
                    controls
                    className="w-full rounded-xl border border-white/[0.08] bg-black"
                  />
                  <button
                    onClick={() =>
                      downloadBlob(currentJob.videoUrl!, `supia-${currentJob.supermarketName}.mp4`)
                    }
                    className={cn(
                      'inline-flex items-center gap-2 px-5 py-2.5',
                      'bg-white/[0.05] hover:bg-white/[0.1]',
                      'text-zinc-200 hover:text-white',
                      'border border-white/[0.08] hover:border-white/[0.15]',
                      'rounded-xl font-medium text-sm',
                      'active:scale-[0.97] transition-all duration-200',
                    )}
                  >
                    <Download size={14} />
                    Baixar vídeo
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Gallery */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Galeria</h2>
            <span className="text-xs text-zinc-500">{gallery.length} vídeo{gallery.length === 1 ? '' : 's'}</span>
          </div>

          {gallery.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white/[0.02] border border-white/[0.05] rounded-2xl">
              <div className="p-4 rounded-2xl bg-zinc-900/60 mb-4">
                <Store size={28} className="text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-sm">Nenhum vídeo gerado ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl overflow-hidden shadow-xl shadow-black/20 hover:shadow-2xl transition-all duration-300"
                >
                  <video
                    src={item.videoUrl}
                    className="w-full aspect-video object-cover bg-black"
                    preload="metadata"
                    controls
                  />
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {item.supermarketName}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {new Date(item.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => downloadBlob(item.videoUrl, `supia-${item.supermarketName}.mp4`)}
                      className="shrink-0 p-2.5 rounded-xl bg-white/[0.05] hover:bg-emerald-500/15 text-zinc-300 hover:text-emerald-400 border border-white/[0.08] hover:border-emerald-500/30 transition-all duration-200"
                      aria-label="Baixar"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
