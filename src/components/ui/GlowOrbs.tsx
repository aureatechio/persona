"use client";

import { cn } from "@/lib/utils";

interface GlowOrbsProps {
  className?: string;
  variant?: "emerald-violet" | "blue-pink" | "amber-emerald";
}

const orbColors = {
  "emerald-violet": { first: "bg-emerald-500/5", second: "bg-violet-500/5" },
  "blue-pink": { first: "bg-sky-500/5", second: "bg-pink-500/5" },
  "amber-emerald": { first: "bg-amber-500/5", second: "bg-emerald-500/5" },
};

export function GlowOrbs({ className, variant = "emerald-violet" }: GlowOrbsProps) {
  const colors = orbColors[variant];

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <div
        className={cn(
          "absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-glow-pulse",
          colors.first
        )}
      />
      <div
        className={cn(
          "absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-glow-pulse",
          colors.second
        )}
        style={{ animationDelay: "1.5s" }}
      />
    </div>
  );
}
