'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Download,
  Film,
  Loader2,
  Pencil,
  Sparkles,
  Store,
  Thermometer,
  Upload,
} from 'lucide-react';
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

const MAX_CUSTOM_CHARS = 250;
const DEFAULT_TEMPERATURE = 0.5;

type LipsyncModelId = 'sync-3' | 'lipsync-2-pro' | 'lipsync-2';

type LipsyncModelMeta = {
  id: LipsyncModelId;
  label: string;
  blurb: string;
  badge: string;
  acceptsTemperature: boolean;
};

const LIPSYNC_MODELS: LipsyncModelMeta[] = [
  {
    id: 'sync-3',
    label: 'sync-3',
    blurb: 'Topo de linha — 4K nativo, lida com perfil e obstrução. Temperatura é automática.',
    badge: 'Premium',
    acceptsTemperature: false,
  },
  {
    id: 'lipsync-2-pro',
    label: 'lipsync-2-pro',
    blurb: 'Studio-grade com super-resolução por difusão. Permite ajuste de temperatura.',
    badge: 'Recomendado',
    acceptsTemperature: true,
  },
  {
    id: 'lipsync-2',
    label: 'lipsync-2',
    blurb: 'Mais rápido e barato. Ótimo para rascunhos. Permite ajuste de temperatura.',
    badge: 'Rápido',
    acceptsTemperature: true,
  },
];

const DEFAULT_MODEL: LipsyncModelId = 'lipsync-2-pro';

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
  const [mode, setMode] = useState<'standard' | 'custom'>('standard');
  const [name, setName] = useState('');
  const [customPhrase, setCustomPhrase] = useState('');
  const [model, setModel] = useState<LipsyncModelId>(DEFAULT_MODEL);
  const [temperature, setTemperature] = useState<number>(DEFAULT_TEMPERATURE);
  const modelMeta = LIPSYNC_MODELS.find((m) => m.id === model) ?? LIPSYNC_MODELS[1];
  const acceptsTemperature = modelMeta.acceptsTemperature;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<StatusResponse | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Base swap state
  const [showBaseSwap, setShowBaseSwap] = useState(false);
  const [autoTrim, setAutoTrim] = useState(true);
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [baseUploadStage, setBaseUploadStage] = useState<
    'idle' | 'uploading' | 'processing' | 'done' | 'error'
  >('idle');
  const [baseUploadError, setBaseUploadError] = useState<string | null>(null);
  const [baseTrimmedSec, setBaseTrimmedSec] = useState<number | null>(null);

  const loadGallery = useCallback(async () => {
    try {
      const r = await fetch('/api/supia/list?limit=50', { cache: 'no-store' });
      const d = await r.json();
      if (Array.isArray(d.items)) setGallery(d.items);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const pollStatus = useCallback(
    async (id: string) => {
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
    },
    [loadGallery],
  );

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const customLen = customPhrase.length;
  const customOver = customLen > MAX_CUSTOM_CHARS;

  const canGenerate =
    !submitting &&
    !currentJob?.status?.match(/queued|generating|finalizing/) &&
    (mode === 'standard' ? name.trim().length > 0 : customPhrase.trim().length > 0 && !customOver);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setSubmitting(true);
    setSubmitError(null);
    setCurrentJob(null);

    try {
      const basePayload: Record<string, unknown> = { model };
      if (acceptsTemperature) basePayload.temperature = temperature;

      const payload =
        mode === 'standard'
          ? { ...basePayload, mode: 'standard', supermarketName: name.trim() }
          : {
              ...basePayload,
              mode: 'custom',
              supermarketName: name.trim() || 'Custom',
              customPhrase: customPhrase.trim(),
            };

      const r = await fetch('/api/supia/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        setSubmitError(d.error || 'Falha ao enfileirar');
        return;
      }
      setCurrentJob({
        id: d.id,
        supermarketName: payload.supermarketName,
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

  const handleSwapBase = async () => {
    if (!baseFile) return;
    setBaseUploadStage('uploading');
    setBaseUploadError(null);
    setBaseTrimmedSec(null);

    try {
      const r1 = await fetch('/api/supia/upload-base-url', { method: 'POST' });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error || 'Falha ao gerar URL');

      const putRes = await fetch(d1.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'video/mp4' },
        body: baseFile,
      });
      if (!putRes.ok) throw new Error(`Upload falhou (${putRes.status})`);

      setBaseUploadStage('processing');

      const r2 = await fetch('/api/supia/swap-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempPath: d1.tempPath, autoTrim }),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error || 'Falha no processamento');

      setBaseTrimmedSec(typeof d2.trimmedSeconds === 'number' ? d2.trimmedSeconds : 0);
      setBaseUploadStage('done');
      setBaseFile(null);
    } catch (e) {
      setBaseUploadStage('error');
      setBaseUploadError(e instanceof Error ? e.message : 'Erro');
    }
  };

  const isProcessing =
    currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950 text-white">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <main className="relative max-w-5xl mx-auto px-6 md:px-8 py-10 md:py-14 space-y-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
              <Sparkles size={12} />
              Supia · Vídeo de supermercado
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Gere seu vídeo personalizado
            </h1>
          </div>
          <button
            onClick={() => setShowBaseSwap((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5',
              'bg-white/[0.05] hover:bg-white/[0.1]',
              'text-zinc-300 hover:text-white',
              'border border-white/[0.08] hover:border-white/[0.15]',
              'rounded-xl text-sm font-medium',
              'active:scale-[0.97] transition-all duration-200',
            )}
          >
            <Film size={14} />
            {showBaseSwap ? 'Fechar' : 'Trocar vídeo base'}
          </button>
        </header>

        {/* Base swap */}
        {showBaseSwap && (
          <section className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 md:p-7 shadow-xl shadow-black/20 backdrop-blur-2xl space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Film size={18} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Substituir vídeo base</h2>
                <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
                  O vídeo enviado vira a base de todas as próximas gerações. Recomenda-se 15s,
                  formato MP4. O corte automático remove o silêncio inicial para alinhar o lip-sync.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <label
                className={cn(
                  'flex-1 cursor-pointer',
                  'flex items-center gap-3 px-4 py-3.5',
                  'bg-white/[0.04] hover:bg-white/[0.06]',
                  'border border-dashed border-white/[0.12] hover:border-emerald-500/30',
                  'rounded-xl text-sm transition-all duration-200',
                )}
              >
                <Upload size={16} className="text-zinc-500" />
                <span className="text-zinc-300 truncate">
                  {baseFile ? baseFile.name : 'Selecionar arquivo .mp4'}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setBaseFile(f);
                    setBaseUploadStage('idle');
                    setBaseUploadError(null);
                    setBaseTrimmedSec(null);
                  }}
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-zinc-300 select-none cursor-pointer px-3">
                <input
                  type="checkbox"
                  checked={autoTrim}
                  onChange={(e) => setAutoTrim(e.target.checked)}
                  className="accent-emerald-500"
                />
                Cortar silêncio inicial
              </label>

              <button
                onClick={handleSwapBase}
                disabled={!baseFile || baseUploadStage === 'uploading' || baseUploadStage === 'processing'}
                className={cn(
                  'inline-flex items-center justify-center gap-2 px-5 py-3',
                  'bg-violet-500 hover:bg-violet-400',
                  'text-white font-semibold text-sm',
                  'rounded-xl shadow-lg shadow-violet-500/25',
                  'active:scale-[0.97] transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
                )}
              >
                {(baseUploadStage === 'uploading' || baseUploadStage === 'processing') ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                {baseUploadStage === 'uploading'
                  ? 'Enviando...'
                  : baseUploadStage === 'processing'
                  ? 'Processando...'
                  : 'Publicar como base'}
              </button>
            </div>

            {baseUploadStage === 'done' && (
              <div className="flex items-start gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <span>
                  Novo vídeo base publicado.
                  {baseTrimmedSec && baseTrimmedSec > 0.15
                    ? ` Cortado ${baseTrimmedSec.toFixed(2)}s de silêncio inicial.`
                    : ' Sem silêncio detectado no início.'}
                </span>
              </div>
            )}
            {baseUploadStage === 'error' && baseUploadError && (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="break-all">{baseUploadError}</span>
              </div>
            )}
          </section>
        )}

        {/* Form card */}
        <section className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 md:p-8 shadow-xl shadow-black/20 backdrop-blur-2xl space-y-5">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl w-fit">
            <button
              onClick={() => setMode('standard')}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                mode === 'standard'
                  ? 'bg-emerald-500/15 text-emerald-300 shadow-inner shadow-emerald-500/10'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              <Sparkles size={14} />
              Padrão
            </button>
            <button
              onClick={() => setMode('custom')}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                mode === 'custom'
                  ? 'bg-emerald-500/15 text-emerald-300 shadow-inner shadow-emerald-500/10'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              <Pencil size={14} />
              Customizado
            </button>
          </div>

          {/* Standard mode */}
          {mode === 'standard' && (
            <div className="space-y-3">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 block">
                Nome do supermercado
              </label>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Frase fixa: <span className="text-zinc-300">&ldquo;Aqui no [nome], você encontra as melhores ofertas… venha conferir.&rdquo;</span>
              </p>
              <div className="relative">
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
            </div>
          )}

          {/* Custom mode */}
          {mode === 'custom' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Frase completa
                </label>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    customOver ? 'text-red-400 font-medium' : customLen > MAX_CUSTOM_CHARS * 0.85 ? 'text-amber-400' : 'text-zinc-500',
                  )}
                >
                  {customLen}/{MAX_CUSTOM_CHARS}
                </span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                A locução é falada exatamente como você escrever. O vídeo base tem 15s, então mantenha a frase
                curta — recomendamos até {MAX_CUSTOM_CHARS} caracteres para evitar corte de áudio.
              </p>
              <textarea
                value={customPhrase}
                onChange={(e) => setCustomPhrase(e.target.value)}
                disabled={submitting || !!isProcessing}
                placeholder="Aqui no Hipermix, hoje é dia de oferta especial em hortifruti..."
                rows={3}
                className={cn(
                  'w-full px-4 py-3.5',
                  'bg-white/[0.04] hover:bg-white/[0.06]',
                  'border focus:ring-2 rounded-xl text-base text-white placeholder:text-zinc-600',
                  'outline-none transition-all duration-200 resize-none leading-relaxed',
                  customOver
                    ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20'
                    : 'border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              />
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 block mb-2">
                  Rótulo (galeria) — opcional
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting || !!isProcessing}
                  placeholder="Ex: Hipermix oferta hortifruti"
                  maxLength={60}
                  className={cn(
                    'w-full px-4 py-2.5',
                    'bg-white/[0.04] hover:bg-white/[0.06]',
                    'border border-white/[0.08] focus:border-emerald-500/50',
                    'rounded-xl text-sm text-white placeholder:text-zinc-600',
                    'outline-none focus:ring-2 focus:ring-emerald-500/20',
                    'transition-all duration-200',
                  )}
                />
              </div>
            </div>
          )}

          {/* Lip-sync model + temperature */}
          <div className="space-y-5 pt-2 border-t border-white/[0.06]">
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <Cpu size={14} className="text-violet-400" />
                </div>
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Modelo de lip-sync
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {LIPSYNC_MODELS.map((m) => {
                  const selected = m.id === model;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      disabled={submitting || !!isProcessing}
                      className={cn(
                        'group relative text-left p-3.5 rounded-xl border transition-all duration-200',
                        'disabled:opacity-60 disabled:cursor-not-allowed',
                        selected
                          ? 'bg-emerald-500/10 border-emerald-500/40 shadow-inner shadow-emerald-500/10'
                          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.15]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={cn(
                            'text-sm font-semibold tracking-tight',
                            selected ? 'text-emerald-300' : 'text-white',
                          )}
                        >
                          {m.label}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border',
                            selected
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-white/[0.04] text-zinc-500 border-white/[0.08]',
                          )}
                        >
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{m.blurb}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {acceptsTemperature ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Thermometer size={14} className="text-emerald-400" />
                    </div>
                    <label
                      htmlFor="lipsync-temperature"
                      className="text-xs font-medium uppercase tracking-wider text-zinc-400"
                    >
                      Temperatura do lip-sync
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold tabular-nums text-emerald-300">
                      {temperature.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTemperature(DEFAULT_TEMPERATURE)}
                      disabled={submitting || !!isProcessing}
                      className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <input
                  id="lipsync-temperature"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  disabled={submitting || !!isProcessing}
                  className={cn(
                    'w-full h-1.5 rounded-full appearance-none cursor-pointer',
                    'bg-white/[0.06] accent-emerald-500',
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                    '[&::-webkit-slider-thumb]:appearance-none',
                    '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
                    '[&::-webkit-slider-thumb]:rounded-full',
                    '[&::-webkit-slider-thumb]:bg-emerald-400',
                    '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-emerald-500/40',
                    '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black',
                    '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4',
                    '[&::-moz-range-thumb]:rounded-full',
                    '[&::-moz-range-thumb]:bg-emerald-400',
                    '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-black',
                  )}
                />
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-600">
                  <span>0.00 · Mais fiel</span>
                  <span>0.50 · Padrão</span>
                  <span>1.00 · Mais expressivo</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Valores baixos preservam o estilo do vídeo base com mais precisão; valores altos liberam
                  expressão facial e movimento de boca, podendo gerar resultados menos previsíveis.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-violet-500/[0.06] border border-violet-500/20 rounded-xl">
                <Sparkles size={14} className="text-violet-300 shrink-0 mt-0.5" />
                <p className="text-xs text-violet-200/80 leading-relaxed">
                  O <span className="font-semibold text-violet-200">sync-3</span> gerencia a temperatura
                  internamente — o parâmetro não é configurável neste modelo.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-6 py-3.5',
                'bg-emerald-500 hover:bg-emerald-400',
                'text-black font-semibold text-sm',
                'rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30',
                'active:scale-[0.97] transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
              )}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Gerar vídeo
            </button>
          </div>

          {submitError && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Live job */}
          {currentJob && (
            <div className="space-y-4 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between pt-4">
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
            <span className="text-xs text-zinc-500">
              {gallery.length} vídeo{gallery.length === 1 ? '' : 's'}
            </span>
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
                      <div className="text-sm font-medium text-white truncate">{item.supermarketName}</div>
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
