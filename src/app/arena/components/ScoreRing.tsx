// Arena PWA — Score Ring (SVG circular progress)

'use client';

import { motion } from 'framer-motion';

const SIZE = 96;
const STROKE = 3;
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getColor(score: number) {
  if (score >= 7) return '#34d399';
  if (score >= 4) return '#fbbf24';
  return '#fb7185';
}

export function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  const color = getColor(score);

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background ring */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(63,63,70,0.5)"
          strokeWidth={STROKE}
        />
        {/* Progress ring */}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeLinecap="round"
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.33, 1, 0.68, 1] }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold" style={{ color }}>{score.toFixed(1)}</span>
        <span className="text-[10px] font-semibold text-zinc-500">/10</span>
      </div>
    </div>
  );
}
