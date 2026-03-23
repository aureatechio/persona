// Arena PWA — Comment Card (persona reaction)

'use client';

import { memo } from 'react';
import type { CommentResult } from '../types';
import { scoreToHex, scoreToEmoji } from '../constants';

interface CommentCardProps {
  comment: CommentResult;
}

function CommentCardInner({ comment }: CommentCardProps) {
  const score = comment.score ?? 5;
  const hex = scoreToHex(score);
  const emoji = scoreToEmoji(score);

  const sentimentLabel = comment.sentiment === 'positive' ? 'Positivo'
    : comment.sentiment === 'negative' ? 'Negativo'
      : 'Neutro';

  const sentimentColor = comment.sentiment === 'positive' ? '#34d399'
    : comment.sentiment === 'negative' ? '#fb7185'
      : '#fbbf24';

  return (
    <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 pl-4 overflow-hidden">
      {/* Left accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ backgroundColor: sentimentColor }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{emoji}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-white truncate block">
            {comment.personaName}, {comment.age}
          </span>
          <span className="text-[10px] text-zinc-500 truncate block">
            {comment.city || comment.location || comment.state}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-black tabular-nums" style={{ color: hex }}>
            {score.toFixed(1)}
          </span>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ color: sentimentColor, backgroundColor: `${sentimentColor}15` }}
          >
            {sentimentLabel}
          </span>
        </div>
      </div>

      {/* Comment */}
      <p className="text-xs text-zinc-400 italic leading-relaxed line-clamp-3">
        &ldquo;{comment.comment}&rdquo;
      </p>

      {/* Tags */}
      <div className="flex gap-1.5 mt-2">
        {comment.gender && (
          <span className="text-[9px] text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded-full">
            {comment.gender}
          </span>
        )}
        {comment.politicalLeaning && (
          <span className="text-[9px] text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded-full">
            {comment.politicalLeaning}
          </span>
        )}
      </div>
    </div>
  );
}

export const CommentCard = memo(CommentCardInner, (prev, next) =>
  prev.comment.personaName === next.comment.personaName &&
  prev.comment.sentiment === next.comment.sentiment
);
