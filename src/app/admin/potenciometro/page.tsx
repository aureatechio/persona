'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Sliders,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  History,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchDistribution,
  previewRebalance,
  applyRebalance,
  listSnapshots,
  restoreSnapshot,
  type DistributionResult,
  type PreviewResult,
  type RebalanceParams,
  type SnapshotInfo,
} from '@/app/actions/potenciometroActions';
import {
  POLITICAL_LEANING_ORDER,
  POLITICAL_COLORS,
  MACRO_LABELS,
} from '@/lib/potenciometro/derivation';
import { MACRO_COLORS } from '@/lib/arena/constants';

// ── Slider Component ────────────────────────────────────────────────────────

function PotSlider({
  label,
  value,
  onChange,
  min = -0.5,
  max = 0.5,
  step = 0.01,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
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
          {/* Track background */}
          <div className="absolute inset-x-0 h-2 rounded-full bg-zinc-800/80" />
          {/* Active fill */}
          <div
            className="absolute h-2 rounded-full transition-all duration-150"
            style={{
              left: value >= 0 ? '50%' : `${((value - min) / (max - min)) * 100}%`,
              right: value < 0 ? '50%' : `${100 - ((value - min) / (max - min)) * 100}%`,
              backgroundColor: value > 0 ? '#38bdf8' : value < 0 ? '#f87171' : '#52525b',
              opacity: 0.6,
            }}
          />
          {/* Center mark */}
          <div className="absolute left-1/2 -translate-x-px w-0.5 h-4 bg-zinc-600 rounded-full" />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
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
      {/* Double-click to reset */}
      <button
        onClick={() => onChange(0)}
        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors duration-200"
      >
        Resetar eixo
      </button>
    </div>
  );
}

// ── Stacked Bar ─────────────────────────────────────────────────────────────

function StackedBar({
  data,
  total,
  label,
}: {
  data: Record<string, number>;
  total: number;
  label?: string;
}) {
  if (total === 0) return null;

  const ordered = POLITICAL_LEANING_ORDER.filter((l) => (data[l] || 0) > 0);

  return (
    <div className="space-y-2">
      {label && (
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      )}
      <div className="h-8 rounded-full overflow-hidden flex bg-zinc-900/80">
        {ordered.map((leaning) => {
          const count = data[leaning] || 0;
          const pct = (count / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={leaning}
              className="h-full transition-all duration-700 ease-out relative group/seg"
              style={{
                width: `${pct}%`,
                backgroundColor: POLITICAL_COLORS[leaning] || '#71717a',
                opacity: 0.8,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/seg:opacity-100 transition-opacity duration-200">
                <span className="text-[9px] font-bold text-white drop-shadow-lg whitespace-nowrap">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Delta Table ─────────────────────────────────────────────────────────────

function DeltaTable({
  changes,
  total,
}: {
  changes: Record<string, { from: number; to: number; delta: number }>;
  total: number;
}) {
  const rows = POLITICAL_LEANING_ORDER.filter(
    (l) => changes[l] && (changes[l].from > 0 || changes[l].to > 0),
  );

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Categoria
            </th>
            <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Atual
            </th>
            <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Previsto
            </th>
            <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Delta
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((leaning) => {
            const c = changes[leaning];
            const pctFrom = total > 0 ? ((c.from / total) * 100).toFixed(1) : '0';
            const pctTo = total > 0 ? ((c.to / total) * 100).toFixed(1) : '0';
            return (
              <tr
                key={leaning}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-200"
              >
                <td className="px-4 py-2.5 flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: POLITICAL_COLORS[leaning] }}
                  />
                  <span className="text-zinc-300 text-sm">{leaning}</span>
                </td>
                <td className="text-right px-4 py-2.5 text-zinc-400 tabular-nums">
                  {c.from.toLocaleString('pt-BR')}{' '}
                  <span className="text-zinc-600 text-xs">({pctFrom}%)</span>
                </td>
                <td className="text-right px-4 py-2.5 text-white font-medium tabular-nums">
                  {c.to.toLocaleString('pt-BR')}{' '}
                  <span className="text-zinc-500 text-xs">({pctTo}%)</span>
                </td>
                <td className="text-right px-4 py-2.5 tabular-nums">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-sm font-semibold',
                      c.delta > 0
                        ? 'text-emerald-400'
                        : c.delta < 0
                          ? 'text-red-400'
                          : 'text-zinc-600',
                    )}
                  >
                    {c.delta > 0 ? (
                      <ArrowUp size={12} />
                    ) : c.delta < 0 ? (
                      <ArrowDown size={12} />
                    ) : (
                      <Minus size={12} />
                    )}
                    {c.delta > 0 ? '+' : ''}
                    {c.delta.toLocaleString('pt-BR')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Macro Stat Card ─────────────────────────────────────────────────────────

function MacroCard({
  macro,
  count,
  total,
}: {
  macro: string;
  count: number;
  total: number;
}) {
  const label = MACRO_LABELS[macro] || macro;
  const colors = MACRO_COLORS[label] || {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-400',
  };
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';

  return (
    <div
      className={cn(
        'bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-2',
        'hover:bg-white/[0.05] transition-all duration-300',
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full', colors.dot)} />
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      </div>
      <span className="text-2xl font-bold text-white tabular-nums">
        {count.toLocaleString('pt-BR')}
      </span>
      <span className={cn('text-xs', colors.text)}>{pct}% do total</span>
    </div>
  );
}

// ── Confirmation Modal ──────────────────────────────────────────────────────

function ConfirmModal({
  open,
  onClose,
  onConfirm,
  changes,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  changes: Record<string, { from: number; to: number; delta: number }> | null;
  loading: boolean;
}) {
  if (!open) return null;

  const totalMoved = changes
    ? Object.values(changes).reduce((sum, c) => sum + Math.abs(c.delta), 0) / 2
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Confirmar Rebalanceamento
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              Esta ação vai alterar os scores de todas as personas. Um snapshot
              será salvo automaticamente antes da alteração.
            </p>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6">
          <p className="text-sm text-zinc-300">
            ~
            <span className="font-bold text-white">
              {Math.round(totalMoved).toLocaleString('pt-BR')}
            </span>{' '}
            personas serão movidas entre categorias
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
              bg-emerald-500 hover:bg-emerald-400
              text-black font-semibold text-sm rounded-xl
              shadow-lg shadow-emerald-500/25
              active:scale-[0.97] transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {loading ? 'Aplicando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Snapshot Drawer ─────────────────────────────────────────────────────────

function SnapshotDrawer({
  open,
  onClose,
  snapshots,
  onRestore,
  restoring,
}: {
  open: boolean;
  onClose: () => void;
  snapshots: SnapshotInfo[];
  onRestore: (id: string) => void;
  restoring: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl shadow-black/60 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History size={20} className="text-zinc-400" />
            <h3 className="text-lg font-semibold text-white">Snapshots</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
              <History size={32} className="text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm">Nenhum snapshot encontrado</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all duration-200"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    {snap.label}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(snap.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={() => onRestore(snap.id)}
                  disabled={restoring}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5
                    bg-white/[0.05] hover:bg-white/[0.1]
                    text-zinc-300 hover:text-white text-xs font-medium
                    border border-white/[0.08] hover:border-white/[0.15]
                    rounded-lg active:scale-[0.97] transition-all duration-200
                    disabled:opacity-50"
                >
                  <RotateCcw size={12} />
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Main Page ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export default function PotenciometroPage() {
  // ── State ───────────────────────────────────────────────────────────────
  const [distribution, setDistribution] = useState<DistributionResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const [globalDeltaEco, setGlobalDeltaEco] = useState(0);
  const [globalDeltaCost, setGlobalDeltaCost] = useState(0);

  const [macroExpanded, setMacroExpanded] = useState(false);
  const [macroOverrides, setMacroOverrides] = useState<
    Record<string, { deltaEco: number; deltaCost: number }>
  >({});
  const [macroEnabled, setMacroEnabled] = useState<Record<string, boolean>>({});

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Load distribution on mount ──────────────────────────────────────────
  useEffect(() => {
    loadDistribution();
  }, []);

  async function loadDistribution() {
    setLoading(true);
    try {
      const dist = await fetchDistribution();
      setDistribution(dist);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
    setLoading(false);
  }

  // ── Build params ────────────────────────────────────────────────────────
  const buildParams = useCallback((): RebalanceParams => {
    const overrides: Record<string, { deltaEco: number; deltaCost: number }> = {};
    for (const macro of ['P', 'M', 'C', 'T']) {
      if (macroEnabled[macro] && macroOverrides[macro]) {
        overrides[macro] = macroOverrides[macro];
      }
    }
    return {
      globalDeltaEco,
      globalDeltaCost,
      macroOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    };
  }, [globalDeltaEco, globalDeltaCost, macroOverrides, macroEnabled]);

  // ── Debounced preview ───────────────────────────────────────────────────
  const triggerPreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const params = buildParams();
      const hasChange =
        params.globalDeltaEco !== 0 ||
        params.globalDeltaCost !== 0 ||
        Object.values(params.macroOverrides || {}).some(
          (o) => o.deltaEco !== 0 || o.deltaCost !== 0,
        );

      if (!hasChange) {
        setPreview(null);
        return;
      }

      setPreviewing(true);
      try {
        const result = await previewRebalance(params);
        setPreview(result);
      } catch (e: any) {
        showToast(e.message, 'error');
      }
      setPreviewing(false);
    }, 300);
  }, [buildParams]);

  // Trigger preview when sliders change
  useEffect(() => {
    triggerPreview();
  }, [globalDeltaEco, globalDeltaCost, macroOverrides, macroEnabled, triggerPreview]);

  // ── Apply ───────────────────────────────────────────────────────────────
  async function handleApply() {
    setApplying(true);
    const result = await applyRebalance(buildParams());
    setApplying(false);
    setShowConfirm(false);

    if (result.success) {
      showToast('Rebalanceamento aplicado com sucesso!', 'success');
      // Reset sliders
      setGlobalDeltaEco(0);
      setGlobalDeltaCost(0);
      setMacroOverrides({});
      setMacroEnabled({});
      setPreview(null);
      await loadDistribution();
    } else {
      showToast(result.error || 'Erro ao aplicar', 'error');
    }
  }

  // ── Restore ─────────────────────────────────────────────────────────────
  async function handleRestore(snapshotId: string) {
    setRestoring(true);
    const result = await restoreSnapshot(snapshotId);
    setRestoring(false);
    setShowSnapshots(false);

    if (result.success) {
      showToast('Snapshot restaurado com sucesso!', 'success');
      setGlobalDeltaEco(0);
      setGlobalDeltaCost(0);
      setMacroOverrides({});
      setMacroEnabled({});
      setPreview(null);
      await loadDistribution();
    } else {
      showToast(result.error || 'Erro ao restaurar', 'error');
    }
  }

  // ── Open snapshots drawer ───────────────────────────────────────────────
  async function openSnapshots() {
    const snaps = await listSnapshots();
    setSnapshots(snaps);
    setShowSnapshots(true);
  }

  // ── Toast ───────────────────────────────────────────────────────────────
  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Macro override helpers ──────────────────────────────────────────────
  function setMacroOverride(
    macro: string,
    field: 'deltaEco' | 'deltaCost',
    value: number,
  ) {
    setMacroOverrides((prev) => ({
      ...prev,
      [macro]: {
        deltaEco: prev[macro]?.deltaEco ?? 0,
        deltaCost: prev[macro]?.deltaCost ?? 0,
        [field]: value,
      },
    }));
  }

  function toggleMacro(macro: string) {
    setMacroEnabled((prev) => ({ ...prev, [macro]: !prev[macro] }));
  }

  // ── Has any change ─────────────────────────────────────────────────────
  const hasChange =
    globalDeltaEco !== 0 ||
    globalDeltaCost !== 0 ||
    Object.entries(macroEnabled).some(
      ([macro, enabled]) =>
        enabled &&
        macroOverrides[macro] &&
        (macroOverrides[macro].deltaEco !== 0 || macroOverrides[macro].deltaCost !== 0),
    );

  // ═════════════════════════════════════════════════════════════════════════
  // ── Render ──────────────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-black">
      {/* Decorative orbs */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto p-6 md:p-8 lg:p-10 space-y-8">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <Sliders size={22} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Potenciômetro Político
              </h1>
              <p className="text-zinc-500 text-sm mt-0.5">
                Controle de distribuição ideológica
                {distribution && (
                  <span className="text-zinc-400">
                    {' '}
                    · {distribution.total.toLocaleString('pt-BR')} personas
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ── Loading State ──────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-zinc-900/50 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        )}

        {distribution && !loading && (
          <>
            {/* ── Current Distribution ───────────────────────────────── */}
            <section className="space-y-6">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Distribuição Atual
              </h2>

              <StackedBar
                data={distribution.byLeaning}
                total={distribution.total}
                label="Espectro político"
              />

              {/* Macro cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['P', 'M', 'C', 'T'].map((macro) => (
                  <MacroCard
                    key={macro}
                    macro={macro}
                    count={distribution.byMacro[macro] || 0}
                    total={distribution.total}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3">
                {POLITICAL_LEANING_ORDER.filter(
                  (l) => (distribution.byLeaning[l] || 0) > 0,
                ).map((leaning) => (
                  <div key={leaning} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: POLITICAL_COLORS[leaning] }}
                    />
                    <span className="text-xs text-zinc-500">{leaning}</span>
                    <span className="text-xs text-zinc-600 tabular-nums">
                      ({((distribution.byLeaning[leaning] || 0) / distribution.total * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Divider ────────────────────────────────────────────── */}
            <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

            {/* ── Controls ───────────────────────────────────────────── */}
            <section className="space-y-6">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Controles
              </h2>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-6">
                <PotSlider
                  label="Eixo Econômico (Global)"
                  value={globalDeltaEco}
                  onChange={setGlobalDeltaEco}
                  leftLabel="← Estado"
                  rightLabel="Mercado →"
                />

                <div className="h-px bg-white/[0.04]" />

                <PotSlider
                  label="Eixo Costumes (Global)"
                  value={globalDeltaCost}
                  onChange={setGlobalDeltaCost}
                  leftLabel="← Progressista"
                  rightLabel="Conservador →"
                />
              </div>

              {/* Per-macro overrides */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setMacroExpanded(!macroExpanded)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.03] transition-colors duration-200"
                >
                  <span className="text-sm font-medium text-zinc-300">
                    Ajustes por Grupo Macro
                  </span>
                  {macroExpanded ? (
                    <ChevronDown size={16} className="text-zinc-500" />
                  ) : (
                    <ChevronRight size={16} className="text-zinc-500" />
                  )}
                </button>

                {macroExpanded && (
                  <div className="border-t border-white/[0.04] p-6 space-y-6">
                    <p className="text-xs text-zinc-500">
                      Ative um grupo para sobrescrever os controles globais com
                      ajustes individuais.
                    </p>
                    {['P', 'M', 'C', 'T'].map((macro) => {
                      const label = MACRO_LABELS[macro];
                      const colors = MACRO_COLORS[label] || {
                        bg: 'bg-zinc-500/10',
                        text: 'text-zinc-400',
                        border: 'border-zinc-500/20',
                      };
                      const enabled = macroEnabled[macro] || false;
                      const overr = macroOverrides[macro] || {
                        deltaEco: 0,
                        deltaCost: 0,
                      };

                      return (
                        <div key={macro} className="space-y-3">
                          <button
                            onClick={() => toggleMacro(macro)}
                            className="flex items-center gap-3"
                          >
                            <div
                              className={cn(
                                'w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all duration-200',
                                enabled
                                  ? 'bg-emerald-500 border-emerald-500'
                                  : 'border-zinc-600 bg-transparent',
                              )}
                            >
                              {enabled && (
                                <Check size={10} className="text-black" />
                              )}
                            </div>
                            <span
                              className={cn(
                                'text-sm font-medium',
                                enabled ? 'text-white' : 'text-zinc-500',
                              )}
                            >
                              {label} ({macro})
                            </span>
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full',
                                colors.bg,
                                colors.text,
                                'border',
                                colors.border,
                              )}
                            >
                              {(distribution.byMacro[macro] || 0).toLocaleString(
                                'pt-BR',
                              )}
                            </span>
                          </button>

                          {enabled && (
                            <div className="pl-7 space-y-4">
                              <PotSlider
                                label={`Econômico (${label})`}
                                value={overr.deltaEco}
                                onChange={(v) =>
                                  setMacroOverride(macro, 'deltaEco', v)
                                }
                                leftLabel="← Estado"
                                rightLabel="Mercado →"
                              />
                              <PotSlider
                                label={`Costumes (${label})`}
                                value={overr.deltaCost}
                                onChange={(v) =>
                                  setMacroOverride(macro, 'deltaCost', v)
                                }
                                leftLabel="← Progressista"
                                rightLabel="Conservador →"
                              />
                            </div>
                          )}

                          {macro !== 'T' && (
                            <div className="h-px bg-white/[0.03]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* ── Preview ────────────────────────────────────────────── */}
            {(preview || previewing) && (
              <>
                <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

                <section className="space-y-6">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white tracking-tight">
                      Preview
                    </h2>
                    {previewing && (
                      <div className="w-4 h-4 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
                    )}
                  </div>

                  {preview && (
                    <>
                      <StackedBar
                        data={preview.preview.byLeaning}
                        total={preview.preview.total}
                        label="Distribuição prevista"
                      />

                      <DeltaTable
                        changes={preview.changes}
                        total={preview.current.total}
                      />
                    </>
                  )}
                </section>
              </>
            )}

            {/* ── Divider ────────────────────────────────────────────── */}
            <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

            {/* ── Actions ────────────────────────────────────────────── */}
            <section className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!hasChange || applying}
                className="inline-flex items-center gap-2 px-6 py-3
                  bg-emerald-500 hover:bg-emerald-400
                  text-black font-semibold text-sm rounded-xl
                  shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30
                  active:scale-[0.97] transition-all duration-200
                  disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Zap size={16} />
                Aplicar Mudanças
              </button>

              <button
                onClick={openSnapshots}
                className="inline-flex items-center gap-2 px-5 py-3
                  bg-white/[0.05] hover:bg-white/[0.1]
                  text-zinc-300 hover:text-white
                  border border-white/[0.08] hover:border-white/[0.15]
                  rounded-xl font-medium text-sm
                  active:scale-[0.97] transition-all duration-200"
              >
                <History size={16} />
                Snapshots
              </button>

              <button
                onClick={() => {
                  setGlobalDeltaEco(0);
                  setGlobalDeltaCost(0);
                  setMacroOverrides({});
                  setMacroEnabled({});
                  setPreview(null);
                }}
                disabled={!hasChange}
                className="inline-flex items-center gap-2 px-5 py-3
                  bg-white/[0.05] hover:bg-white/[0.1]
                  text-zinc-300 hover:text-white
                  border border-white/[0.08] hover:border-white/[0.15]
                  rounded-xl font-medium text-sm
                  active:scale-[0.97] transition-all duration-200
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <RotateCcw size={16} />
                Limpar Sliders
              </button>
            </section>
          </>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleApply}
        changes={preview?.changes || null}
        loading={applying}
      />

      <SnapshotDrawer
        open={showSnapshots}
        onClose={() => setShowSnapshots(false)}
        snapshots={snapshots}
        onRestore={handleRestore}
        restoring={restoring}
      />

      {/* ── Toast ───────────────────────────────────────────────────── */}
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
