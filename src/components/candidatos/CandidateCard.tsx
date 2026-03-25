"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, User } from "lucide-react";
import Image from "next/image";

interface CandidateCardProps {
  id: string;
  name: string;
  party: string;
  leaning: string;
  photoUrl?: string | null;
  pollingPercent: number;
  sentimentTrend: number;
}

const leaningColors: Record<string, { bg: string; text: string; border: string }> = {
  left: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  "center-left": { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  center: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  "center-right": { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  right: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
};

const leaningLabels: Record<string, string> = {
  left: "Esquerda",
  "center-left": "Centro-Esquerda",
  center: "Centro",
  "center-right": "Centro-Direita",
  right: "Direita",
};

export default function CandidateCard({
  name,
  party,
  leaning,
  photoUrl,
  pollingPercent,
  sentimentTrend,
}: CandidateCardProps) {
  const leaningStyle = leaningColors[leaning] ?? leaningColors.center;
  const trendPositive = sentimentTrend > 0;
  const trendNeutral = sentimentTrend === 0;

  return (
    <div
      className={cn(
        "group relative",
        "bg-white/[0.03] hover:bg-white/[0.06]",
        "border border-white/[0.06] hover:border-white/[0.12]",
        "rounded-2xl p-6",
        "shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/40",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:scale-[1.02]",
        "backdrop-blur-2xl"
      )}
    >
      {/* Glow orb */}
      <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="flex items-start gap-4">
        {/* Photo */}
        <div className="relative w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-white/[0.08] group-hover:border-emerald-500/30 transition-colors duration-300">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={name}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="w-full h-full bg-zinc-800/80 flex items-center justify-center">
              <User size={24} className="text-zinc-600" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white tracking-tight truncate">
            {name}
          </h3>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1",
              "bg-white/[0.06] text-zinc-300",
              "border border-white/[0.08]",
              "rounded-full text-xs font-medium"
            )}
          >
            {party}
          </span>
        </div>
      </div>

      {/* Polling */}
      <div className="mt-5 flex items-end justify-between">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Intenção de voto
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-bold text-white tracking-tight">
              {pollingPercent.toFixed(1)}
            </span>
            <span className="text-lg text-zinc-500 font-medium">%</span>
          </div>
        </div>

        {/* Sentiment trend */}
        <div
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium",
            trendNeutral && "bg-zinc-500/10 text-zinc-400",
            trendPositive && "bg-emerald-500/10 text-emerald-400",
            !trendPositive && !trendNeutral && "bg-red-500/10 text-red-400"
          )}
        >
          {trendNeutral ? (
            <Minus size={14} />
          ) : trendPositive ? (
            <TrendingUp size={14} />
          ) : (
            <TrendingDown size={14} />
          )}
          <span>
            {trendPositive ? "+" : ""}
            {sentimentTrend.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Leaning badge */}
      <div className="mt-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1",
            leaningStyle.bg,
            leaningStyle.text,
            "border",
            leaningStyle.border,
            "rounded-full text-xs font-medium"
          )}
        >
          {leaningLabels[leaning] ?? leaning}
        </span>
      </div>
    </div>
  );
}
