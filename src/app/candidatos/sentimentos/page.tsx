"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Users,
  ArrowLeft,
  Target,
  Swords,
  ChevronDown,
  Crown,
  Activity,
  Clock,
  Wifi,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface CandidateInfo {
  id: string;
  name: string;
  party: string;
  leaning: string;
  photo_url?: string | null;
  polling_percent: number;
  sentiment_trend: number;
}

interface DistributionRow {
  cluster_macro: string;
  candidate_id: string;
  avg_sentiment: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  total_count: number;
  pct_positive: number;
}

interface HistoryPoint {
  candidate_id: string;
  polling_percent: number;
  created_at: string;
}

interface SentimentData {
  candidates: CandidateInfo[];
  distribution: DistributionRow[];
  lastCycle: { started_at: string; status: string; news_applied: number } | null;
  totalPersonas: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PARTY_COLORS: Record<string, { bg: string; text: string; border: string; line: string }> = {
  PT: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/25", line: "#f87171" },
  PL: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/25", line: "#60a5fa" },
  PSD: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/25", line: "#fb923c" },
  Republicanos: { bg: "bg-sky-500/15", text: "text-sky-400", border: "border-sky-500/25", line: "#38bdf8" },
  Novo: { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/25", line: "#a78bfa" },
};

const CLUSTER_COLORS: Record<string, string> = {
  P: "text-red-400", M: "text-sky-400", C: "text-blue-400", T: "text-zinc-400",
};

// ── Sparkline Component ──────────────────────────────────────────────────────

function Sparkline({ data, color, width = 120, height = 32 }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data) - 0.5;
  const max = Math.max(...data) + 0.5;
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {/* Último ponto com glow */}
      {data.length > 0 && (() => {
        const lastX = width;
        const lastY = height - ((data[data.length - 1] - min) / range) * height;
        return (
          <>
            <circle cx={lastX} cy={lastY} r="3" fill={color} opacity="0.9" />
            <circle cx={lastX} cy={lastY} r="6" fill={color} opacity="0.2" />
          </>
        );
      })()}
    </svg>
  );
}

// ── Candidate Row (2o Turno) ─────────────────────────────────────────────────

function CandidateRow({
  candidate,
  distribution,
  history,
  isLeader,
  opponentPercent,
}: {
  candidate: CandidateInfo;
  distribution: DistributionRow[];
  history: number[];
  isLeader: boolean;
  opponentPercent?: number;
}) {
  const partyColor = PARTY_COLORS[candidate.party] || PARTY_COLORS.PSD;

  const totals = distribution.reduce(
    (acc, d) => ({ pos: acc.pos + d.positive_count, total: acc.total + d.total_count }),
    { pos: 0, total: 0 }
  );
  const pctFavorable = totals.total > 0 ? (totals.pos / totals.total) * 100 : 0;

  const diff = history.length >= 2 ? history[history.length - 1] - history[0] : 0;

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
      isLeader
        ? "bg-emerald-500/[0.06] border border-emerald-500/20"
        : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]"
    )}>
      {/* Foto */}
      <div className={cn(
        "relative w-14 h-14 rounded-full overflow-hidden shrink-0 border-2",
        isLeader ? "border-emerald-500/40" : "border-white/[0.08]"
      )}>
        {candidate.photo_url ? (
          <Image src={candidate.photo_url} alt={candidate.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600">
            <Users size={22} />
          </div>
        )}
        {isLeader && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
            <Crown size={8} className="text-black" />
          </div>
        )}
      </div>

      {/* Nome + Partido */}
      <div className="min-w-0 w-36">
        <h3 className="text-sm font-semibold text-white truncate">{candidate.name}</h3>
        <span className={cn(
          "inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border mt-0.5",
          partyColor.bg, partyColor.text, partyColor.border
        )}>
          {candidate.party}
        </span>
      </div>

      {/* Porcentagem principal */}
      <div className="text-center w-24">
        <div className={cn(
          "text-2xl font-bold tracking-tight tabular-nums",
          isLeader ? "text-emerald-400" : "text-white"
        )}>
          {candidate.polling_percent.toFixed(1)}%
        </div>
        <div className={cn(
          "text-[10px] flex items-center gap-0.5 justify-center",
          diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-zinc-500"
        )}>
          {diff > 0 ? <TrendingUp size={9} /> : diff < 0 ? <TrendingDown size={9} /> : null}
          {diff !== 0 && `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`}
          {diff === 0 && "—"}
        </div>
      </div>

      {/* Sparkline */}
      <div className="hidden md:block">
        <Sparkline data={history} color={partyColor.line} width={100} height={28} />
      </div>

      {/* Sentimento favorável */}
      <div className="hidden lg:block w-20 text-center">
        <div className="text-sm font-semibold text-zinc-300 tabular-nums">{pctFavorable.toFixed(0)}%</div>
        <div className="text-[9px] text-zinc-600">favorável</div>
      </div>

      {/* Mini clusters */}
      <div className="hidden xl:flex gap-1.5">
        {["P", "M", "C", "T"].map((macro) => {
          const row = distribution.find((d) => d.cluster_macro === macro);
          if (!row) return null;
          const pct = row.total_count > 0 ? (row.positive_count / row.total_count) * 100 : 0;
          return (
            <div key={macro} className="text-center w-8">
              <div className={cn("text-[9px] font-bold", CLUSTER_COLORS[macro])}>{macro}</div>
              <div className={cn(
                "text-[10px] font-semibold tabular-nums",
                pct >= 55 ? "text-emerald-400/80" : pct >= 40 ? "text-zinc-400" : "text-red-400/80"
              )}>
                {pct.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SentimentosPage() {
  const [data, setData] = useState<SentimentData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sentRes, histRes] = await Promise.all([
        fetch("/api/living/sentiments"),
        fetch("/api/living/history"),
      ]);
      const [sentData, histData] = await Promise.all([sentRes.json(), histRes.json()]);
      setData(sentData);
      setHistory(histData);
      setLastUpdate(new Date());
    } catch (e) {
      console.error("Failed to fetch:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh a cada 5 minutos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="h-10 bg-zinc-900/50 rounded-2xl animate-pulse w-80" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-900/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.candidates?.length) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <BarChart3 size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Nenhum dado encontrado.</p>
        </div>
      </div>
    );
  }

  // Principais: Flávio e Lula (2o turno)
  const flavio = data.candidates.find((c) => c.id === "flavio");
  const lula = data.candidates.find((c) => c.id === "lula");
  const others = data.candidates
    .filter((c) => c.id !== "flavio" && c.id !== "lula")
    .sort((a, b) => b.polling_percent - a.polling_percent);

  // Histórico por candidato
  const getHistory = (candidateId: string) =>
    history
      .filter((h) => h.candidate_id === candidateId)
      .map((h) => h.polling_percent);

  const getDistribution = (candidateId: string) =>
    (data.distribution || []).filter((d) => d.candidate_id === candidateId);

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <main className="relative max-w-5xl mx-auto p-6 md:p-8 lg:p-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/candidatos" className="p-2 rounded-xl hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-colors duration-200">
                <ArrowLeft size={20} />
              </Link>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Pesquisa Viva
                </h1>
                {autoRefresh && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                )}
              </div>
            </div>
            <p className="text-zinc-500 ml-11 text-sm flex items-center gap-2">
              <Wifi size={12} />
              20K personas analisando o cenário eleitoral em tempo real
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                <Clock size={10} />
                {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all duration-200",
                autoRefresh
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-white/[0.03] text-zinc-500 border border-white/[0.06]"
              )}
            >
              {autoRefresh ? "Live" : "Pausado"}
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white border border-white/[0.06] transition-all duration-200 active:scale-[0.97]"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* 2º Turno Principal */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Swords size={16} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              2º Turno — Flávio Bolsonaro vs Lula
            </h2>
            <span className="ml-auto text-[10px] text-zinc-600">Atlas/Bloomberg mar/2026</span>
          </div>

          <div className="space-y-3">
            {flavio && (
              <CandidateRow
                candidate={flavio}
                distribution={getDistribution("flavio")}
                history={getHistory("flavio")}
                isLeader={flavio.polling_percent > (lula?.polling_percent || 0)}
                opponentPercent={lula?.polling_percent}
              />
            )}
            {lula && (
              <CandidateRow
                candidate={lula}
                distribution={getDistribution("lula")}
                history={getHistory("lula")}
                isLeader={lula.polling_percent > (flavio?.polling_percent || 0)}
                opponentPercent={flavio?.polling_percent}
              />
            )}
          </div>

          {/* Diferença */}
          {flavio && lula && (
            <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-center gap-3">
              <span className="text-xs text-zinc-500">Diferença:</span>
              <span className={cn(
                "text-sm font-bold tabular-nums px-3 py-1 rounded-full",
                flavio.polling_percent > lula.polling_percent
                  ? "text-blue-400 bg-blue-500/10"
                  : "text-red-400 bg-red-500/10"
              )}>
                {flavio.polling_percent > lula.polling_percent ? "Flávio" : "Lula"} +
                {Math.abs(flavio.polling_percent - lula.polling_percent).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Outros candidatos (2o turno vs Lula) */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-sky-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Outros cenários — 2º Turno vs Lula
            </h2>
          </div>

          <div className="space-y-2">
            {others.map((candidate) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                distribution={getDistribution(candidate.id)}
                history={getHistory(candidate.id)}
                isLeader={candidate.polling_percent > (lula?.polling_percent || 0)}
              />
            ))}
          </div>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-zinc-600">
          <span>P = Progressista</span>
          <span>M = Moderado</span>
          <span>C = Conservador</span>
          <span>T = Transversal</span>
          <span className="h-2 w-px bg-zinc-800" />
          <span>Sparkline = tendência histórica</span>
          <span className="h-2 w-px bg-zinc-800" />
          <span>Atualizado 3x/dia via notícias</span>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-600 pb-4 space-y-0.5">
          <p>Referência: Atlas/Bloomberg · 5.028 entrevistas · 18–23/mar/2026</p>
          {data.lastCycle && (
            <p>
              Último ciclo: {new Date(data.lastCycle.started_at).toLocaleString("pt-BR")} · {data.lastCycle.news_applied} notícias
            </p>
          )}
          <p>{data.totalPersonas.toLocaleString()} personas · Sentimentos derivados por IA</p>
        </div>
      </main>
    </div>
  );
}
