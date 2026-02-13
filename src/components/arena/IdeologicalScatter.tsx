'use client';

import { useEffect, useRef } from 'react';
import type { IdeologicalPoint } from '@/lib/arena/types';

const SENTIMENT_COLORS = {
  positive: { r: 16, g: 185, b: 129 },   // emerald
  negative: { r: 244, g: 63, b: 94 },     // rose
  neutral: { r: 245, g: 158, b: 11 },     // amber
};

export function IdeologicalScatter({ points }: { points: IdeologicalPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.offsetWidth;
    const h = Math.min(w, 500);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 50;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, w, h);

    // Quadrant backgrounds
    const cx = pad + plotW / 2;
    const cy = pad + plotH / 2;

    ctx.globalAlpha = 0.04;
    // Top-left: Esq+Conservador
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(pad, pad, plotW / 2, plotH / 2);
    // Top-right: Dir+Conservador
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(cx, pad, plotW / 2, plotH / 2);
    // Bottom-left: Esq+Progressista
    ctx.fillStyle = '#10b981';
    ctx.fillRect(pad, cy, plotW / 2, plotH / 2);
    // Bottom-right: Dir+Progressista
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(cx, cy, plotW / 2, plotH / 2);
    ctx.globalAlpha = 1;

    // Axis lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    // Horizontal (economic)
    ctx.beginPath();
    ctx.moveTo(pad, cy);
    ctx.lineTo(pad + plotW, cy);
    ctx.stroke();
    // Vertical (costumes)
    ctx.beginPath();
    ctx.moveTo(cx, pad);
    ctx.lineTo(cx, pad + plotH);
    ctx.stroke();

    // Labels
    ctx.font = '10px Manrope, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('CONSERVADOR', cx, pad - 8);
    ctx.fillText('PROGRESSISTA', cx, pad + plotH + 16);
    ctx.save();
    ctx.translate(pad - 12, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('ESTADO', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(pad + plotW + 12, cy);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('MERCADO', 0, 0);
    ctx.restore();

    // Quadrant labels
    ctx.font = '9px Manrope, sans-serif';
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#10b981';
    ctx.fillText('Esq + Progressista', pad + plotW * 0.25, pad + plotH * 0.9);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Esq + Conservador', pad + plotW * 0.25, pad + plotH * 0.1);
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('Dir + Conservador', pad + plotW * 0.75, pad + plotH * 0.1);
    ctx.fillStyle = '#6366f1';
    ctx.fillText('Dir + Progressista', pad + plotW * 0.75, pad + plotH * 0.9);
    ctx.globalAlpha = 1;

    // Plot points
    for (const point of points) {
      const x = pad + ((point.scoreEco + 1) / 2) * plotW;
      const y = pad + ((point.scoreCost + 1) / 2) * plotH;
      const color = SENTIMENT_COLORS[point.sentiment];

      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},0.55)`;
      ctx.fill();
    }

    // Cluster centroids
    const clusterCentroids = new Map<string, { sumX: number; sumY: number; count: number }>();
    for (const point of points) {
      if (!clusterCentroids.has(point.clusterId)) {
        clusterCentroids.set(point.clusterId, { sumX: 0, sumY: 0, count: 0 });
      }
      const c = clusterCentroids.get(point.clusterId)!;
      c.sumX += point.scoreEco;
      c.sumY += point.scoreCost;
      c.count++;
    }

    for (const [clusterId, data] of clusterCentroids.entries()) {
      if (data.count < 5) continue;
      const avgX = data.sumX / data.count;
      const avgY = data.sumY / data.count;
      const x = pad + ((avgX + 1) / 2) * plotW;
      const y = pad + ((avgY + 1) / 2) * plotH;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 8px Manrope, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'center';
      ctx.fillText(clusterId, x, y - 9);
    }

  }, [points]);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-emerald-500/20 to-violet-500/20 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Mapa Ideológico 2D
        </p>
      </div>

      <div
        ref={containerRef}
        className="rounded-2xl bg-zinc-950/80 border border-white/[0.06] p-4 backdrop-blur-sm animate-fade-in-up"
      >
        <canvas ref={canvasRef} className="w-full rounded-xl" />

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-zinc-400 font-medium">Concorda</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[10px] text-zinc-400 font-medium">Neutro</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-[10px] text-zinc-400 font-medium">Discorda</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20 border border-white/30" />
            <span className="text-[10px] text-zinc-400 font-medium">Centróide</span>
          </div>
        </div>
      </div>
    </div>
  );
}
