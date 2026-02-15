'use client';

import type { CandidateColorSet } from '@/lib/arena-eleitoral/types';
import { CANDIDATE_COLORS_LEFT, CANDIDATE_COLORS_RIGHT } from '@/lib/arena-eleitoral/constants';

interface TugOfWarBarProps {
  votesA: number;
  votesB: number;
  nameA: string;
  nameB: string;
  colorsA?: CandidateColorSet;
  colorsB?: CandidateColorSet;
  showLabels?: boolean;
  height?: string;
  animated?: boolean;
}

export function TugOfWarBar({
  votesA,
  votesB,
  nameA,
  nameB,
  colorsA = CANDIDATE_COLORS_LEFT,
  colorsB = CANDIDATE_COLORS_RIGHT,
  showLabels = true,
  height = 'h-3',
  animated = true,
}: TugOfWarBarProps) {
  const total = votesA + votesB;
  const percentA = total > 0 ? (votesA / total) * 100 : 50;
  const percentB = total > 0 ? (votesB / total) * 100 : 50;

  return (
    <div className="space-y-2">
      {showLabels && (
        <div className="flex items-center justify-between text-xs">
          <span className={`font-semibold ${colorsA.primary}`}>
            {nameA} · {percentA.toFixed(1)}%
          </span>
          <span className={`font-semibold ${colorsB.primary}`}>
            {percentB.toFixed(1)}% · {nameB}
          </span>
        </div>
      )}
      <div className={`w-full ${height} rounded-full bg-zinc-800/50 overflow-hidden flex`}>
        <div
          className={`${colorsA.bar} rounded-l-full ${animated ? 'transition-all duration-1000 ease-out' : ''}`}
          style={{ width: `${percentA}%` }}
        />
        <div
          className={`${colorsB.bar} rounded-r-full ${animated ? 'transition-all duration-1000 ease-out' : ''}`}
          style={{ width: `${percentB}%` }}
        />
      </div>
      {showLabels && (
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>{votesA.toLocaleString()} votos</span>
          <span>{votesB.toLocaleString()} votos</span>
        </div>
      )}
    </div>
  );
}
