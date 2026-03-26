"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Users,
  ArrowLeft,
  Crown,
  Clock,
  Wifi,
  BarChart3,
  Minus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface CandidateInfo {
  id: string;
  name: string;
  party: string;
  photo_url?: string | null;
  polling_percent: number;
  sentiment_trend: number;
}

interface HistoryPoint {
  candidate_id: string;
  polling_percent: number;
  created_at: string;
}

interface SentimentData {
  candidates: CandidateInfo[];
  distribution: unknown[];
  lastCycle: { started_at: string; status: string; news_applied: number } | null;
  totalPersonas: number;
}

const PARTY_COLORS: Record<string, { badge: string; line: string }> = {
  PT: { badge: "bg-red-500/15 text-red-400 border-red-500/25", line: "#f87171" },
  PL: { badge: "bg-blue-500/15 text-blue-400 border-blue-500/25", line: "#60a5fa" },
  PSD: { badge: "bg-orange-500/15 text-orange-400 border-orange-500/25", line: "#fb923c" },
  Republicanos: { badge: "bg-sky-500/15 text-sky-400 border-sky-500/25", line: "#38bdf8" },
  Novo: { badge: "bg-violet-500/15 text-violet-400 border-violet-500/25", line: "#a78bfa" },
};

// ── Trend Chart ──────────────────────────────────────────────────────────────

function TrendChart({ candidates, history }: {
  candidates: CandidateInfo[];
  history: HistoryPoint[];
}) {
  // Agrupar por candidato — só Flávio e Lula no chart principal
  const mainIds = ["flavio", "lula"];
  const chartCandidates = candidates.filter((c) => mainIds.includes(c.id));

  // Pegar datas únicas
  const dates = [...new Set(history.map((h) => h.created_at.split("T")[0]))].sort();

  if (dates.length < 2) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-600 text-sm">
        <Clock size={14} className="mr-2" />
        Gráfico disponível após primeiras atualizações
      </div>
    );
  }

  // Montar series
  const series = chartCandidates.map((c) => {
    const points = dates.map((date) => {
      const match = history.find(
        (h) => h.candidate_id === c.id && h.created_at.startsWith(date)
      );
      return match?.polling_percent ?? c.polling_percent;
    });
    return { id: c.id, name: c.name, party: c.party, points };
  });

  const allValues = series.flatMap((s) => s.points);
  const min = Math.min(...allValues) - 1;
  const max = Math.max(...allValues) + 1;
  const range = max - min || 1;

  const width = 600;
  const height = 200;
  const padL = 40;
  const padR = 20;
  const padT = 10;
  const padB = 30;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = padT + (1 - pct) * chartH;
        const val = min + pct * range;
        return (
          <g key={pct}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#27272a" strokeWidth="0.5" />
            <text x={padL - 5} y={y + 4} textAnchor="end" fill="#52525b" fontSize="10">
              {val.toFixed(0)}%
            </text>
          </g>
        );
      })}

      {/* Date labels */}
      {dates.map((date, i) => {
        const x = padL + (i / (dates.length - 1)) * chartW;
        const label = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        return (
          <text key={date} x={x} y={height - 5} textAnchor="middle" fill="#52525b" fontSize="9">
            {label}
          </text>
        );
      })}

      {/* Lines */}
      {series.map((s) => {
        const color = PARTY_COLORS[s.party]?.line || "#71717a";
        const pts = s.points.map((v, i) => {
          const x = padL + (i / (dates.length - 1)) * chartW;
          const y = padT + ((max - v) / range) * chartH;
          return `${x},${y}`;
        }).join(" ");

        const lastX = padL + chartW;
        const lastY = padT + ((max - s.points[s.points.length - 1]) / range) * chartH;

        return (
          <g key={s.id}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastX} cy={lastY} r="4" fill={color} />
            <circle cx={lastX} cy={lastY} r="7" fill={color} opacity="0.2" />
            <text x={lastX + 8} y={lastY + 4} fill={color} fontSize="11" fontWeight="600">
              {s.points[s.points.length - 1].toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Candidate Row ────────────────────────────────────────────────────────────

function CandidateRow({ candidate, rank, isLeader }: {
  candidate: CandidateInfo;
  rank: number;
  isLeader: boolean;
}) {
  const partyColor = PARTY_COLORS[candidate.party] || PARTY_COLORS.PSD;
  const trend = candidate.sentiment_trend;

  return (
    <div className={cn(
      "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300",
      isLeader
        ? "bg-emerald-500/[0.06] border border-emerald-500/20"
        : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]"
    )}>
      {/* Posição */}
      <span className={cn(
        "text-sm font-bold w-5 text-center tabular-nums",
        isLeader ? "text-emerald-400" : "text-zinc-600"
      )}>
        {rank}
      </span>

      {/* Foto */}
      <div className={cn(
        "relative w-10 h-10 rounded-full overflow-hidden shrink-0 border-2",
        isLeader ? "border-emerald-500/40" : "border-white/[0.08]"
      )}>
        {candidate.photo_url ? (
          <Image src={candidate.photo_url} alt={candidate.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600">
            <Users size={18} />
          </div>
        )}
        {isLeader && (
          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center">
            <Crown size={7} className="text-black" />
          </div>
        )}
      </div>

      {/* Nome + Partido */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-white truncate">{candidate.name}</h3>
        <span className={cn(
          "inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border",
          partyColor.badge
        )}>
          {candidate.party}
        </span>
      </div>

      {/* Porcentagem */}
      <div className="text-right">
        <div className={cn(
          "text-xl font-bold tracking-tight tabular-nums",
          isLeader ? "text-emerald-400" : "text-white"
        )}>
          {candidate.polling_percent.toFixed(1)}%
        </div>
        <div className="text-[10px] text-zinc-500">intenção de voto</div>
      </div>

      {/* Trend */}
      <div className={cn(
        "flex items-center gap-0.5 w-14 justify-end",
        trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-zinc-600"
      )}>
        {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
        <span className="text-xs font-semibold tabular-nums">
          {trend > 0 ? "+" : ""}{trend.toFixed(1)}
        </span>
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
      setHistory(Array.isArray(histData) ? histData : []);
      setLastUpdate(new Date());
    } catch (e) {
      console.error("Failed to fetch:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 md:p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-10 bg-zinc-900/50 rounded-2xl animate-pulse w-60" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900/50 rounded-2xl animate-pulse" />
          ))}
          <div className="h-48 bg-zinc-900/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data?.candidates?.length) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <BarChart3 size={32} className="text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-500 text-sm">Nenhum dado encontrado.</p>
      </div>
    );
  }

  // Ordenar por polling (Flávio primeiro, depois Lula, depois os outros)
  const sorted = [...data.candidates].sort((a, b) => b.polling_percent - a.polling_percent);
  const leader = sorted[0];

  // Brancos/nulos: 100% - soma de todos
  const totalPercent = sorted.reduce((s, c) => s + c.polling_percent, 0);
  const brancosNulos = Math.max(0, 100 - totalPercent);

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <main className="relative max-w-3xl mx-auto p-6 md:p-8 lg:p-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/candidatos" className="p-2 rounded-xl hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-colors duration-200">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  Pesquisa Viva
                </h1>
                {autoRefresh && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>
              <p className="text-zinc-600 text-xs flex items-center gap-1">
                <Wifi size={10} />
                {data.totalPersonas.toLocaleString()} personas · 2º turno
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-[10px] text-zinc-600">{lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-200",
                autoRefresh ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/[0.03] text-zinc-500 border border-white/[0.06]"
              )}
            >
              {autoRefresh ? "Live" : "Off"}
            </button>
            <button onClick={fetchData} className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 border border-white/[0.06] transition-all duration-200">
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Ranking de candidatos */}
        <div className="space-y-2">
          {sorted.map((candidate, i) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              rank={i + 1}
              isLeader={candidate.id === leader.id}
            />
          ))}

          {/* Brancos/Nulos */}
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.01] border border-white/[0.03]">
            <span className="text-sm font-bold w-5 text-center text-zinc-700">—</span>
            <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-white/[0.04] flex items-center justify-center shrink-0">
              <Minus size={16} className="text-zinc-700" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm text-zinc-500">Brancos / Nulos / Indecisos</h3>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-zinc-600 tabular-nums">{brancosNulos.toFixed(1)}%</div>
            </div>
            <div className="w-14" />
          </div>
        </div>

        {/* Gráfico de tendência */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-emerald-400" />
            Evolução — Flávio vs Lula
          </h2>
          <TrendChart candidates={data.candidates} history={history} />
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-zinc-700 pb-4 space-y-0.5">
          <p>Referência: Atlas/Bloomberg · Atualizado 3x/dia via notícias</p>
          {data.lastCycle && (
            <p>Último ciclo: {new Date(data.lastCycle.started_at).toLocaleString("pt-BR")}</p>
          )}
        </div>
      </main>
    </div>
  );
}
