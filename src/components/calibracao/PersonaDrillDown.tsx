'use client';

import { X, User, MessageCircle } from 'lucide-react';
import type { PersonaBatchDetail } from '@/app/calibracao/store';

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 6) return 'text-emerald-500/70';
  if (score <= 3) return 'text-red-400';
  if (score <= 4) return 'text-red-500/70';
  return 'text-zinc-400';
}

interface Props {
  persona: PersonaBatchDetail;
  onClose: () => void;
}

export default function PersonaDrillDown({ persona, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800/50">
              <User size={18} className="text-zinc-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{persona.name}</h2>
              <p className="text-xs text-zinc-500">
                {persona.age} anos | {persona.state}
              </p>
            </div>
            <div className="ml-3 text-center">
              <p className={`text-2xl font-bold ${scoreColor(persona.score)}`}>
                {persona.score.toFixed(1)}
              </p>
              <p className="text-[10px] text-zinc-600">Score</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-500 hover:text-white transition-all duration-200">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
              persona.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : persona.sentiment === 'negative' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'
            }`}>
              {persona.sentiment}
            </span>
          </div>

          {persona.comment && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle size={14} className="text-zinc-500" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Comentario Gerado
                </span>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-sm text-zinc-300 leading-relaxed">{persona.comment}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
