'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, Send, UserPlus, TrendingUp, Zap } from 'lucide-react';

interface StatsGridProps {
  totalAnalyzed: number;
  totalMessaged: number;
  totalFollowed: number;
  reachRate: number;
  loading?: boolean;
}

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (value === ref.current) return;
    const start = ref.current;
    const diff = value - start;
    const duration = 1200;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + diff * ease);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(step);
      else ref.current = value;
    }

    requestAnimationFrame(step);
  }, [value]);

  function format(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString('pt-BR');
  }

  return <>{format(display)}{suffix}</>;
}

/* ─── Glow Card ─── */
interface GlowCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'violet' | 'sky' | 'amber';
  delay?: number;
}

const COLOR_MAP = {
  emerald: {
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
    border: 'hover:border-emerald-500/20',
    line: 'from-emerald-500/40 via-emerald-500/10 to-transparent',
    pulse: 'bg-emerald-500',
  },
  violet: {
    iconBg: 'bg-violet-500/10',
    iconText: 'text-violet-400',
    glow: 'shadow-violet-500/20',
    border: 'hover:border-violet-500/20',
    line: 'from-violet-500/40 via-violet-500/10 to-transparent',
    pulse: 'bg-violet-500',
  },
  sky: {
    iconBg: 'bg-sky-500/10',
    iconText: 'text-sky-400',
    glow: 'shadow-sky-500/20',
    border: 'hover:border-sky-500/20',
    line: 'from-sky-500/40 via-sky-500/10 to-transparent',
    pulse: 'bg-sky-500',
  },
  amber: {
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-400',
    glow: 'shadow-amber-500/20',
    border: 'hover:border-amber-500/20',
    line: 'from-amber-500/40 via-amber-500/10 to-transparent',
    pulse: 'bg-amber-500',
  },
};

function GlowStatCard({ label, value, suffix, icon, color, delay = 0 }: GlowCardProps) {
  const [visible, setVisible] = useState(false);
  const c = COLOR_MAP[color];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={cn(
        'relative group overflow-hidden',
        'bg-white/[0.02] backdrop-blur-xl',
        'border border-white/[0.06]',
        c.border,
        'rounded-2xl p-5',
        'hover:shadow-lg',
        c.glow,
        'transition-all duration-500 ease-out',
        'hover:-translate-y-0.5',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Animated top line */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-px bg-gradient-to-r',
        c.line,
        'opacity-0 group-hover:opacity-100 transition-opacity duration-500',
      )} />

      {/* Live pulse dot */}
      <div className="absolute top-3 right-3">
        <span className={cn('relative flex h-2 w-2')}>
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-40', c.pulse)} />
          <span className={cn('relative inline-flex rounded-full h-2 w-2', c.pulse, 'opacity-60')} />
        </span>
      </div>

      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
          {label}
        </span>
        <div className={cn(
          'p-2 rounded-xl',
          c.iconBg,
          c.iconText,
          'transition-all duration-300',
          'group-hover:scale-110 group-hover:rotate-3',
        )}>
          {icon}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-4xl font-extrabold text-white tracking-tight leading-none">
          <AnimatedNumber value={value} suffix={suffix} />
        </span>
      </div>

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.015)_1px,_transparent_0)] bg-[size:20px_20px] pointer-events-none" />
    </div>
  );
}

export function StatsGrid({ totalAnalyzed, totalMessaged, totalFollowed, reachRate, loading }: StatsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="relative h-[130px] bg-zinc-900/30 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <GlowStatCard
        label="Perfis Analisados"
        value={totalAnalyzed}
        icon={<Users size={18} />}
        color="emerald"
        delay={0}
      />
      <GlowStatCard
        label="Mensagens Enviadas"
        value={totalMessaged}
        icon={<Send size={18} />}
        color="violet"
        delay={100}
      />
      <GlowStatCard
        label="Perfis Seguidos"
        value={totalFollowed}
        icon={<UserPlus size={18} />}
        color="sky"
        delay={200}
      />
      <GlowStatCard
        label="Taxa de Alcance"
        value={reachRate}
        suffix="%"
        icon={<TrendingUp size={18} />}
        color="amber"
        delay={300}
      />
    </div>
  );
}
