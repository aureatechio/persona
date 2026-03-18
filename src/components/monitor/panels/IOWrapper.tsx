'use client';

import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Reusable labeled key-value display */
export function DataField({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div
        className={cn(
          'text-sm text-zinc-200 leading-relaxed',
          mono && 'font-mono text-xs',
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** INPUT section — sky accent */
export function InputSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowDownToLine size={16} className="text-sky-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
          Entrada
        </span>
      </div>
      {children}
    </div>
  );
}

/** OUTPUT section — emerald accent */
export function OutputSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowUpFromLine size={16} className="text-emerald-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          Saida
        </span>
      </div>
      {children}
    </div>
  );
}
