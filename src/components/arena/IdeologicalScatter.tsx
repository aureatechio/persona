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
    const h = Math.min(w, 560);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 60;
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
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(pad, pad, plotW / 2, plotH / 2);
    // Top-right: Dir+Conservador
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(cx, pad, plotW / 2, plotH / 2);
    // Bottom-left: Esq+Progressista
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(pad, cy, plotW / 2, plotH / 2);
    // Bottom-right: Dir+Progressista
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(cx, cy, plotW / 2, plotH / 2);
    ctx.globalAlpha = 1;

    // Axis lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
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
    ctx.setLineDash([]);

    // Axis labels
    ctx.font = 'bold 13px Manrope, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText('CONSERVADOR', cx, pad - 14);
    ctx.fillText('PROGRESSISTA', cx, pad + plotH + 24);
    ctx.save();
    ctx.translate(pad - 22, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('ESTADO', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(pad + plotW + 22, cy);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('MERCADO', 0, 0);
    ctx.restore();
    ctx.letterSpacing = '0px';

    // Quadrant labels
    ctx.font = 'bold 12px Manrope, sans-serif';
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('Esq + Progressista', pad + plotW * 0.25, pad + plotH * 0.92);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Esq + Conservador', pad + plotW * 0.25, pad + plotH * 0.08);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Dir + Conservador', pad + plotW * 0.75, pad + plotH * 0.08);
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('Dir + Progressista', pad + plotW * 0.75, pad + plotH * 0.92);
    ctx.globalAlpha = 1;

    // Plot points
    for (const point of points) {
      const x = pad + ((point.scoreEco + 1) / 2) * plotW;
      const y = pad + ((point.scoreCost + 1) / 2) * plotH;
      const color = SENTIMENT_COLORS[point.sentiment];

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},0.65)`;
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

      // Centroid circle
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cluster ID label with background pill
      ctx.font = 'bold 11px Manrope, sans-serif';
      const label = clusterId;
      const textWidth = ctx.measureText(label).width;
      const pillPadX = 6;
      const pillPadY = 4;
      const pillX = x - textWidth / 2 - pillPadX;
      const pillY = y - 14 - 11 - pillPadY;
      const pillW = textWidth + pillPadX * 2;
      const pillH = 11 + pillPadY * 2;
      const pillR = 6;

      // Draw rounded pill background
      ctx.beginPath();
      ctx.moveTo(pillX + pillR, pillY);
      ctx.lineTo(pillX + pillW - pillR, pillY);
      ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR);
      ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
      ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH);
      ctx.lineTo(pillX + pillR, pillY + pillH);
      ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR);
      ctx.lineTo(pillX, pillY + pillR);
      ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Draw text
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 14);
    }

  }, [points]);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-4 px-1">
        <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-rose-500/20 to-sky-500/20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white/50" />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
          Mapa Ideológico 2D
        </p>
      </div>

      <div
        ref={containerRef}
        className="rounded-2xl bg-zinc-950/80 border border-white/[0.06] p-4 backdrop-blur-sm animate-fade-in-up"
      >
        <canvas ref={canvasRef} className="w-full rounded-xl" />

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-5 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
            <span className="text-xs text-zinc-300 font-medium">Concorda</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30" />
            <span className="text-xs text-zinc-300 font-medium">Neutro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/30" />
            <span className="text-xs text-zinc-300 font-medium">Discorda</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white/20 border border-white/40" />
            <span className="text-xs text-zinc-300 font-medium">Centróide do Cluster</span>
          </div>
        </div>
      </div>
    </div>
  );
}
