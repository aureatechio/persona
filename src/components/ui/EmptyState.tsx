"use client";

import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title = "Nada por aqui",
  description = "Nenhum item encontrado.",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 text-center", className)}>
      <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
        {icon || <Inbox size={32} className="text-zinc-600" />}
      </div>
      <p className="text-white font-medium mb-1">{title}</p>
      <p className="text-zinc-500 text-sm max-w-xs">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
