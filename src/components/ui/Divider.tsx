"use client";

import { cn } from "@/lib/utils";

interface DividerProps {
  className?: string;
  label?: string;
}

export function Divider({ className, label }: DividerProps) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-600">{label}</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
      </div>
    );
  }

  return (
    <div className={cn("h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent", className)} />
  );
}
