import { cn } from "@/lib/utils";
import { Clock, Sparkles, Newspaper, BarChart3, Activity } from "lucide-react";
import Link from "next/link";
import CandidateCard from "@/components/candidatos/CandidateCard";

interface Candidate {
  id: string;
  name: string;
  party: string;
  leaning: string;
  photo_url?: string | null;
  polling_percent: number;
  sentiment_trend: number;
}

interface CycleNews {
  id: string;
  headline: string;
  impact: string;
  candidate_name?: string;
  created_at: string;
}

interface CycleSummaryData {
  news?: CycleNews[];
  ran_at?: string;
}

async function getCandidates(): Promise<Candidate[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/candidates`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getLatestCycle(): Promise<CycleSummaryData | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/living/cycles?limit=1`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch {
    return null;
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "---";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

export default async function CandidatosPage() {
  const [candidates, latestCycle] = await Promise.all([
    getCandidates(),
    getLatestCycle(),
  ]);

  const sortedCandidates = [...candidates].sort(
    (a, b) => b.polling_percent - a.polling_percent
  );

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
              <Sparkles size={28} className="text-emerald-400" />
              Corrida Presidencial 2026
            </h1>
            <p className="text-zinc-500 mt-2 flex items-center gap-2">
              <Clock size={14} />
              Atualizado em {formatDate(latestCycle?.ran_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/candidatos/sentimentos"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] rounded-xl font-medium text-sm active:scale-[0.97] transition-all duration-200"
            >
              <BarChart3 size={16} />
              Sentimentos
            </Link>
            <Link
              href="/candidatos/monitor"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] rounded-xl font-medium text-sm active:scale-[0.97] transition-all duration-200"
            >
              <Activity size={16} />
              Monitor
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

        {/* Candidates grid */}
        {sortedCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
              <Sparkles size={32} className="text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm">
              Nenhum candidato encontrado
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {sortedCandidates.map((c) => (
              <CandidateCard
                key={c.id}
                id={c.id}
                name={c.name}
                party={c.party}
                leaning={c.leaning}
                photoUrl={c.photo_url}
                pollingPercent={c.polling_percent}
                sentimentTrend={c.sentiment_trend}
              />
            ))}
          </div>
        )}

        {/* Recent News Section */}
        {latestCycle?.news && latestCycle.news.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
              <Newspaper size={22} className="text-zinc-400" />
              Notícias Recentes com Impacto
            </h2>

            <div className="space-y-3">
              {latestCycle.news.slice(0, 8).map((news) => (
                <div
                  key={news.id}
                  className={cn(
                    "bg-white/[0.03] hover:bg-white/[0.05]",
                    "border border-white/[0.06] hover:border-white/[0.1]",
                    "rounded-xl p-4",
                    "flex items-start gap-4",
                    "transition-all duration-300"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium leading-relaxed">
                      {news.headline}
                    </p>
                    {news.candidate_name && (
                      <p className="text-xs text-zinc-500 mt-1">
                        {news.candidate_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shrink-0",
                      getImpactColor(news.impact)
                    )}
                  >
                    {impactLabel[news.impact] ?? news.impact}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
