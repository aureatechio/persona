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
  Swords,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Matchup {
  candidateId: string;
  candidateName: string;
  candidateParty: string;
  candidatePhoto: string | null;
  votesCandidate: number;
  votesLula: number;
  abstentions: number;
  totalPersonas: number;
  pctCandidate: number;
  pctLula: number;
  pctAbstention: number;
}

interface LulaInfo {
  id: string;
  name: string;
  party: string;
  photo_url: string | null;
}

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

interface MatchupData {
  matchups: Matchup[];
  lula: LulaInfo;
  candidates: CandidateInfo[];
  totalPersonas: number;
}

// ── Colors ───────────────────────────────────────────────────────────────────

const CANDIDATE_COLORS: Record<string, string> = {
  flavio: "#60a5fa",
  lula: "#f87171",
  tarcisio: "#38bdf8",
  michelle: "#818cf8",
  zema: "#a78bfa",
  caiado: "#fb923c",
  ratinho: "#fbbf24",
  haddad: "#fb7185",
  eduardo_leite: "#34d399",
};

const PARTY_BADGE: Record<string, string> = {
  PT: "bg-red-500/15 text-red-400 border-red-500/25",
  PL: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  PSD: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Republicanos: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  Novo: "bg-violet-500/15 text-violet-400 border-violet-500/25",
};

// ── Photo component (img tag for reliability) ────────────────────────────────

function CandidatePhoto({ src, alt, size = 96, className }: { src?: string | null; alt: string; size?: number; className?: string }) {
  if (!src) {
    return (
      <div className={cn("rounded-full bg-zinc-800 flex items-center justify-center", className)} style={{ width: size, height: size }}>
        <Users size={size * 0.4} className="text-zinc-600" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("rounded-full object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}

// ── Hero Matchup (Flávio vs Lula) ────────────────────────────────────────────

function HeroMatchup({ matchup, lula }: { matchup: Matchup; lula: LulaInfo }) {
  const candidateWins = matchup.pctCandidate > matchup.pctLula;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <Swords size={16} className="text-emerald-400" />
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">2º Turno</h2>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Candidato */}
        <div className={cn(
          "flex flex-col items-center text-center p-4 rounded-2xl",
          candidateWins ? "bg-emerald-500/[0.06] border border-emerald-500/20" : "bg-white/[0.01]"
        )}>
          <div className="relative">
            <CandidatePhoto
              src={matchup.candidatePhoto}
              alt={matchup.candidateName}
              size={100}
              className={cn("border-3", candidateWins ? "border-emerald-500/50" : "border-white/[0.1]")}
            />
            {candidateWins && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Crown size={12} className="text-black" />
              </div>
            )}
          </div>
          <h3 className="text-lg font-bold text-white mt-3">{matchup.candidateName}</h3>
          <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border mt-1", PARTY_BADGE[matchup.candidateParty] || PARTY_BADGE.PSD)}>
            {matchup.candidateParty}
          </span>
          <div className={cn("text-4xl md:text-5xl font-bold tracking-tight mt-3 tabular-nums", candidateWins ? "text-emerald-400" : "text-white")}>
            {matchup.pctCandidate.toFixed(1)}%
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">{matchup.votesCandidate.toLocaleString()} votos</span>
        </div>

        {/* Lula */}
        <div className={cn(
          "flex flex-col items-center text-center p-4 rounded-2xl",
          !candidateWins ? "bg-emerald-500/[0.06] border border-emerald-500/20" : "bg-white/[0.01]"
        )}>
          <div className="relative">
            <CandidatePhoto
              src={lula.photo_url}
              alt={lula.name}
              size={100}
              className={cn("border-3", !candidateWins ? "border-emerald-500/50" : "border-white/[0.1]")}
            />
            {!candidateWins && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Crown size={12} className="text-black" />
              </div>
            )}
          </div>
          <h3 className="text-lg font-bold text-white mt-3">{lula.name}</h3>
          <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border mt-1", PARTY_BADGE.PT)}>
            {lula.party}
          </span>
          <div className={cn("text-4xl md:text-5xl font-bold tracking-tight mt-3 tabular-nums", !candidateWins ? "text-emerald-400" : "text-white")}>
            {matchup.pctLula.toFixed(1)}%
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">{matchup.votesLula.toLocaleString()} votos</span>
        </div>
      </div>

      {/* Brancos/Nulos */}
      <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-white/[0.04] text-xs text-zinc-500">
        <Minus size={10} />
        Brancos / Nulos / Indecisos:
        <span className="font-semibold text-zinc-400">{matchup.pctAbstention.toFixed(1)}%</span>
        <span className="text-zinc-700">({matchup.abstentions.toLocaleString()} personas)</span>
      </div>
    </div>
  );
}

// ── Other Matchup Row ────────────────────────────────────────────────────────

function OtherMatchup({ matchup, lula }: { matchup: Matchup; lula: LulaInfo }) {
  const candidateWins = matchup.pctCandidate > matchup.pctLula;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all duration-200">
      {/* Foto candidato */}
      <CandidatePhoto src={matchup.candidatePhoto} alt={matchup.candidateName} size={40} className="border-2 border-white/[0.08] shrink-0" />

      {/* Nome */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-white truncate">{matchup.candidateName}</h4>
        <span className={cn("inline-flex px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase border", PARTY_BADGE[matchup.candidateParty] || PARTY_BADGE.PSD)}>
          {matchup.candidateParty}
        </span>
      </div>

      {/* Resultado */}
      <div className="flex items-center gap-3 text-right">
        <div>
          <div className={cn("text-lg font-bold tabular-nums", candidateWins ? "text-emerald-400" : "text-white")}>
            {matchup.pctCandidate.toFixed(1)}%
          </div>
          <div className="text-[9px] text-zinc-600">{matchup.candidateName.split(" ")[0]}</div>
        </div>
        <span className="text-zinc-700 text-xs">×</span>
        <div>
          <div className={cn("text-lg font-bold tabular-nums", !candidateWins ? "text-emerald-400" : "text-white")}>
            {matchup.pctLula.toFixed(1)}%
          </div>
          <div className="text-[9px] text-zinc-600">Lula</div>
        </div>
        <div className="w-12 text-right">
          <div className="text-[10px] text-zinc-600">{matchup.pctAbstention.toFixed(1)}%</div>
          <div className="text-[8px] text-zinc-700">b/n</div>
        </div>
      </div>
    </div>
  );
}

// ── Trend Chart ──────────────────────────────────────────────────────────────

function TrendChart({ candidates, history }: { candidates: CandidateInfo[]; history: HistoryPoint[] }) {
  const dates = [...new Set(history.map((h) => h.created_at.split("T")[0]))].sort();

  if (dates.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
        <Clock size={20} className="mb-2" />
        <p className="text-sm">Gráfico disponível após as primeiras atualizações</p>
        <p className="text-xs text-zinc-700 mt-1">Próximo ciclo: 07:00 BRT</p>
      </div>
    );
  }

  const activeCandidates = candidates.filter((c) => history.some((h) => h.candidate_id === c.id));

  const series = activeCandidates.map((c) => ({
    ...c,
    points: dates.map((date) => {
      const match = history.find((h) => h.candidate_id === c.id && h.created_at.startsWith(date));
      return match?.polling_percent ?? c.polling_percent;
    }),
  }));

  const allValues = series.flatMap((s) => s.points);
  const min = Math.min(...allValues) - 2;
  const max = Math.max(...allValues) + 2;
  const range = max - min || 1;

  const width = 700, height = 250;
  const padL = 40, padR = 70, padT = 15, padB = 35;
  const chartW = width - padL - padR, chartH = height - padT - padB;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padT + (1 - pct) * chartH;
          const val = min + pct * range;
          return (
            <g key={pct}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#27272a" strokeWidth="0.5" />
              <text x={padL - 5} y={y + 4} textAnchor="end" fill="#52525b" fontSize="10">{val.toFixed(0)}%</text>
            </g>
          );
        })}
        {dates.map((date, i) => {
          const x = padL + (i / Math.max(dates.length - 1, 1)) * chartW;
          const label = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
          return <text key={date} x={x} y={height - 5} textAnchor="middle" fill="#52525b" fontSize="9">{label}</text>;
        })}
        {series.map((s) => {
          const color = CANDIDATE_COLORS[s.id] || "#71717a";
          const pts = s.points.map((v, i) => `${padL + (i / Math.max(dates.length - 1, 1)) * chartW},${padT + ((max - v) / range) * chartH}`).join(" ");
          const lastX = padL + chartW;
          const lastY = padT + ((max - s.points[s.points.length - 1]) / range) * chartH;
          return (
            <g key={s.id}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
              <circle cx={lastX} cy={lastY} r="5" fill={color} />
              <circle cx={lastX} cy={lastY} r="8" fill={color} opacity="0.15" />
              <text x={lastX + 12} y={lastY - 5} fill={color} fontSize="9" fontWeight="600">{s.name.split(" ")[0]}</text>
              <text x={lastX + 12} y={lastY + 7} fill={color} fontSize="10" fontWeight="700">{s.points[s.points.length - 1].toFixed(1)}%</text>
            </g>
          );
        })}
      </svg>

      {/* Legenda com fotos */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
        {candidates.slice(0, 6).map((c) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <CandidatePhoto src={c.photo_url} alt={c.name} size={24} className="border border-white/[0.1]" />
            <span className="text-[10px] text-zinc-500">{c.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SentimentosPage() {
  const [matchupData, setMatchupData] = useState<MatchupData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [matchRes, histRes] = await Promise.all([
        fetch("/api/living/matchups"),
        fetch("/api/living/history"),
      ]);
      const [mData, hData] = await Promise.all([matchRes.json(), histRes.json()]);
      setMatchupData(mData);
      setHistory(Array.isArray(hData) ? hData : []);
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
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="h-8 bg-zinc-900/50 rounded-xl animate-pulse w-48" />
          <div className="h-72 bg-zinc-900/50 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-zinc-900/50 rounded-xl animate-pulse" />)}
          </div>
          <div className="h-48 bg-zinc-900/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!matchupData?.matchups?.length) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <BarChart3 size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Nenhum dado encontrado.</p>
        </div>
      </div>
    );
  }

  const { matchups, lula, candidates } = matchupData;
  const heroMatchup = matchups.find((m) => m.candidateId === "flavio");
  const otherMatchups = matchups.filter((m) => m.candidateId !== "flavio");

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <main className="relative max-w-5xl mx-auto p-6 md:p-8 lg:p-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/candidatos" className="p-2 rounded-xl hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-colors duration-200">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">Pesquisa Viva</h1>
                {autoRefresh && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>
              <p className="text-zinc-600 text-[10px] flex items-center gap-1">
                <Wifi size={8} />
                {matchupData.totalPersonas.toLocaleString()} personas · Cenários 2º turno
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && <span className="text-[9px] text-zinc-700">{lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
            <button onClick={() => setAutoRefresh(!autoRefresh)} className={cn(
              "px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-wider transition-all duration-200",
              autoRefresh ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/[0.03] text-zinc-600 border border-white/[0.06]"
            )}>
              {autoRefresh ? "Live" : "Off"}
            </button>
            <button onClick={fetchData} className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 border border-white/[0.06] transition-all duration-200">
              <RefreshCw size={11} />
            </button>
          </div>
        </div>

        {/* ── HERO: Flávio vs Lula ──────────────────────────────────── */}
        {heroMatchup && lula && <HeroMatchup matchup={heroMatchup} lula={lula} />}

        {/* ── OUTROS CENÁRIOS ───────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
            Outros cenários — 2º Turno vs Lula
          </h2>
          <div className="space-y-2">
            {otherMatchups.map((m) => (
              <OtherMatchup key={m.candidateId} matchup={m} lula={lula} />
            ))}
          </div>
        </div>

        {/* ── GRÁFICO DE TENDÊNCIA ─────────────────────────────────── */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 size={14} className="text-emerald-400" />
            Tendência — Evolução das Personas
          </h2>
          <TrendChart candidates={candidates || []} history={history} />
        </div>

        {/* Footer */}
        <div className="text-center text-[9px] text-zinc-700 pb-4">
          Dados das personas sintéticas · Atualizado 3x/dia · Cada cenário é 1×1 (candidato vs Lula)
        </div>
      </main>
    </div>
  );
}
