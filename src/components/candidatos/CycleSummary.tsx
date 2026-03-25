"use client";

import { cn } from "@/lib/utils";
import { Newspaper, CheckCircle, SkipForward, AlertTriangle } from "lucide-react";

interface CycleSummaryProps {
  newsProcessed: number;
  newsApplied: number;
  newsSkipped: number;
  pollingError: number;
}

const stats = [
  {
    key: "newsProcessed" as const,
    label: "Notícias Processadas",
    icon: Newspaper,
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
  },
  {
    key: "newsApplied" as const,
    label: "Aplicadas",
    icon: CheckCircle,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  {
    key: "newsSkipped" as const,
    label: "Ignoradas",
    icon: SkipForward,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  {
    key: "pollingError" as const,
    label: "Erro Pesquisas",
    icon: AlertTriangle,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    isPercentage: true,
  },
];

export default function CycleSummary({
  newsProcessed,
  newsApplied,
  newsSkipped,
  pollingError,
}: CycleSummaryProps) {
  const values = { newsProcessed, newsApplied, newsSkipped, pollingError };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const value = values[stat.key];

        return (
          <div
            key={stat.key}
            className={cn(
              "bg-white/[0.03] border border-white/[0.06]",
              "rounded-2xl p-5",
              "flex flex-col gap-3",
              "transition-all duration-300",
              "hover:bg-white/[0.05] hover:border-white/[0.1]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {stat.label}
              </span>
              <div
                className={cn(
                  "p-2 rounded-xl",
                  stat.bgColor,
                  "border",
                  stat.borderColor
                )}
              >
                <Icon size={16} className={stat.color} />
              </div>
            </div>
            <span className="text-3xl font-bold text-white tracking-tight">
              {stat.key === "pollingError"
                ? `${value.toFixed(1)}%`
                : value.toLocaleString("pt-BR")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
