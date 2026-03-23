// Arena PWA — Radar Chart (6-axis SVG hexagonal)

'use client';

import type { RadarData } from '../types';

const LABELS: { key: keyof RadarData; label: string }[] = [
  { key: 'alcance', label: 'Alcance' },
  { key: 'engajamento', label: 'Engajamento' },
  { key: 'retencao', label: 'Retenção' },
  { key: 'conversao', label: 'Conversão' },
  { key: 'adequacao', label: 'Adequação' },
  { key: 'emocional', label: 'Emocional' },
];

const CX = 150;
const CY = 150;
const MAX_R = 80;
const N = LABELS.length;
const RINGS = [2.5, 5, 7.5, 10];

function getPoint(idx: number, value: number) {
  const angle = (Math.PI * 2 * idx) / N - Math.PI / 2;
  const r = (value / 10) * MAX_R;
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function pointsStr(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

export function RadarChart({ radar }: { radar: RadarData }) {
  const dataPoints = LABELS.map((item, i) => getPoint(i, radar[item.key] || 0));

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 300 300" className="w-full max-w-[300px] aspect-square">
        {/* Grid rings */}
        {RINGS.map((r) => {
          const pts = Array.from({ length: N }, (_, i) => getPoint(i, r));
          return (
            <polygon
              key={r}
              points={pointsStr(pts)}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
          );
        })}

        {/* Axis lines */}
        {LABELS.map((_, i) => {
          const end = getPoint(i, 10);
          return (
            <line
              key={i}
              x1={CX} y1={CY}
              x2={end.x} y2={end.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={pointsStr(dataPoints)}
          fill="rgba(52,211,153,0.1)"
          stroke="rgba(52,211,153,0.6)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x} cy={p.y}
            r={3.5}
            fill="rgb(52,211,153)"
            stroke="rgb(0,0,0)"
            strokeWidth={1.5}
          />
        ))}

        {/* Labels */}
        {LABELS.map((item, i) => {
          const pos = getPoint(i, 13.5);
          const val = radar[item.key] || 0;
          return (
            <g key={i}>
              <text
                x={pos.x} y={pos.y - 7}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#d4d4d8"
                fontSize={11}
                fontWeight={600}
              >
                {item.label}
              </text>
              <text
                x={pos.x} y={pos.y + 7}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#34d399"
                fontSize={10}
                fontWeight={700}
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
