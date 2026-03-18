'use client';

import {
  Loader2, CheckCircle2, AlertCircle, Minus, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeStatus } from './types';
import { NODE_ICONS, NODE_LABELS, NODE_DESCRIPTIONS } from './types';

/* ── Flow Arrow between nodes ── */

export function FlowArrow({ active }: { active: boolean }) {
  return (
    <div className="flex justify-center py-0.5">
      <div className={cn(
        'w-px h-5 transition-colors duration-500',
        active ? 'bg-gradient-to-b from-violet-500/40 to-violet-500/10' : 'bg-zinc-800/30',
      )} />
    </div>
  );
}

/* ── Single Pipeline Node ── */

export function PipelineNode({
  nodeKey,
  status,
  logCount,
  lastLogMessage,
  isSelected,
  onClick,
  hasDetail,
  preview,
  extra,
}: {
  nodeKey: string;
  status: NodeStatus;
  logCount: number;
  lastLogMessage?: string;
  isSelected: boolean;
  onClick: () => void;
  hasDetail?: boolean;
  preview?: string;
  extra?: React.ReactNode;
}) {
  const statusIcon = {
    idle: <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />,
    running: <Loader2 size={16} className="text-violet-400 animate-spin" />,
    complete: <CheckCircle2 size={16} className="text-emerald-400" />,
    error: <AlertCircle size={16} className="text-red-400" />,
    skipped: <Minus size={16} className="text-zinc-600" />,
  }[status];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border p-4 transition-all duration-300',
        status === 'running' ? 'border-violet-500/40 bg-violet-500/5' :
        status === 'complete' ? 'border-emerald-500/30 bg-emerald-500/5' :
        status === 'error' ? 'border-red-500/30 bg-red-500/5' :
        status === 'skipped' ? 'border-zinc-800/30 bg-zinc-950/40 opacity-40' :
        'border-zinc-800/50 bg-zinc-900/40',
        isSelected && 'ring-2 ring-violet-500/40 shadow-lg shadow-violet-500/10',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          status === 'running' ? 'bg-violet-500/15 text-violet-400' :
          status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
          status === 'error' ? 'bg-red-500/10 text-red-400' :
          'bg-zinc-800/50 text-zinc-500',
        )}>
          {NODE_ICONS[nodeKey]}
        </div>

        {/* Label + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-200">{NODE_LABELS[nodeKey]}</span>
            {statusIcon}
            {hasDetail && (
              <Eye size={12} className="text-violet-400" />
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {lastLogMessage || NODE_DESCRIPTIONS[nodeKey]}
          </p>
        </div>

        {/* Log count */}
        {logCount > 0 && (
          <span className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-lg tabular-nums shrink-0">
            {logCount}
          </span>
        )}
      </div>

      {/* Preview of main output data */}
      {preview && status !== 'idle' && (
        <p className="text-xs text-zinc-400 mt-2 pl-[52px] truncate">{preview}</p>
      )}

      {/* Extra content (e.g. progress bar) */}
      {extra}
    </button>
  );
}
