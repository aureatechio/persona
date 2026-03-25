"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Plus,
  Sparkles,
  CheckCircle,
  Loader2,
} from "lucide-react";
import CycleSummary from "@/components/candidatos/CycleSummary";
import DriftDashboard from "@/components/candidatos/DriftDashboard";

/* ─── Types ─── */

interface CycleData {
  id: string;
  ran_at: string;
  status: string;
  news_processed: number;
  news_applied: number;
  news_skipped: number;
  polling_error: number;
  news?: NewsItem[];
  drift?: DriftRow[];
  anchors?: AnchorRow[];
}

interface NewsItem {
  id: string;
  headline: string;
  impact: string;
  context?: string;
  candidate_name?: string;
  applied: boolean;
}

interface DriftRow {
  cluster: string;
  driftLula: number;
  driftFlavio: number;
  budgetRemaining: number;
}

interface AnchorRow {
  id: string;
  candidate_name: string;
  source: string;
  percent: number;
  date: string;
}

/* ─── Helpers ─── */

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function getImpactColor(impact: string) {
  switch (impact) {
    case "high":
      return "text-red-400 bg-red-500/10 border-red-500/20";
    case "medium":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    default:
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  }
}

const impactLabel: Record<string, string> = {
  high: "Alto",
  medium: "Medio",
  low: "Baixo",
};

/* ─── Component ─── */

export default function MonitorPage() {
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNews, setExpandedNews] = useState<Set<string>>(new Set());
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/living/cycles?limit=20");
      if (res.ok) {
        const data = await res.json();
        setCycles(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const latestCycle = cycles[0] ?? null;

  const toggleNews = (id: string) => {
    setExpandedNews((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRollback = async (cycleId: string) => {
    if (!confirm("Reverter este ciclo? As alterações serão desfeitas.")) return;
    setRollingBack(cycleId);
    try {
      await fetch(`/api/living/cycles/${cycleId}/rollback`, { method: "POST" });
      await fetchData();
    } catch {
      // silent
    } finally {
      setRollingBack(null);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Decorative orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <main className="relative max-w-7xl mx-auto p-6 md:p-8 lg:p-10 space-y-8 md:space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
              <Activity size={28} className="text-emerald-400" />
              Monitor de Personas Vivas
            </h1>
            <div className="flex items-center gap-4 mt-2">
              {latestCycle && (
                <>
                  <p className="text-zinc-500 flex items-center gap-2 text-sm">
                    <Clock size={14} />
                    Ultimo ciclo: {formatDate(latestCycle.ran_at)}
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                      latestCycle.status === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    )}
                  >
                    {latestCycle.status === "success" ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Activity size={12} />
                    )}
                    {latestCycle.status}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5",
              "bg-white/[0.05] hover:bg-white/[0.1]",
              "text-zinc-300 hover:text-white",
              "border border-white/[0.08] hover:border-white/[0.15]",
              "rounded-xl font-medium text-sm",
              "active:scale-[0.97]",
              "transition-all duration-200",
              "disabled:opacity-50"
            )}
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Atualizar
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

        {/* Loading state */}
        {loading && cycles.length === 0 && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-zinc-900/50 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Stats */}
        {latestCycle && (
          <CycleSummary
            newsProcessed={latestCycle.news_processed}
            newsApplied={latestCycle.news_applied}
            newsSkipped={latestCycle.news_skipped}
            pollingError={latestCycle.polling_error}
          />
        )}

        {/* News Timeline */}
        {latestCycle?.news && latestCycle.news.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white tracking-tight">
              Timeline de Notícias
            </h2>
            <div className="space-y-2">
              {latestCycle.news.map((news) => {
                const isExpanded = expandedNews.has(news.id);
                return (
                  <div
                    key={news.id}
                    className={cn(
                      "bg-white/[0.03] border border-white/[0.06]",
                      "rounded-xl overflow-hidden",
                      "transition-all duration-300",
                      "hover:bg-white/[0.05] hover:border-white/[0.1]"
                    )}
                  >
                    <button
                      onClick={() => toggleNews(news.id)}
                      className="w-full flex items-center gap-3 p-4 text-left"
                    >
                      <div className="shrink-0 text-zinc-500 transition-transform duration-200">
                        {isExpanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {news.headline}
                        </p>
                        {news.candidate_name && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {news.candidate_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {news.applied ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle size={10} /> Aplicada
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            Ignorada
                          </span>
                        )}
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                            getImpactColor(news.impact)
                          )}
                        >
                          {impactLabel[news.impact] ?? news.impact}
                        </span>
                      </div>
                    </button>
                    {isExpanded && news.context && (
                      <div className="px-4 pb-4 pl-11">
                        <p className="text-sm text-zinc-400 leading-relaxed">
                          {news.context}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Drift Dashboard */}
        {latestCycle?.drift && latestCycle.drift.length > 0 && (
          <DriftDashboard rows={latestCycle.drift} />
        )}

        {/* Polling Anchors */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white tracking-tight">
              Ancoragens de Pesquisa
            </h2>
            <button
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2",
                "bg-emerald-500 hover:bg-emerald-400",
                "text-black font-semibold text-sm",
                "rounded-xl",
                "shadow-lg shadow-emerald-500/25",
                "hover:shadow-emerald-400/30",
                "active:scale-[0.97]",
                "transition-all duration-200"
              )}
            >
              <Plus size={16} />
              Adicionar manualmente
            </button>
          </div>

          {latestCycle?.anchors && latestCycle.anchors.length > 0 ? (
            <div
              className={cn(
                "bg-white/[0.03] border border-white/[0.06]",
                "rounded-2xl overflow-hidden"
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-xs font-medium uppercase tracking-wider text-zinc-500 px-6 py-3">
                        Candidato
                      </th>
                      <th className="text-left text-xs font-medium uppercase tracking-wider text-zinc-500 px-6 py-3">
                        Fonte
                      </th>
                      <th className="text-center text-xs font-medium uppercase tracking-wider text-zinc-500 px-6 py-3">
                        Percentual
                      </th>
                      <th className="text-right text-xs font-medium uppercase tracking-wider text-zinc-500 px-6 py-3">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {latestCycle.anchors.map((anchor) => (
                      <tr
                        key={anchor.id}
                        className="hover:bg-white/[0.03] transition-colors duration-200"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-white">
                          {anchor.candidate_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-400">
                          {anchor.source}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-bold text-white">
                            {anchor.percent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-zinc-500">
                          {formatDate(anchor.date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                <Sparkles size={32} className="text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-sm">
                Nenhuma ancoragem cadastrada
              </p>
            </div>
          )}
        </section>

        {/* Cycle History */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white tracking-tight">
            Historico de Ciclos
          </h2>

          {cycles.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                <Clock size={32} className="text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-sm">
                Nenhum ciclo registrado
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className={cn(
                    "bg-white/[0.03] border border-white/[0.06]",
                    "rounded-xl p-4",
                    "flex items-center justify-between gap-4",
                    "hover:bg-white/[0.05] hover:border-white/[0.1]",
                    "transition-all duration-300"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        cycle.status === "success"
                          ? "bg-emerald-500"
                          : cycle.status === "error"
                          ? "bg-red-500"
                          : "bg-amber-500"
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {formatDate(cycle.ran_at)}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {cycle.news_processed} processadas, {cycle.news_applied}{" "}
                        aplicadas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                        cycle.status === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : cycle.status === "error"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}
                    >
                      {cycle.status}
                    </span>

                    <button
                      onClick={() => handleRollback(cycle.id)}
                      disabled={rollingBack === cycle.id}
                      className={cn(
                        "p-2 rounded-xl",
                        "hover:bg-red-500/10 text-zinc-500 hover:text-red-400",
                        "transition-colors duration-200",
                        "disabled:opacity-50"
                      )}
                      title="Reverter ciclo"
                    >
                      {rollingBack === cycle.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RotateCcw size={16} />
                      )}
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
