'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { GROUP_LABELS } from '@/lib/instagram-groups';
import { Activity, PieChart, BarChart3 } from 'lucide-react';

interface ChartsProps {
  messagesByDay: Array<{ date: string; count: number }>;
  distributionByGrupo: Array<{ grupo: string; count: number }>;
  messagesByStatus: Array<{ status: string; count: number }>;
  loading?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; hex: string }> = {
  sent: { label: 'Enviado', color: 'emerald', hex: '#34d399' },
  pending: { label: 'Pendente', color: 'amber', hex: '#fbbf24' },
  failed: { label: 'Erro', color: 'red', hex: '#f87171' },
  delivered: { label: 'Entregue', color: 'sky', hex: '#38bdf8' },
  read: { label: 'Lido', color: 'violet', hex: '#a78bfa' },
};

const DONUT_COLORS: Record<string, string> = {
  FAMILIA: '#f59e0b', EMPREENDEDOR: '#8b5cf6', FE: '#f97316', ESPORTE: '#10b981',
  EDUCACAO: '#14b8a6', SAUDE: '#f43f5e', TECH: '#06b6d4', POLITICA: '#ef4444',
  MODA: '#d946ef', ARTE: '#a855f7', MUSICA: '#6366f1', GASTRONOMIA: '#eab308',
  AGRO: '#84cc16', PET: '#fbbf24', VIAGEM: '#0ea5e9', FITNESS: '#22c55e',
  JURIDICO: '#94a3b8', INFLUENCER: '#ec4899', COMUNIDADE: '#3b82f6', LIFESTYLE: '#f472b6',
  OUTRO: '#71717a',
};

/* ─── Chart Card Wrapper ─── */
function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn(
      'relative group overflow-hidden',
      'bg-white/[0.02] backdrop-blur-xl',
      'border border-white/[0.06] hover:border-white/[0.12]',
      'rounded-2xl p-5',
      'transition-all duration-500 ease-out',
      'hover:shadow-xl hover:shadow-black/30',
    )}>
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.012)_1px,_transparent_0)] bg-[size:16px_16px] pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-white/[0.04] text-zinc-500">
            {icon}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
            {title}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Animated Timeline Chart ─── */
function TimelineChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const [animated, setAnimated] = useState(false);
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const w = 400;
  const h = 140;
  const padX = 5;
  const padY = 15;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1 || 1)) * (w - 2 * padX);
    const y = padY + (1 - d.count / maxVal) * (h - 2 * padY);
    return { x, y, ...d };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${points[0]?.x || 0},${h} ${linePoints} ${points[points.length - 1]?.x || w},${h}`;

  const totalMsgs = data.reduce((s, d) => s + d.count, 0);
  const peakDay = data.reduce((best, d) => d.count > best.count ? d : best, data[0]);

  return (
    <ChartCard title="Mensagens por Dia" icon={<Activity size={13} />}>
      {data.every((d) => d.count === 0) ? (
        <div className="flex flex-col items-center justify-center h-[160px] gap-2">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center">
            <Activity size={20} className="text-zinc-700" />
          </div>
          <p className="text-xs text-zinc-600">Nenhum disparo nos ultimos 30 dias</p>
        </div>
      ) : (
        <>
          {/* Mini stats */}
          <div className="flex items-center gap-4 mb-4">
            <div>
              <span className="text-2xl font-bold text-white">{totalMsgs}</span>
              <span className="text-[10px] text-zinc-500 ml-1.5">total</span>
            </div>
            {peakDay && peakDay.count > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <span className="text-[10px] text-emerald-400 font-medium">
                  Pico: {peakDay.count} em {peakDay.date.slice(5)}
                </span>
              </div>
            )}
          </div>

          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-[130px]"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.25" />
                <stop offset="60%" stopColor="rgb(52 211 153)" stopOpacity="0.05" />
                <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Horizontal grid lines */}
            {[0.25, 0.5, 0.75].map((pct) => (
              <line
                key={pct}
                x1={0} y1={padY + pct * (h - 2 * padY)} x2={w} y2={padY + pct * (h - 2 * padY)}
                stroke="rgba(255,255,255,0.03)" strokeWidth="1"
              />
            ))}

            {/* Area fill */}
            <polygon
              points={areaPoints}
              fill="url(#timelineGrad)"
              className={cn(
                'transition-all duration-1000',
                animated ? 'opacity-100' : 'opacity-0',
              )}
            />

            {/* Glow line behind */}
            <polyline
              points={linePoints}
              fill="none"
              stroke="rgb(52 211 153)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.15"
              filter="url(#glow)"
            />

            {/* Main line */}
            <polyline
              points={linePoints}
              fill="none"
              stroke="rgb(52 211 153)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                'transition-all duration-1000',
                animated ? 'opacity-100' : 'opacity-0',
              )}
            />

            {/* Data points */}
            {points.filter((p) => p.count > 0).map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="6" fill="rgb(52 211 153)" opacity="0.15" />
                <circle cx={p.x} cy={p.y} r="3.5" fill="rgb(9 9 11)" stroke="rgb(52 211 153)" strokeWidth="1.5" />
              </g>
            ))}
          </svg>

          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-zinc-600 font-mono">{data[0]?.date?.slice(5)}</span>
            <span className="text-[9px] text-zinc-600 font-mono">{data[data.length - 1]?.date?.slice(5)}</span>
          </div>
        </>
      )}
    </ChartCard>
  );
}

/* ─── Animated Donut Chart ─── */
function DonutChart({ data }: { data: Array<{ grupo: string; count: number }> }) {
  const [animated, setAnimated] = useState(false);
  const total = data.reduce((s, d) => s + d.count, 0);
  const top6 = data.slice(0, 6);
  const othersCount = data.slice(6).reduce((s, d) => s + d.count, 0);
  if (othersCount > 0) top6.push({ grupo: 'OUTRO', count: othersCount });

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 400);
    return () => clearTimeout(t);
  }, []);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <ChartCard title="Distribuicao por Grupo" icon={<PieChart size={13} />}>
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center h-[160px] gap-2">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center">
            <PieChart size={20} className="text-zinc-700" />
          </div>
          <p className="text-xs text-zinc-600">Nenhum grupo mapeado</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <div className="relative shrink-0">
            <svg viewBox="0 0 100 100" className="w-[120px] h-[120px]">
              <defs>
                <filter id="donutGlow">
                  <feGaussianBlur stdDeviation="2" />
                </filter>
              </defs>

              {/* Background ring */}
              <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />

              {/* Segments */}
              {top6.map((d) => {
                const pct = d.count / total;
                const dashLen = pct * circumference;
                const color = DONUT_COLORS[d.grupo] || '#71717a';
                const seg = (
                  <circle
                    key={d.grupo}
                    cx="50" cy="50" r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeDasharray={animated ? `${dashLen} ${circumference - dashLen}` : `0 ${circumference}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                    transform="rotate(-90 50 50)"
                    className="transition-all duration-1000 ease-out"
                  />
                );
                offset += dashLen;
                return seg;
              })}

              {/* Center */}
              <circle cx="50" cy="50" r="28" fill="rgb(9 9 11)" />
              <text x="50" y="46" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="system-ui">{total}</text>
              <text x="50" y="58" textAnchor="middle" fill="#52525b" fontSize="6" fontWeight="600" style={{ letterSpacing: '0.1em' }}>MENSAGENS</text>
            </svg>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {top6.map((d) => {
              const pct = Math.round((d.count / total) * 100);
              const color = DONUT_COLORS[d.grupo] || '#71717a';
              return (
                <div key={d.grupo} className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[11px] text-zinc-400 flex-1 truncate">
                    {GROUP_LABELS[d.grupo] || d.grupo}
                  </span>
                  <span className="text-[11px] text-zinc-300 font-semibold tabular-nums">{d.count}</span>
                  <span className="text-[9px] text-zinc-600 w-8 text-right tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

/* ─── Animated Status Bars ─── */
function StatusBars({ data }: { data: Array<{ status: string; count: number }> }) {
  const [animated, setAnimated] = useState(false);
  const total = data.reduce((s, d) => s + d.count, 0);
  const maxVal = Math.max(...data.map((d) => d.count), 1);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <ChartCard title="Status dos Disparos" icon={<BarChart3 size={13} />}>
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[160px] gap-2">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center">
            <BarChart3 size={20} className="text-zinc-700" />
          </div>
          <p className="text-xs text-zinc-600">Nenhum disparo registrado</p>
        </div>
      ) : (
        <>
          {/* Total with glow */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl font-bold text-white">{total}</span>
            <span className="text-[10px] text-zinc-500">disparos totais</span>
          </div>

          <div className="space-y-4">
            {data.map((d, i) => {
              const config = STATUS_CONFIG[d.status] || { label: d.status, color: 'zinc', hex: '#71717a' };
              const pct = Math.round((d.count / maxVal) * 100);
              const totalPct = Math.round((d.count / total) * 100);

              return (
                <div key={d.status} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: config.hex }}
                      />
                      <span className="text-xs font-medium text-zinc-300">
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tabular-nums">{d.count}</span>
                      <span className="text-[10px] text-zinc-600 tabular-nums w-8 text-right">{totalPct}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all ease-out"
                      style={{
                        width: animated ? `${pct}%` : '0%',
                        backgroundColor: config.hex,
                        transitionDuration: `${800 + i * 200}ms`,
                        boxShadow: `0 0 12px ${config.hex}40`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ChartCard>
  );
}

export function Charts({ messagesByDay, distributionByGrupo, messagesByStatus, loading }: ChartsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="relative h-[250px] bg-zinc-900/20 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.015] to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <TimelineChart data={messagesByDay} />
      <DonutChart data={distributionByGrupo} />
      <StatusBars data={messagesByStatus} />
    </div>
  );
}
