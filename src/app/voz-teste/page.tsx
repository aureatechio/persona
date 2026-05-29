'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic, Play, Loader2, Download, AlertCircle, Sparkles, RotateCcw, Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESETS = [
  'Olá! Tudo bem com você? Estou muito feliz em poder conversar com você hoje.',
  'Conte comigo. Vamos juntos construir um futuro melhor para a nossa cidade e para a nossa gente.',
  'Muito obrigada pela sua mensagem. Cada palavra de vocês me dá ainda mais força para seguir trabalhando.',
];

const MODELS = [
  { id: 'eleven_v3', label: 'v3 (padrão)' },
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2' },
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 (rápido)' },
];

type Settings = {
  model_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
};

const DEFAULTS: Settings = {
  model_id: 'eleven_v3',
  stability: 0.6,
  similarity_boost: 0.75,
  style: 0.35,
  speed: 0.88,
  use_speaker_boost: false,
};

function Slider({
  label, value, min, max, step, onChange, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="text-sm font-semibold text-emerald-400 tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
          bg-zinc-800
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400
          [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-emerald-500/40
          [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
        style={{ background: `linear-gradient(to right, rgb(52 211 153) ${pct}%, rgb(39 39 42) ${pct}%)` }}
      />
      {hint && <span className="text-[11px] text-zinc-600 leading-snug">{hint}</span>}
    </div>
  );
}

export default function VozTestePage() {
  const [text, setText] = useState(PRESETS[0]);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<string>('Maria do Carmo');
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch('/api/voz-teste')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.voiceName) setVoiceName(d.voiceName); if (d?.voiceId) setVoiceId(d.voiceId); })
      .catch(() => {});
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  async function generate() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }

    try {
      const res = await fetch('/api/voz-teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ...settings }),
      });
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try { const j = await res.json(); msg = j.detail || j.error || msg; } catch {}
        throw new Error(msg);
      }
      const id = res.headers.get('X-Voice-Id');
      if (id) setVoiceId(id);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setTimeout(() => { audioRef.current?.play().catch(() => {}); }, 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar áudio');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950 text-white">
      {/* orbs decorativos */}
      <div className="fixed -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto p-6 md:p-10 space-y-8">
        {/* header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <Mic className="text-emerald-400" size={26} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Teste de Voz
              </h1>
              <p className="text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
                Voz clonada:
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
                  <Sparkles size={11} /> {voiceName}
                </span>
                {voiceId && <span className="text-[11px] text-zinc-700 font-mono">{voiceId}</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* coluna texto + player */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 md:p-6 shadow-xl shadow-black/20">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3 block">
                Texto para sintetizar
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Digite o que a Maria do Carmo deve falar..."
                className="w-full px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08]
                  focus:border-emerald-500/50 rounded-xl text-base text-white placeholder:text-zinc-600
                  outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  {PRESETS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setText(p)}
                      className="px-3 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white
                        border border-white/[0.08] rounded-full text-xs transition-all duration-200"
                    >
                      Exemplo {i + 1}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-zinc-600 tabular-nums">{text.length} caracteres</span>
              </div>
            </div>

            <button
              onClick={generate}
              disabled={loading || !text.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5
                bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl
                shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.98]
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Gerando áudio...</>
                : <><Play size={18} /> Gerar áudio</>}
            </button>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-400" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {audioUrl && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 md:p-6 shadow-xl shadow-black/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-4 text-zinc-400">
                  <Volume2 size={16} className="text-emerald-400" />
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Resultado</span>
                </div>
                <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                <a
                  href={audioUrl}
                  download={`maria-do-carmo-${Date.now()}.mp3`}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1]
                    text-zinc-300 hover:text-white border border-white/[0.08] rounded-xl text-sm transition-all duration-200"
                >
                  <Download size={15} /> Baixar MP3
                </a>
              </div>
            )}
          </div>

          {/* coluna settings */}
          <div className="lg:col-span-2">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 md:p-6 shadow-xl shadow-black/20 space-y-6 lg:sticky lg:top-8">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Ajustes da voz</span>
                <button
                  onClick={() => setSettings(DEFAULTS)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-500 hover:text-emerald-400
                    rounded-lg hover:bg-emerald-500/10 transition-all duration-200"
                >
                  <RotateCcw size={12} /> Padrão
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Modelo</span>
                <div className="flex flex-col gap-1.5">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => set('model_id', m.id)}
                      className={cn(
                        'text-left px-3 py-2 rounded-xl text-sm border transition-all duration-200',
                        settings.model_id === m.id
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

              <Slider label="Stability" value={settings.stability} min={0} max={1} step={0.01}
                onChange={(v) => set('stability', v)} hint="Baixo = mais expressivo/variável. Alto = mais estável." />
              <Slider label="Similarity" value={settings.similarity_boost} min={0} max={1} step={0.01}
                onChange={(v) => set('similarity_boost', v)} hint="Quão fiel ao timbre original da clonagem." />
              <Slider label="Style" value={settings.style} min={0} max={1} step={0.01}
                onChange={(v) => set('style', v)} hint="Exagero de entonação. Alto pode instabilizar." />
              <Slider label="Speed" value={settings.speed} min={0.7} max={1.2} step={0.01}
                onChange={(v) => set('speed', v)} hint="Velocidade da fala (0.88 = produção)." />

              <button
                onClick={() => set('use_speaker_boost', !settings.use_speaker_boost)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-all duration-200',
                  settings.use_speaker_boost
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/[0.03] border-white/[0.06] text-zinc-400',
                )}
              >
                <span>Speaker boost</span>
                <span className={cn(
                  'relative w-9 h-5 rounded-full transition-colors duration-200',
                  settings.use_speaker_boost ? 'bg-emerald-500' : 'bg-zinc-700',
                )}>
                  <span className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200',
                    settings.use_speaker_boost ? 'left-[18px]' : 'left-0.5',
                  )} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
