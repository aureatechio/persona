"use client";

import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

interface DriftRow {
  cluster: string;
  driftLula: number;
  driftFlavio: number;
  budgetRemaining: number;
}

interface DriftDashboardProps {
  rows: DriftRow[];
}

function getDriftColor(drift: number): string {
  const abs = Math.abs(drift);
  if (abs <= 0.02) return "text-emerald-400 bg-emerald-500/10";
  if (abs <= 0.05) return "text-amber-400 bg-amber-500/10";
  return "text-red-400 bg-red-500/10";
}

function getBudgetColor(budget: number): string {
  if (budget >= 0.5) return "text-emerald-400";
  if (budget >= 0.2) return "text-amber-400";
  return "text-red-400";
}

export default function DriftDashboard({ rows }: DriftDashboardProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <Activity size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Nenhum dado de drift disponível</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-white/[0.03] border border-white/[0.06]",
        "rounded-2xl overflow-hidden",
        "backdrop-blur-2xl"
      )}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <Activity size={16} className="text-violet-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white tracking-tight">
            Drift por Cluster
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Desvio acumulado por segmento e candidato
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs font-medium uppercase tracking-wider text-zinc-500 px-6 py-3">
                Cluster
              </th>
              <th className="text-center text-xs font-medium uppercase tracking-wider text-zinc-500 px-6 py-3">
                Drift Lula
              </th>
              <th className="text-center text-xs font-medium uppercase tracking-wider text-zinc-500 px-6 py-3">
                Drift Flávio
              </th>
              <th className="text-right text-xs font-medium uppercase tracking-wider text-zinc-500 px-6 py-3">
                Budget Restante
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((row) => (
              <tr
                key={row.cluster}
                className="hover:bg-white/[0.03] transition-colors duration-200"
              >
                <td className="px-6 py-4 text-sm font-medium text-white">
                  {row.cluster}
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                      getDriftColor(row.driftLula)
                    )}
                  >
                    {row.driftLula > 0 ? "+" : ""}
                    {(row.driftLula * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                      getDriftColor(row.driftFlavio)
                    )}
                  >
                    {row.driftFlavio > 0 ? "+" : ""}
                    {(row.driftFlavio * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      getBudgetColor(row.budgetRemaining)
                    )}
                  >
                    {(row.budgetRemaining * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
