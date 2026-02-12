"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, change, icon, className }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        "bg-white/[0.03] border border-white/[0.06]",
        "rounded-2xl p-5",
        "flex flex-col gap-2",
        "group hover:bg-white/[0.05] hover:border-white/[0.1]",
        "transition-all duration-300",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {icon && (
          <div className="p-2 rounded-xl bg-white/[0.04] text-zinc-500 group-hover:text-zinc-400 transition-colors">
            {icon}
          </div>
        )}
      </div>
      <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
      {change !== undefined && (
        <span
          className={cn(
            "text-xs flex items-center gap-1 font-medium",
            isPositive ? "text-emerald-400" : "text-red-400"
          )}
        >
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isPositive ? "+" : ""}
          {change}%
        </span>
      )}
    </div>
  );
}
