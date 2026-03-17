'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Sparkles,
  Save,
  RotateCcw,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Check,
  Clock,
  Zap,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  History,
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

interface SliderConfig {
  key: string;
  label: string;
  leftLabel: string;
  rightLabel: string;
}

interface ChangelogEntry {
  id: string;
  version: number;
  changes: string[];
  previous_content: string | null;
  instruction: string | null;
  created_at: string;
}

// ── Slider configs ───────────────────────────────────────────────────────────

const SLIDERS: SliderConfig[] = [
  {
    key: 'political_bias',
    label: 'Viés Político',
    leftLabel: '← Esquerda',
    rightLabel: 'Direita →',
  },
  {
    key: 'neutral_pct',
    label: 'Neutros',
    leftLabel: '← Menos',
    rightLabel: 'Mais →',
  },
  {
    key: 'humor_level',
    label: 'Humor',
    leftLabel: '← Menos',
    rightLabel: 'Mais →',
  },
  {
    key: 'profanity_level',
    label: 'Palavrões',
    leftLabel: '← Menos',
    rightLabel: 'Mais →',
  },
  {
    key: 'regionalism',
    label: 'Regionalismo',
    leftLabel: '← Menos',
    rightLabel: 'Mais →',
  },
];

// ── PotSlider Component ──────────────────────────────────────────────────────

function PotSlider({
  label,
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span
          className={cn(
            'text-sm font-bold tabular-nums',
            value > 0
              ? 'text-sky-400'
              : value < 0
                ? 'text-rose-400'
                : 'text-zinc-400',
          )}
        >
          {value > 0 ? '+' : ''}
          {value.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-zinc-600 w-20 text-right shrink-0">
          {leftLabel}
        </span>
        <div className="relative flex-1 h-8 flex items-center">
          <div className="absolute inset-x-0 h-2 rounded-full bg-zinc-800/80" />
          <div
            className="absolute h-2 rounded-full transition-all duration-150"
            style={{
              left: value >= 0 ? '50%' : `${((value + 1) / 2) * 100}%`,
              right: value < 0 ? '50%' : `${100 - ((value + 1) / 2) * 100}%`,
              backgroundColor: value > 0 ? '#38bdf8' : value < 0 ? '#f87171' : '#52525b',
              opacity: 0.6,
            }}
          />
          <div className="absolute left-1/2 -translate-x-px w-0.5 h-4 bg-zinc-600 rounded-full" />
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="relative w-full h-2 appearance-none bg-transparent cursor-pointer z-10
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:shadow-black/40
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-zinc-300
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:duration-200
              [&::-webkit-slider-thumb]:hover:scale-110"
          />
        </div>
        <span className="text-[10px] text-zinc-600 w-20 shrink-0">{rightLabel}</span>
      </div>
      <button
        onClick={() => onChange(0)}
        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors duration-200"
      >
        Resetar
      </button>
    </div>
  );
}

// ── Confirm Save Modal ───────────────────────────────────────────────────────

function ConfirmSaveModal({
  open,
  onClose,
  onConfirm,
  changelog,
  warnings,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  changelog: string[];
  warnings: string[];
  loading: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-xl bg-emerald-500/10">
            <Save size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Salvar no Supabase
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              O prompt atualizado será salvo e entrará em vigor em até 5 minutos (TTL do cache).
            </p>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4 space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-400 flex items-start gap-2">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {w}
              </p>
            ))}
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6 space-y-1">
          {changelog.map((c, i) => (
            <p key={i} className="text-sm text-zinc-300 flex items-start gap-2">
              <span className="text-emerald-400 shrink-0">+</span>
              {c}
            </p>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5
              bg-white/[0.05] hover:bg-white/[0.1]
              text-zinc-300 hover:text-white
              border border-white/[0.08] hover:border-white/[0.15]
              rounded-xl font-medium text-sm
              active:scale-[0.97] transition-all duration-200
              disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5
              bg-emerald-500 hover:bg-emerald-400
              text-black font-semibold text-sm rounded-xl
              shadow-lg shadow-emerald-500/25
              active:scale-[0.97] transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {loading ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Restore Modal ─────────────────────────────────────────────────────

function ConfirmRestoreModal({
  open,
  onClose,
  onConfirm,
  loading,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  title: string;
  description: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-zinc-400 mt-1">{description}</p>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6">
          <p className="text-sm text-zinc-300">
            O prompt atual será salvo automaticamente no histórico como backup antes da restauração.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5
              bg-white/[0.05] hover:bg-white/[0.1]
              text-zinc-300 hover:text-white
              border border-white/[0.08] hover:border-white/[0.15]
              rounded-xl font-medium text-sm
              active:scale-[0.97] transition-all duration-200
              disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5
              bg-amber-500 hover:bg-amber-400
              text-black font-semibold text-sm rounded-xl
              shadow-lg shadow-amber-500/25
              active:scale-[0.97] transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <History size={16} />
            )}
            {loading ? 'Restaurando...' : 'Restaurar'}
          </button>
        </div>
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
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sliders, setSliders] = useState<Record<string, number>>({
    political_bias: 0,
    neutral_pct: 0,
    humor_level: 0,
    profanity_level: 0,
    regionalism: 0,
  });

  const [freeInstruction, setFreeInstruction] = useState('');

  // Preview state (after AI generation)
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // History
  const [history, setHistory] = useState<ChangelogEntry[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Restore original
  const [showRestoreOriginal, setShowRestoreOriginal] = useState(false);
  const [restoringOriginal, setRestoringOriginal] = useState(false);

  // Modal & toast
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Load prompt on mount ──────────────────────────────────────────────────

  useEffect(() => {
    loadPrompt();
    loadHistory();
  }, []);

  const DEFAULT_SLIDERS: Record<string, number> = {
    political_bias: 0,
    neutral_pct: 0,
    humor_level: 0,
    profanity_level: 0,
    regionalism: 0,
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
        } else {
          setSliders({ ...DEFAULT_SLIDERS });
        }
      } else {
        showToast(data.error || 'Prompt não encontrado', 'error');
      }
    } catch {
      showToast('Falha ao carregar prompt', 'error');
    }
    setLoading(false);
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/arena/prompts/changelog?id=arena_system');
      const data = await res.json();
      if (data.entries) {
        setHistory(data.entries);
      }
    } catch {
      // silent — changelog is optional
    }
  }

  // ── Generate improved prompt ──────────────────────────────────────────────

  const hasSliderChanges = Object.values(sliders).some((v) => v !== 0);
  const hasInstruction = freeInstruction.trim().length > 0;
  const canGenerate = (hasSliderChanges || hasInstruction) && !generating && prompt;

  const handleGenerate = useCallback(async () => {
    if (!prompt) return;
    setGenerating(true);
    setPreviewPrompt(null);
    setChangelog([]);
    setWarnings([]);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      const res = await fetch('/api/arena/prompts/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPrompt: prompt.content,
          instruction: freeInstruction.trim() || undefined,
          sliders: hasSliderChanges ? sliders : undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json();

      if (res.ok && data.improved_prompt) {
        setPreviewPrompt(data.improved_prompt);
        setChangelog(data.changelog || []);
        setWarnings(data.warnings || []);
        showToast('Prompt melhorado gerado!', 'success');
      } else {
        showToast(data.error || 'Falha ao gerar melhoria', 'error');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        showToast('Timeout — a IA demorou demais. Tente novamente.', 'error');
      } else {
        showToast('Erro de conexão', 'error');
      }
    }

    setGenerating(false);
  }, [prompt, freeInstruction, sliders, hasSliderChanges]);

  // ── Save to Supabase ──────────────────────────────────────────────────────

  async function handleSave() {
    if (!previewPrompt || !prompt) return;
    setSaving(true);

    try {
      const res = await fetch('/api/arena/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'arena_system',
          content: previewPrompt,
          changelog,
          instruction: freeInstruction.trim() || null,
          metadata: {
            sliders,
            last_instruction: freeInstruction.trim() || null,
          },
        }),
      });

      const data = await res.json();

      if (res.ok && data.prompt) {
        setPrompt(data.prompt);
        setPreviewPrompt(null);
        setChangelog([]);
        setWarnings([]);
        setFreeInstruction('');
        // Keep sliders as-is — they reflect the current prompt state
        showToast(`Prompt salvo! Versão ${data.prompt.version}`, 'success');
        loadHistory();
      } else {
        showToast(data.error || 'Falha ao salvar', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    }

    setSaving(false);
    setShowConfirm(false);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Discard preview ───────────────────────────────────────────────────────

  function discardPreview() {
    setPreviewPrompt(null);
    setChangelog([]);
    setWarnings([]);
  }

  // ── Restore original (factory default) ──────────────────────────────────

  async function handleRestoreOriginal() {
    setRestoringOriginal(true);
    try {
      // 1. Fetch the hardcoded original from Python file
      const origRes = await fetch('/api/arena/prompts/original');
      const origData = await origRes.json();

      if (!origRes.ok || !origData.content) {
        showToast(origData.error || 'Falha ao buscar prompt original', 'error');
        setRestoringOriginal(false);
        setShowRestoreOriginal(false);
        return;
      }

      // 2. Save it to Supabase with reset metadata
      const saveRes = await fetch('/api/arena/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'arena_system',
          content: origData.content,
          changelog: ['Restaurado para o prompt original (factory default)'],
          metadata: { sliders: DEFAULT_SLIDERS, last_instruction: null },
        }),
      });

      const saveData = await saveRes.json();

      if (saveRes.ok && saveData.prompt) {
        setPrompt(saveData.prompt);
        setPreviewPrompt(null);
        setChangelog([]);
        setWarnings([]);
        setFreeInstruction('');
        setSliders({ ...DEFAULT_SLIDERS });
        showToast(`Prompt original restaurado! Versão ${saveData.prompt.version}`, 'success');
        loadHistory();
      } else {
        showToast(saveData.error || 'Falha ao restaurar', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    }
    setRestoringOriginal(false);
    setShowRestoreOriginal(false);
  }

  // ── Restore from history entry ──────────────────────────────────────────

  async function handleRestoreFromHistory(previousContent: string) {
    setRestoringOriginal(true);
    try {
      const res = await fetch('/api/arena/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'arena_system',
          content: previousContent,
          changelog: ['Restaurado a partir de versão anterior (backup do histórico)'],
        }),
      });

      const data = await res.json();

      if (res.ok && data.prompt) {
        setPrompt(data.prompt);
        setPreviewPrompt(null);
        setChangelog([]);
        setWarnings([]);
        showToast(`Backup restaurado! Versão ${data.prompt.version}`, 'success');
        loadHistory();
      } else {
        showToast(data.error || 'Falha ao restaurar', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    }
    setRestoringOriginal(false);
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
                Engenharia de prompt com IA
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
            {/* ── Current Prompt ─────────────────────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Prompt Atual
                </h2>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowRestoreOriginal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5
                      bg-white/[0.05] hover:bg-amber-500/10
                      text-zinc-400 hover:text-amber-400
                      border border-white/[0.08] hover:border-amber-500/20
                      rounded-lg text-xs font-medium
                      active:scale-[0.97] transition-all duration-200"
                  >
                    <History size={12} />
                    Restaurar Original
                  </button>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Clock size={12} />
                    {new Date(prompt.updated_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                <textarea
                  readOnly
                  value={prompt.content}
                  className="w-full h-64 p-5 bg-transparent text-sm text-zinc-300 leading-relaxed resize-none outline-none font-mono"
                />
              </div>
            </section>

            {/* ── Divider ────────────────────────────────────────────── */}
            <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

            {/* ── Potenciômetros ──────────────────────────────────────── */}
            <section className="space-y-6">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Potenciômetros
              </h2>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-6">
                {SLIDERS.map((s, i) => (
                  <div key={s.key}>
                    <PotSlider
                      label={s.label}
                      value={sliders[s.key]}
                      onChange={(v) =>
                        setSliders((prev) => ({ ...prev, [s.key]: v }))
                      }
                      leftLabel={s.leftLabel}
                      rightLabel={s.rightLabel}
                    />
                    {i < SLIDERS.length - 1 && (
                      <div className="h-px bg-white/[0.04] mt-4" />
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ── Divider ────────────────────────────────────────────── */}
            <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

            {/* ── Free Instruction ────────────────────────────────────── */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Instrução Livre
              </h2>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                <textarea
                  value={freeInstruction}
                  onChange={(e) => setFreeInstruction(e.target.value)}
                  placeholder="Ex: reduza os neutrals para 3%, aumente a agressividade dos comentários de direita..."
                  className="w-full h-32 p-5 bg-transparent text-sm text-white placeholder:text-zinc-600 leading-relaxed resize-none outline-none"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="inline-flex items-center gap-2 px-6 py-3
                  bg-violet-500 hover:bg-violet-400
                  text-white font-semibold text-sm rounded-xl
                  shadow-lg shadow-violet-500/25 hover:shadow-violet-400/30
                  active:scale-[0.97] transition-all duration-200
                  disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {generating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {generating ? 'Gerando...' : 'Gerar Melhoria'}
              </button>
            </section>

            {/* ── Preview (after generation) ─────────────────────────── */}
            {previewPrompt && (
              <>
                <div className="h-px bg-gradient-to-r from-transparent via-violet-800/50 to-transparent" />

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                      <Zap size={18} className="text-violet-400" />
                      Preview da Melhoria
                    </h2>
                    <button
                      onClick={discardPreview}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
                    >
                      Descartar
                    </button>
                  </div>

                  {/* Warnings */}
                  {warnings.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-1">
                      {warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-400 flex items-start gap-2">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Changelog */}
                  {changelog.length > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-1">
                      {changelog.map((c, i) => (
                        <p key={i} className="text-sm text-emerald-400 flex items-start gap-2">
                          <Check size={14} className="mt-0.5 shrink-0" />
                          {c}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Preview text */}
                  <div className="bg-white/[0.03] border border-violet-500/20 rounded-2xl overflow-hidden">
                    <textarea
                      readOnly
                      value={previewPrompt}
                      className="w-full h-64 p-5 bg-transparent text-sm text-zinc-300 leading-relaxed resize-none outline-none font-mono"
                    />
                  </div>

                  {/* Save button */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirm(true)}
                      className="inline-flex items-center gap-2 px-6 py-3
                        bg-emerald-500 hover:bg-emerald-400
                        text-black font-semibold text-sm rounded-xl
                        shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30
                        active:scale-[0.97] transition-all duration-200"
                    >
                      <Save size={16} />
                      Salvar no Supabase
                    </button>
                    <button
                      onClick={discardPreview}
                      className="inline-flex items-center gap-2 px-5 py-3
                        bg-white/[0.05] hover:bg-white/[0.1]
                        text-zinc-300 hover:text-white
                        border border-white/[0.08] hover:border-white/[0.15]
                        rounded-xl font-medium text-sm
                        active:scale-[0.97] transition-all duration-200"
                    >
                      <RotateCcw size={16} />
                      Descartar
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* ── Divider ────────────────────────────────────────────── */}
            <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

            {/* ── Changelog History ───────────────────────────────────── */}
            <section>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setHistoryExpanded(!historyExpanded)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.03] transition-colors duration-200"
                >
                  <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <MessageCircle size={16} className="text-zinc-500" />
                    Histórico de Mudanças
                    {history.length > 0 && (
                      <span className="text-xs text-zinc-600">
                        ({history.length})
                      </span>
                    )}
                  </span>
                  {historyExpanded ? (
                    <ChevronDown size={16} className="text-zinc-500" />
                  ) : (
                    <ChevronRight size={16} className="text-zinc-500" />
                  )}
                </button>

                {historyExpanded && (
                  <div className="border-t border-white/[0.04]">
                    {history.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                          <MessageCircle size={32} className="text-zinc-600" />
                        </div>
                        <p className="text-zinc-500 text-sm">Nenhuma mudança registrada</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/[0.04]">
                        {history.map((entry, i) => (
                          <div key={entry.id || i} className="px-6 py-4 hover:bg-white/[0.02] transition-colors duration-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-zinc-400">
                                v{entry.version}
                              </span>
                              <div className="flex items-center gap-3">
                                {entry.previous_content && (
                                  <button
                                    onClick={() => handleRestoreFromHistory(entry.previous_content!)}
                                    disabled={restoringOriginal}
                                    className="inline-flex items-center gap-1 px-2 py-1
                                      bg-white/[0.05] hover:bg-amber-500/10
                                      text-zinc-500 hover:text-amber-400
                                      border border-white/[0.06] hover:border-amber-500/20
                                      rounded-lg text-[10px] font-medium
                                      active:scale-[0.97] transition-all duration-200
                                      disabled:opacity-50"
                                  >
                                    <RotateCcw size={10} />
                                    Restaurar anterior
                                  </button>
                                )}
                                <span className="text-xs text-zinc-600">
                                  {new Date(entry.created_at).toLocaleString('pt-BR')}
                                </span>
                              </div>
                            </div>
                            {entry.instruction && (
                              <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2 mb-2">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-violet-400/60 mb-1">
                                  Instrução
                                </p>
                                <p className="text-xs text-violet-300 italic">
                                  &ldquo;{entry.instruction}&rdquo;
                                </p>
                              </div>
                            )}
                            <div className="space-y-1">
                              {entry.changes.map((c, j) => (
                                <p key={j} className="text-sm text-zinc-400 flex items-start gap-2">
                                  <span className="text-emerald-500 shrink-0">+</span>
                                  {c}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {/* ── Confirm Modal ─────────────────────────────────────────────── */}
      <ConfirmSaveModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSave}
        changelog={changelog}
        warnings={warnings}
        loading={saving}
      />

      {/* ── Restore Original Modal ────────────────────────────────────── */}
      <ConfirmRestoreModal
        open={showRestoreOriginal}
        onClose={() => setShowRestoreOriginal(false)}
        onConfirm={handleRestoreOriginal}
        loading={restoringOriginal}
        title="Restaurar Prompt Original"
        description="Isso vai substituir o prompt atual pela versão original (que estava ativa quando a Prompt Arena foi criada). A versão atual será salva no histórico como backup."
      />

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
