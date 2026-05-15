"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  Clock,
  Film,
  Sparkles,
  Zap,
  Diamond,
  Info,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tabela de preços oficial Sync.so (@25fps) ────────────────────────────
// Fontes:
//   https://sync.so/docs/models/lipsync
//   https://sync.so/docs/models/sync-3
// Custo escala linearmente com fps: cost = duration × pricePerSec × (fps / 25)

type Model = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  minPerSec: number; // USD por segundo @25fps
  maxPerSec: number;
  resolution: string;
  icon: React.ReactNode;
  accent: "zinc" | "violet" | "emerald";
  badge?: string;
};

const MODELS: Model[] = [
  {
    id: "lipsync-2",
    name: "lipsync-2",
    tagline: "Econômico",
    description:
      "Lipsync natural que preserva o estilo de fala de cada locutor. Boa relação custo/qualidade para volume.",
    minPerSec: 0.04,
    maxPerSec: 0.05,
    resolution: "HD",
    icon: <Zap size={20} />,
    accent: "zinc",
  },
  {
    id: "lipsync-2-pro",
    name: "lipsync-2-pro",
    tagline: "Alta qualidade",
    description:
      "Diffusion super-resolution. Detalhes preservados em barba, dentes e textura facial.",
    minPerSec: 0.067,
    maxPerSec: 0.083,
    resolution: "HD+",
    icon: <Diamond size={20} />,
    accent: "violet",
  },
  {
    id: "sync-3",
    name: "sync-3",
    tagline: "Premium · Default",
    description:
      "Modelo mais poderoso. Processa o shot inteiro com detecção de obstrução, output 4K nativo e suporte a ângulos extremos.",
    minPerSec: 0.107,
    maxPerSec: 0.133,
    resolution: "4K nativo",
    icon: <Sparkles size={20} />,
    accent: "emerald",
    badge: "DEFAULT",
  },
];

const ACCENT_MAP = {
  zinc: {
    text: "text-zinc-300",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
    glow: "shadow-zinc-500/10",
    ring: "ring-zinc-400/30",
  },
  violet: {
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    glow: "shadow-violet-500/20",
    ring: "ring-violet-400/40",
  },
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow: "shadow-emerald-500/25",
    ring: "ring-emerald-400/40",
  },
};

// ── Formatadores ─────────────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  });

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDuration = (sec: number) => {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}min` : `${m}min ${s}s`;
};

// ── Página ───────────────────────────────────────────────────────────────

export default function CalculadoraSyncPage() {
  const [duration, setDuration] = useState<number>(30);
  const [fps, setFps] = useState<25 | 27>(25);
  const [usdToBrl, setUsdToBrl] = useState<number>(5.0);

  const fpsMultiplier = fps / 25;

  const rows = useMemo(() => {
    return MODELS.map((m) => {
      const minCostUsd = duration * m.minPerSec * fpsMultiplier;
      const maxCostUsd = duration * m.maxPerSec * fpsMultiplier;
      const avgCostUsd = (minCostUsd + maxCostUsd) / 2;
      return {
        ...m,
        minCostUsd,
        maxCostUsd,
        avgCostUsd,
        minCostBrl: minCostUsd * usdToBrl,
        maxCostBrl: maxCostUsd * usdToBrl,
        avgCostBrl: avgCostUsd * usdToBrl,
      };
    });
  }, [duration, fpsMultiplier, usdToBrl]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950 text-white">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-10 md:px-8 md:py-14">
        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <ArrowLeft size={14} />
              Voltar
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <Calculator size={22} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
                  Calculadora Sync.so
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Custo de lip-sync por segundo de vídeo · 3 modelos
                </p>
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-col gap-2">
            <a
              href="https://sync.so/docs/models/lipsync"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              docs Sync <ExternalLink size={11} />
            </a>
            <a
              href="https://sync.so/docs/models/sync-3"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/20"
            >
              sync-3 docs <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Controles */}
        <div className="mb-10 grid gap-4 md:grid-cols-3">
          {/* Duração */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <Clock size={12} /> Duração do vídeo
              </label>
              <span className="text-xs text-emerald-400">
                {fmtDuration(duration)}
              </span>
            </div>
            <input
              type="number"
              min={1}
              max={3600}
              step={1}
              value={duration}
              onChange={(e) =>
                setDuration(Math.max(1, Math.min(3600, Number(e.target.value) || 1)))
              }
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-lg font-semibold text-white outline-none transition-all duration-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="30"
            />
            <input
              type="range"
              min={1}
              max={300}
              step={1}
              value={Math.min(duration, 300)}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-3 w-full accent-emerald-500"
            />
            <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
              <span>1s</span>
              <span>1min</span>
              <span>3min</span>
              <span>5min</span>
            </div>
          </div>

          {/* FPS */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-2xl">
            <label className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <Film size={12} /> Frame rate
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[25, 27].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFps(opt as 25 | 27)}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.97]",
                    fps === opt
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-500/20"
                      : "border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:border-white/[0.15] hover:text-white"
                  )}
                >
                  {opt} fps
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
              Preço base é @25fps. Em {fps}fps o custo escala por{" "}
              <span className="text-zinc-400">×{fpsMultiplier.toFixed(2)}</span>
              .
            </p>
          </div>

          {/* USD → BRL */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-2xl">
            <label className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <span className="text-zinc-400">$</span> Câmbio USD → BRL
            </label>
            <input
              type="number"
              min={1}
              max={20}
              step={0.01}
              value={usdToBrl}
              onChange={(e) =>
                setUsdToBrl(Math.max(1, Math.min(20, Number(e.target.value) || 5)))
              }
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-lg font-semibold text-white outline-none transition-all duration-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
            />
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
              1 USD = {fmtBRL(usdToBrl)} · ajuste conforme cotação do dia
            </p>
          </div>
        </div>

        {/* Modelos */}
        <div className="grid gap-4 md:grid-cols-3">
          {rows.map((row) => {
            const accent = ACCENT_MAP[row.accent];
            return (
              <div
                key={row.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-white/[0.03] p-6 backdrop-blur-2xl transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-white/[0.05]",
                  accent.border,
                  "shadow-xl",
                  accent.glow
                )}
              >
                {row.badge && (
                  <div className="absolute right-4 top-4 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                    {row.badge}
                  </div>
                )}

                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "rounded-xl border p-2.5",
                      accent.bg,
                      accent.border,
                      accent.text
                    )}
                  >
                    {row.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-white">
                      {row.name}
                    </h3>
                    <p className={cn("text-xs font-medium", accent.text)}>
                      {row.tagline}
                    </p>
                  </div>
                </div>

                <p className="mb-5 text-xs leading-relaxed text-zinc-500">
                  {row.description}
                </p>

                {/* Preço destaque (médio) */}
                <div className="mb-5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    Custo estimado (médio)
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight text-white">
                      {fmtUSD(row.avgCostUsd)}
                    </span>
                  </div>
                  <span className={cn("text-sm font-medium", accent.text)}>
                    ≈ {fmtBRL(row.avgCostBrl)}
                  </span>
                </div>

                {/* Range min/max */}
                <div className="space-y-2 border-t border-white/[0.06] pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Mínimo</span>
                    <div className="text-right">
                      <span className="font-mono text-zinc-300">
                        {fmtUSD(row.minCostUsd)}
                      </span>
                      <span className="ml-2 text-zinc-600">
                        {fmtBRL(row.minCostBrl)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Máximo</span>
                    <div className="text-right">
                      <span className="font-mono text-zinc-300">
                        {fmtUSD(row.maxCostUsd)}
                      </span>
                      <span className="ml-2 text-zinc-600">
                        {fmtBRL(row.maxCostBrl)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detalhes técnicos */}
                <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-zinc-400">
                    {row.resolution}
                  </span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-zinc-400">
                    ${row.minPerSec.toFixed(3)} – ${row.maxPerSec.toFixed(3)}/s @25fps
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabela comparativa rápida */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-2xl">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              Comparativo lado-a-lado
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {fmtDuration(duration)} @ {fps}fps · câmbio {fmtBRL(usdToBrl)}/USD
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Modelo</th>
                  <th className="px-5 py-3">Mín (USD)</th>
                  <th className="px-5 py-3">Médio (USD)</th>
                  <th className="px-5 py-3">Máx (USD)</th>
                  <th className="px-5 py-3 text-right">Médio (BRL)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const accent = ACCENT_MAP[row.accent];
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", accent.bg, "ring-2", accent.ring)} />
                          <span className="font-medium text-white">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                        {fmtUSD(row.minCostUsd)}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-white">
                        {fmtUSD(row.avgCostUsd)}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                        {fmtUSD(row.maxCostUsd)}
                      </td>
                      <td className={cn("px-5 py-4 text-right font-semibold", accent.text)}>
                        {fmtBRL(row.avgCostBrl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nota de cálculo */}
        <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-relaxed text-zinc-500">
          <Info size={14} className="mt-0.5 shrink-0 text-zinc-600" />
          <p>
            Preços base extraídos das páginas oficiais da Sync.so (cotados @25fps). Custo
            calculado como{" "}
            <span className="font-mono text-zinc-400">
              duração × preço/seg × (fps/25)
            </span>
            . O custo final pode variar dentro da faixa (mín–máx) conforme complexidade da
            cena, número de faces e processamento.
          </p>
        </div>
      </div>
    </div>
  );
}
