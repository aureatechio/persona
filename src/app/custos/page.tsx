"use client";

import { useState, useMemo } from "react";
import {
  Sliders,
  Calculator,
  TrendingUp,
  Users,
  Video,
  Instagram,
  Server,
  Cpu,
  Code,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ── Cost Data Structures ────────────────────────────────────────────────

interface FixedCost {
  name: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  scalable?: boolean; // if true, this cost scales with volume tiers
  scaleTiers?: { maxDaily: number; cost: number }[];
}

interface Product {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string; // tailwind color for accents
  fixedCosts: FixedCost[];
  variableCostPerUnit: number;
  variableCostLabel: string;
  unitLabel: string;
  dailyDefault: number;
  dailyMin: number;
  dailyMax: number;
  dailyStep: number;
}

const products: Product[] = [
  {
    id: "personas",
    name: "Arena Personas",
    subtitle: "Análise de sentimento com 20k personas sintéticas",
    icon: <Users size={22} />,
    color: "emerald",
    fixedCosts: [
      { name: "Vercel", value: 100, description: "Hospedagem código", icon: <Server size={16} /> },
      { name: "Digital Ocean", value: 200, description: "Infra Python análise", icon: <Cpu size={16} />, scalable: true, scaleTiers: [{ maxDaily: 50, cost: 200 }, { maxDaily: 200, cost: 400 }, { maxDaily: 500, cost: 800 }, { maxDaily: 1000, cost: 1200 }, { maxDaily: 3000, cost: 2000 }, { maxDaily: 5000, cost: 3000 }] },
      { name: "ChatGPT", value: 200, description: "Estrutura prompts de análise", icon: <Brain size={16} /> },
      { name: "Claude", value: 1000, description: "Análises + verificação prompts + Cursor", icon: <Sparkles size={16} /> },
      { name: "Cursor IDE", value: 300, description: "Ferramenta IDE", icon: <Code size={16} /> },
      { name: "2 Analistas Estatísticos", value: 8000, description: "Melhorar respostas de personas", icon: <Users size={16} /> },
      { name: "1 Dev Full-time", value: 6000, description: "Manter e melhorar estrutura", icon: <Code size={16} /> },
    ],
    variableCostPerUnit: 10,
    variableCostLabel: "Tokens GPT por análise",
    unitLabel: "análise",
    dailyDefault: 10,
    dailyMin: 1,
    dailyMax: 5000,
    dailyStep: 1,
  },
  {
    id: "selfie",
    name: "Self Video",
    subtitle: "Vídeo personalizado com lip-sync e IA",
    icon: <Video size={22} />,
    color: "violet",
    fixedCosts: [
      { name: "Vercel", value: 100, description: "Hospedagem código", icon: <Server size={16} /> },
      { name: "Digital Ocean", value: 100, description: "Processamento Python vídeo", icon: <Cpu size={16} />, scalable: true, scaleTiers: [{ maxDaily: 10, cost: 100 }, { maxDaily: 50, cost: 300 }, { maxDaily: 200, cost: 600 }, { maxDaily: 500, cost: 1000 }, { maxDaily: 1000, cost: 1800 }, { maxDaily: 3000, cost: 3000 }, { maxDaily: 5000, cost: 5000 }] },
      { name: "ChatGPT", value: 200, description: "Prompts de análise", icon: <Brain size={16} /> },
      { name: "Claude", value: 200, description: "Prompts e rotina", icon: <Sparkles size={16} /> },
      { name: "Cursor IDE", value: 300, description: "IDE de programação", icon: <Code size={16} /> },
      { name: "1 Dev", value: 6000, description: "Estrutura funcional", icon: <Code size={16} /> },
    ],
    variableCostPerUnit: 5,
    variableCostLabel: "Lip-sync por vídeo",
    unitLabel: "vídeo",
    dailyDefault: 10,
    dailyMin: 1,
    dailyMax: 5000,
    dailyStep: 1,
  },
  {
    id: "instagram",
    name: "Análise Seguidores",
    subtitle: "Mapeamento e análise de seguidores Instagram",
    icon: <Instagram size={22} />,
    color: "sky",
    fixedCosts: [
      { name: "Vercel", value: 100, description: "Hospedagem código", icon: <Server size={16} /> },
      { name: "Digital Ocean", value: 100, description: "Processamento scraping", icon: <Cpu size={16} />, scalable: true, scaleTiers: [{ maxDaily: 100, cost: 100 }, { maxDaily: 500, cost: 250 }, { maxDaily: 1000, cost: 500 }, { maxDaily: 3000, cost: 1000 }, { maxDaily: 5000, cost: 1500 }] },
      { name: "ChatGPT", value: 200, description: "Análise de perfis", icon: <Brain size={16} /> },
      { name: "Claude", value: 200, description: "Classificação e insights", icon: <Sparkles size={16} /> },
      { name: "Cursor IDE", value: 300, description: "IDE de programação", icon: <Code size={16} /> },
      { name: "1 Dev (compartilhado)", value: 3000, description: "Manutenção", icon: <Code size={16} /> },
    ],
    variableCostPerUnit: 1,
    variableCostLabel: "Tokens por análise de seguidor",
    unitLabel: "análise",
    dailyDefault: 10,
    dailyMin: 1,
    dailyMax: 5000,
    dailyStep: 1,
  },
];

// ── Helper Functions ────────────────────────────────────────────────────

function formatBRL(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return `R$ ${value.toFixed(2)}`;
}

function formatBRLFull(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function getScaledCost(cost: FixedCost, dailyVolume: number): number {
  if (!cost.scalable || !cost.scaleTiers) return cost.value;
  for (const tier of cost.scaleTiers) {
    if (dailyVolume <= tier.maxDaily) return tier.cost;
  }
  return cost.scaleTiers[cost.scaleTiers.length - 1].cost;
}

function getSliderBackground(value: number, min: number, max: number, color: string): string {
  const pct = ((value - min) / (max - min)) * 100;
  const colorMap: Record<string, string> = {
    emerald: "#10b981",
    violet: "#8b5cf6",
    sky: "#0ea5e9",
  };
  const c = colorMap[color] || "#10b981";
  return `linear-gradient(to right, ${c} 0%, ${c} ${pct}%, #27272a ${pct}%, #27272a 100%)`;
}

// ── Product Card Component ──────────────────────────────────────────────

function ProductCard({
  product,
  daily,
  onDailyChange,
}: {
  product: Product;
  daily: number;
  onDailyChange: (v: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const monthly = daily * 30;
  const fixedTotal = product.fixedCosts.reduce(
    (sum, c) => sum + getScaledCost(c, daily),
    0
  );
  const variableTotal = monthly * product.variableCostPerUnit;
  const totalMonthly = fixedTotal + variableTotal;
  const costPerUnit = totalMonthly / monthly;

  const colorClasses: Record<string, { bg: string; border: string; text: string; glow: string; badge: string; slider: string }> = {
    emerald: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
      glow: "shadow-emerald-500/20",
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
      slider: "accent-emerald-500",
    },
    violet: {
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      text: "text-violet-400",
      glow: "shadow-violet-500/20",
      badge: "bg-violet-500/15 text-violet-400 border-violet-500/25",
      slider: "accent-violet-500",
    },
    sky: {
      bg: "bg-sky-500/10",
      border: "border-sky-500/30",
      text: "text-sky-400",
      glow: "shadow-sky-500/20",
      badge: "bg-sky-500/15 text-sky-400 border-sky-500/25",
      slider: "accent-sky-500",
    },
  };
  const colors = colorClasses[product.color];

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 transition-all duration-300 hover:border-white/[0.12]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", colors.bg, colors.text)}>
            {product.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{product.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{product.subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white tracking-tight">{formatBRLFull(totalMonthly)}</p>
          <p className="text-xs text-zinc-500">/mês</p>
        </div>
      </div>

      {/* Slider */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Volume diário
          </span>
          <span className={cn("text-sm font-bold", colors.text)}>
            {daily.toLocaleString("pt-BR")} {daily === 1 ? product.unitLabel : product.unitLabel + "s"}/dia
          </span>
        </div>
        <input
          type="range"
          min={product.dailyMin}
          max={product.dailyMax}
          step={product.dailyStep}
          value={daily}
          onChange={(e) => onDailyChange(Number(e.target.value))}
          className={cn("w-full h-2 rounded-full appearance-none cursor-pointer", colors.slider)}
          style={{
            background: getSliderBackground(daily, product.dailyMin, product.dailyMax, product.color),
          }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-zinc-600">{product.dailyMin}</span>
          <span className="text-[10px] text-zinc-600">{product.dailyMax.toLocaleString("pt-BR")}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">Custo/unidade</p>
          <p className="text-sm font-bold text-white">{formatBRLFull(costPerUnit)}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">Fixo</p>
          <p className="text-sm font-bold text-white">{formatBRL(fixedTotal)}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">Variável</p>
          <p className="text-sm font-bold text-white">{formatBRL(variableTotal)}</p>
        </div>
      </div>

      {/* Variable cost callout */}
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border mb-4", colors.badge)}>
        <DollarSign size={14} />
        <span className="text-xs font-medium">
          {formatBRLFull(product.variableCostPerUnit)} × {monthly.toLocaleString("pt-BR")} {product.unitLabel}s/mês = {formatBRLFull(variableTotal)}
        </span>
      </div>

      {/* Expandable breakdown */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-200 w-full"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span>Detalhamento custos fixos</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {product.fixedCosts.map((cost) => {
            const scaledCost = getScaledCost(cost, daily);
            const isScaled = cost.scalable && scaledCost !== cost.value;
            return (
              <div
                key={cost.name}
                className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600">{cost.icon}</span>
                  <div>
                    <p className="text-xs text-zinc-300">{cost.name}</p>
                    <p className="text-[10px] text-zinc-600">{cost.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-white">{formatBRLFull(scaledCost)}</p>
                  {isScaled && (
                    <p className="text-[10px] text-amber-400">↑ escalou de {formatBRLFull(cost.value)}</p>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] rounded-xl border border-white/[0.06]">
            <span className="text-xs font-medium text-zinc-300">{product.variableCostLabel}</span>
            <span className="text-xs font-medium text-white">{formatBRLFull(product.variableCostPerUnit)} × {monthly.toLocaleString("pt-BR")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────────────────────

export default function CustosPage() {
  const [dailyVolumes, setDailyVolumes] = useState<Record<string, number>>(
    Object.fromEntries(products.map((p) => [p.id, p.dailyDefault]))
  );

  const setVolume = (id: string, v: number) =>
    setDailyVolumes((prev) => ({ ...prev, [id]: v }));

  // ── Compute totals ──
  const totals = useMemo(() => {
    let grandFixed = 0;
    let grandVariable = 0;
    const perProduct: Record<string, { fixed: number; variable: number; total: number; monthly: number; costPerUnit: number }> = {};

    for (const p of products) {
      const daily = dailyVolumes[p.id] || p.dailyDefault;
      const monthly = daily * 30;
      const fixed = p.fixedCosts.reduce((s, c) => s + getScaledCost(c, daily), 0);
      const variable = monthly * p.variableCostPerUnit;
      grandFixed += fixed;
      grandVariable += variable;
      perProduct[p.id] = { fixed, variable, total: fixed + variable, monthly, costPerUnit: (fixed + variable) / monthly };
    }

    return { grandFixed, grandVariable, grandTotal: grandFixed + grandVariable, perProduct };
  }, [dailyVolumes]);

  // ── Budget calculator ──
  const [budget, setBudget] = useState(100000);

  const monthsWithBudget = totals.grandTotal > 0 ? budget / totals.grandTotal : 0;

  return (
    <div className="min-h-screen bg-black">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Projeção de Custos</h1>
              <p className="text-zinc-500 mt-1">Infraestrutura por produto — ajuste o volume e veja os custos escalar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "inline-flex items-center gap-2 px-4 py-2",
              "bg-white/[0.05] border border-white/[0.08] rounded-xl",
            )}>
              <Calculator size={16} className="text-zinc-400" />
              <span className="text-sm text-zinc-300">
                {Object.values(dailyVolumes).reduce((s, v) => s + v, 0).toLocaleString("pt-BR")} operações/dia
              </span>
            </div>
          </div>
        </div>

        {/* Grand Total Banner */}
        <div className="relative overflow-hidden bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-violet-500/5 to-sky-500/5" />
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Custo Mensal Total</p>
              <p className="text-3xl md:text-4xl font-bold text-white tracking-tight">{formatBRLFull(totals.grandTotal)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Custos Fixos</p>
              <p className="text-2xl font-bold text-zinc-300">{formatBRLFull(totals.grandFixed)}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{totals.grandTotal > 0 ? ((totals.grandFixed / totals.grandTotal) * 100).toFixed(0) : 0}% do total</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Custos Variáveis</p>
              <p className="text-2xl font-bold text-zinc-300">{formatBRLFull(totals.grandVariable)}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{totals.grandTotal > 0 ? ((totals.grandVariable / totals.grandTotal) * 100).toFixed(0) : 0}% do total</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Custo Anual Projetado</p>
              <p className="text-2xl font-bold text-zinc-300">{formatBRLFull(totals.grandTotal * 12)}</p>
            </div>
          </div>

          {/* Per-product mini bars */}
          <div className="relative mt-6 pt-6 border-t border-white/[0.06]">
            <div className="flex gap-2 h-3 rounded-full overflow-hidden bg-zinc-900">
              {products.map((p) => {
                const pct = totals.grandTotal > 0 ? (totals.perProduct[p.id].total / totals.grandTotal) * 100 : 33;
                const bgMap: Record<string, string> = {
                  emerald: "bg-emerald-500",
                  violet: "bg-violet-500",
                  sky: "bg-sky-500",
                };
                return (
                  <div
                    key={p.id}
                    className={cn("rounded-full transition-all duration-500", bgMap[p.color])}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2">
              {products.map((p) => {
                const pct = totals.grandTotal > 0 ? (totals.perProduct[p.id].total / totals.grandTotal) * 100 : 33;
                const textMap: Record<string, string> = {
                  emerald: "text-emerald-400",
                  violet: "text-violet-400",
                  sky: "text-sky-400",
                };
                return (
                  <span key={p.id} className={cn("text-[10px] font-medium", textMap[p.color])}>
                    {p.name}: {pct.toFixed(0)}%
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Budget Simulator */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <DollarSign size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Simulador de Orçamento</p>
                <p className="text-xs text-zinc-500">Com quanto tempo esse orçamento dura?</p>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-1">
              <input
                type="range"
                min={10000}
                max={1000000}
                step={10000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-amber-500"
                style={{
                  background: getSliderBackground(budget, 10000, 1000000, "emerald"),
                }}
              />
              <div className="text-right min-w-[140px]">
                <p className="text-lg font-bold text-amber-400">{formatBRLFull(budget)}</p>
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-center min-w-[120px]">
              <p className="text-xl font-bold text-amber-400">
                {monthsWithBudget >= 12
                  ? `${(monthsWithBudget / 12).toFixed(1)} anos`
                  : `${monthsWithBudget.toFixed(1)} meses`}
              </p>
              <p className="text-[10px] text-amber-500/70 uppercase tracking-wider">duração</p>
            </div>
          </div>
        </div>

        {/* Product Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              daily={dailyVolumes[p.id]}
              onDailyChange={(v) => setVolume(p.id, v)}
            />
          ))}
        </div>

        {/* Comparison Table */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-xl font-semibold text-white tracking-tight mb-4">Tabela Comparativa por Volume</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Volume/dia</th>
                {[1, 10, 50, 100, 500, 1000].map((v) => (
                  <th key={v} className="text-right py-3 px-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {v.toLocaleString("pt-BR")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const textMap: Record<string, string> = {
                  emerald: "text-emerald-400",
                  violet: "text-violet-400",
                  sky: "text-sky-400",
                };
                return (
                  <tr key={p.id} className="border-b border-white/[0.04]">
                    <td className={cn("py-3 px-2 font-medium", textMap[p.color])}>{p.name}</td>
                    {[1, 10, 50, 100, 500, 1000].map((v) => {
                      const monthly = v * 30;
                      const fixed = p.fixedCosts.reduce((s, c) => s + getScaledCost(c, v), 0);
                      const variable = monthly * p.variableCostPerUnit;
                      const total = fixed + variable;
                      return (
                        <td key={v} className="py-3 px-2 text-right text-zinc-300 font-mono text-xs">
                          {formatBRL(total)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="border-t border-white/[0.08]">
                <td className="py-3 px-2 font-bold text-white">TOTAL</td>
                {[1, 10, 50, 100, 500, 1000].map((v) => {
                  const total = products.reduce((sum, p) => {
                    const monthly = v * 30;
                    const fixed = p.fixedCosts.reduce((s, c) => s + getScaledCost(c, v), 0);
                    const variable = monthly * p.variableCostPerUnit;
                    return sum + fixed + variable;
                  }, 0);
                  return (
                    <td key={v} className="py-3 px-2 text-right text-white font-bold font-mono text-xs">
                      {formatBRL(total)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cost per unit comparison */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white tracking-tight mb-4">Custo por Unidade (atual)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {products.map((p) => {
              const data = totals.perProduct[p.id];
              const daily = dailyVolumes[p.id];
              const bgMap: Record<string, string> = {
                emerald: "from-emerald-500/10 to-emerald-500/5",
                violet: "from-violet-500/10 to-violet-500/5",
                sky: "from-sky-500/10 to-sky-500/5",
              };
              const textMap: Record<string, string> = {
                emerald: "text-emerald-400",
                violet: "text-violet-400",
                sky: "text-sky-400",
              };
              return (
                <div
                  key={p.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br border border-white/[0.06]",
                    bgMap[p.color]
                  )}
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">{p.name}</p>
                  <p className={cn("text-3xl font-bold tracking-tight", textMap[p.color])}>
                    {formatBRLFull(data.costPerUnit)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">por {p.unitLabel}</p>
                  <div className="h-px bg-white/[0.06] my-3" />
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">{daily.toLocaleString("pt-BR")}/dia</span>
                    <span className="text-zinc-400">{data.monthly.toLocaleString("pt-BR")}/mês</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center py-8">
          <p className="text-xs text-zinc-600">
            Valores estimados baseados em preços de março/2026. Custos de infra (Digital Ocean) escalam com volume.
            Custos de tokens são variáveis conforme uso real.
          </p>
        </div>
      </div>
    </div>
  );
}
