'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles,
  RotateCcw,
  Loader2,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface PromptMetadata {
  sliders?: Record<string, number>;
  last_instruction?: string;
}

interface PromptData {
  id: string;
  content: string;
  version: number;
  updated_at: string;
  metadata?: PromptMetadata;
}

// ── Slider configs ───────────────────────────────────────────────────────────
// Only political bias slider — others removed per admin request

// ── Political Bias Potentiometer ─────────────────────────────────────────────

function PoliticalBiasPot({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const absVal = Math.abs(value);
  const intensity = absVal === 0 ? 'Neutro' : absVal <= 0.3 ? 'Leve' : absVal <= 0.6 ? 'Moderado' : 'Forte';
  const direction = value < 0 ? 'Esquerda' : value > 0 ? 'Direita' : '';
  const displayLabel = value === 0 ? intensity : `${intensity} ${direction}`;

  return (
    <div className="space-y-6">
      {/* Value display */}
      <div className="flex flex-col items-center gap-2">
        <span className={cn(
          'text-4xl font-black tabular-nums tracking-tight transition-colors duration-300',
          value < 0 ? 'text-rose-400' : value > 0 ? 'text-sky-400' : 'text-zinc-400',
        )}>
          {value > 0 ? '+' : ''}{value.toFixed(2)}
        </span>
        <span className={cn(
          'text-sm font-semibold uppercase tracking-widest transition-colors duration-300',
          value < 0 ? 'text-rose-400/60' : value > 0 ? 'text-sky-400/60' : 'text-zinc-600',
        )}>
          {displayLabel}
        </span>
      </div>

      {/* Potentiometer track */}
      <div className="relative px-2">
        {/* Labels */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-400/70">Esquerda</span>
          <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">Centro</span>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400/70">Direita</span>
        </div>

        {/* Track */}
        <div className="relative h-12 flex items-center">
          {/* Background gradient track */}
          <div className="absolute inset-x-0 h-3 rounded-full overflow-hidden">
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to right, #f43f5e, #fb7185, #71717a, #71717a, #38bdf8, #0ea5e9)',
              opacity: 0.3,
            }} />
          </div>

          {/* Active fill from center */}
          <div
            className="absolute h-3 rounded-full transition-all duration-200"
            style={{
              left: value >= 0 ? '50%' : `${((value + 1) / 2) * 100}%`,
              right: value < 0 ? '50%' : `${100 - ((value + 1) / 2) * 100}%`,
              background: value > 0
                ? 'linear-gradient(to right, #71717a, #38bdf8)'
                : value < 0
                  ? 'linear-gradient(to left, #71717a, #f43f5e)'
                  : 'transparent',
              boxShadow: value !== 0
                ? `0 0 20px ${value > 0 ? '#38bdf840' : '#f43f5e40'}`
                : 'none',
            }}
          />

          {/* Center marker */}
          <div className="absolute left-1/2 -translate-x-px w-0.5 h-6 bg-zinc-500/50 rounded-full" />

          {/* Tick marks */}
          {[-0.75, -0.5, -0.25, 0.25, 0.5, 0.75].map(tick => (
            <div
              key={tick}
              className="absolute w-px h-3 bg-zinc-700/50"
              style={{ left: `${((tick + 1) / 2) * 100}%` }}
            />
          ))}

          {/* Input */}
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="relative w-full h-3 appearance-none bg-transparent cursor-pointer z-10
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-7
              [&::-webkit-slider-thumb]:h-7
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:shadow-xl
              [&::-webkit-slider-thumb]:shadow-black/50
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-zinc-200
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:duration-200
              [&::-webkit-slider-thumb]:hover:scale-125
              [&::-webkit-slider-thumb]:active:scale-110"
          />
        </div>

        {/* Scale labels */}
        <div className="flex items-center justify-between mt-1 px-1">
          <span className="text-[9px] text-zinc-700 tabular-nums">-1.0</span>
          <span className="text-[9px] text-zinc-700 tabular-nums">-0.5</span>
          <span className="text-[9px] text-zinc-600 tabular-nums font-medium">0</span>
          <span className="text-[9px] text-zinc-700 tabular-nums">+0.5</span>
          <span className="text-[9px] text-zinc-700 tabular-nums">+1.0</span>
        </div>
      </div>

      {/* Reset button */}
      <div className="flex justify-center">
        <button
          onClick={() => onChange(0)}
          disabled={value === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2
            bg-white/[0.05] hover:bg-white/[0.1]
            text-zinc-400 hover:text-white
            border border-white/[0.08] hover:border-white/[0.15]
            rounded-xl text-xs font-medium
            active:scale-[0.97] transition-all duration-200
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw size={12} />
          Resetar para neutro
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Main Page ────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

export default function PromptArenaPage() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState<PromptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBias, setSavingBias] = useState(false);

  const [sliders, setSliders] = useState<Record<string, number>>({
    political_bias: 0,
  });
  const [savedBias, setSavedBias] = useState(0);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Load prompt on mount ──────────────────────────────────────────────────

  useEffect(() => {
    loadPrompt();
  }, []);

  const DEFAULT_SLIDERS: Record<string, number> = {
    political_bias: 0,
  };

  async function loadPrompt() {
    setLoading(true);
    try {
      const res = await fetch('/api/arena/prompts?id=arena_system');
      const data = await res.json();
      if (data.prompt) {
        setPrompt(data.prompt);
        // Restore sliders from saved metadata
        if (data.prompt.metadata?.sliders) {
          setSliders({ ...DEFAULT_SLIDERS, ...data.prompt.metadata.sliders });
          setSavedBias(data.prompt.metadata.sliders.political_bias ?? 0);
        } else {
          setSliders({ ...DEFAULT_SLIDERS });
          setSavedBias(0);
        }
      } else {
        showToast(data.error || 'Prompt não encontrado', 'error');
      }
    } catch {
      showToast('Falha ao carregar prompt', 'error');
    }
    setLoading(false);
  }

  // ── Apply bias directly (saves slider value to metadata without prompt change) ──

  const biasChanged = sliders.political_bias !== savedBias;

  async function handleApplyBias() {
    if (!prompt || savingBias) return;
    setSavingBias(true);
    try {
      const res = await fetch('/api/arena/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'arena_system',
          content: prompt.content, // keep prompt text unchanged
          changelog: [`Viés político ajustado para ${sliders.political_bias > 0 ? '+' : ''}${sliders.political_bias.toFixed(2)}`],
          metadata: {
            ...prompt.metadata,
            sliders,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.prompt) {
        setPrompt(data.prompt);
        setSavedBias(sliders.political_bias);
        showToast(`Viés ${sliders.political_bias.toFixed(2)} aplicado!`, 'success');
      } else {
        showToast(data.error || 'Falha ao salvar viés', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    }
    setSavingBias(false);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ── Render ─────────────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-black">
      {/* Decorative orbs */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto p-6 md:p-8 lg:p-10 space-y-8">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-200 mb-4"
          >
            <ArrowLeft size={14} />
            Voltar
          </Link>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10">
              <Sparkles size={22} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Prompt Arena
              </h1>
              <p className="text-zinc-500 text-sm mt-0.5">
                Controle de viés político
                {prompt && (
                  <span className="text-zinc-400">
                    {' '}· v{prompt.version}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ── Loading State ───────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-zinc-900/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {prompt && !loading && (
          <>
            {/* ── Viés Político ──────────────────────────────────────── */}
            <section className="space-y-6">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Viés Político
              </h2>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">
                <PoliticalBiasPot
                  value={sliders.political_bias}
                  onChange={(v) => setSliders((prev) => ({ ...prev, political_bias: v }))}
                />

                {/* Apply bias button — appears when value differs from saved */}
                {biasChanged && (
                  <div className="mt-6 pt-6 border-t border-white/[0.06] flex items-center justify-between">
                    <p className="text-xs text-zinc-500">
                      Salvo: <span className="font-bold text-zinc-400">{savedBias > 0 ? '+' : ''}{savedBias.toFixed(2)}</span>
                      {' → '}
                      Novo: <span className={cn('font-bold', sliders.political_bias < 0 ? 'text-rose-400' : sliders.political_bias > 0 ? 'text-sky-400' : 'text-zinc-400')}>
                        {sliders.political_bias > 0 ? '+' : ''}{sliders.political_bias.toFixed(2)}
                      </span>
                    </p>
                    <button
                      onClick={handleApplyBias}
                      disabled={savingBias}
                      className="inline-flex items-center gap-2 px-6 py-3
                        bg-emerald-500 hover:bg-emerald-400
                        text-black font-semibold text-sm rounded-xl
                        shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30
                        active:scale-[0.97] transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingBias ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Zap size={16} />
                      )}
                      {savingBias ? 'Salvando...' : 'Aplicar Viés'}
                    </button>
                  </div>
                )}
              </div>
            </section>

          </>
        )}
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl shadow-black/50 text-sm font-medium',
            'border backdrop-blur-xl transition-all duration-300',
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400',
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
