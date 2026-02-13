'use client';

import type { CommentResult } from '@/lib/arena/types';
import { ARCHETYPES } from '@/lib/arena/constants';

export function CommentBubble({ comment, index }: { comment: CommentResult; index: number }) {
  const colors = {
    positive: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', dot: 'bg-emerald-400' },
    negative: { border: 'border-rose-500/20', bg: 'bg-rose-500/5', dot: 'bg-rose-400' },
    neutral: { border: 'border-amber-500/20', bg: 'bg-amber-500/5', dot: 'bg-amber-400' },
  };

  const generationColors: Record<string, string> = {
    'Gen Z': 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5',
    'Millennial': 'text-violet-400 border-violet-500/20 bg-violet-500/5',
    'Gen X': 'text-orange-400 border-orange-500/20 bg-orange-500/5',
    'Boomer': 'text-red-400 border-red-500/20 bg-red-500/5',
  };

  const c = colors[comment.sentiment];
  const archetype = ARCHETYPES.find(a => a.id === comment.archetype);
  const genColor = generationColors[comment.generation] || 'text-zinc-400 border-zinc-500/20 bg-zinc-500/5';

  return (
    <div
      className={`p-4 rounded-2xl border ${c.border} ${c.bg} transition-all duration-300 hover:scale-[1.02] animate-slide-up-comment`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
        <span className="text-[11px] font-bold text-zinc-400">
          {comment.personaName}, {comment.age}
        </span>
        <span className="text-[10px] text-zinc-600">{comment.location} · {comment.region}</span>
        {archetype && (
          <span className={`text-[9px] px-2 py-0.5 rounded-full border ${archetype.border} ${archetype.text} font-semibold`}>
            {archetype.name}
          </span>
        )}
        {comment.generation && (
          <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${genColor}`}>
            {comment.generation}
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed">
        &ldquo;{comment.comment}&rdquo;
      </p>
    </div>
  );
}
