'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';

export interface InsightCardData {
  icon: LucideIcon;
  label: string;
  detail?: string;
}

interface InsightCardProps {
  data: InsightCardData;
  size: 'sm' | 'md' | 'lg';
}

// Generate a random hex-like data string
function randomHex(len: number) {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * 16)];
  return result;
}

// Generate random percentage
function randomPct() {
  return (Math.random() * 100).toFixed(1);
}

export function InsightCard({ data, size }: InsightCardProps) {
  const Icon = data.icon;
  const [dataValue, setDataValue] = useState(randomHex(4));
  const [pctValue, setPctValue] = useState(randomPct());
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Flickering data values
    intervalRef.current = setInterval(() => {
      setDataValue(randomHex(4));
      setPctValue(randomPct());
      setProgress(prev => {
        const next = prev + Math.random() * 15;
        return next > 100 ? Math.random() * 30 : next;
      });
    }, 800 + Math.random() * 600);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        'relative inline-flex flex-col rounded-2xl whitespace-nowrap shrink-0 overflow-hidden group',
        'border transition-all duration-500',
        // Holographic gradient border on hover-like pulse
        size === 'sm' && 'w-[160px] h-[72px] p-2.5',
        size === 'md' && 'w-[200px] h-[88px] p-3',
        size === 'lg' && 'w-[240px] h-[104px] p-3.5',
      )}
      style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(236,72,153,0.04) 100%)',
        borderColor: 'rgba(139,92,246,0.15)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Scan line effect */}
      <div className="animate-scan-line absolute inset-0 pointer-events-none" />

      {/* Top row: icon + label + hex value */}
      <div className="flex items-center gap-2 relative z-10">
        <div className={cn(
          'flex items-center justify-center rounded-lg',
          'bg-violet-500/10 border border-violet-500/20',
          size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-7 h-7' : 'w-8 h-8',
        )}>
          <Icon
            size={size === 'sm' ? 11 : size === 'md' ? 13 : 15}
            className="text-violet-400 animate-glow-oscillate"
          />
        </div>
        <span className={cn(
          'font-semibold text-zinc-300 truncate flex-1',
          size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-[11px]' : 'text-xs',
        )}>
          {data.label}
        </span>
        {size !== 'sm' && (
          <span
            className="font-mono text-[9px] text-fuchsia-400/60 tabular-nums"
            style={{ animation: 'value-flicker 1.5s ease-in-out infinite' }}
          >
            0x{dataValue}
          </span>
        )}
      </div>

      {/* Bottom row: micro progress bar + percentage */}
      <div className="flex items-end gap-2 mt-auto relative z-10">
        <div className="flex-1 flex flex-col gap-1">
          {/* Mini progress bar */}
          <div className="h-[3px] rounded-full bg-zinc-800/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {size !== 'sm' && (
            <div className="flex items-center gap-1.5">
              {/* Micro data stream dots */}
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-[3px] h-[3px] rounded-full"
                  style={{
                    backgroundColor: `rgba(139,92,246,${0.2 + Math.random() * 0.6})`,
                    animation: `data-rain ${1 + Math.random() * 2}s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
              <span className="text-[8px] font-mono text-zinc-600 ml-auto tabular-nums">
                {pctValue}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Subtle corner glow */}
      <div className="absolute -top-4 -right-4 w-12 h-12 bg-violet-500/10 rounded-full blur-xl pointer-events-none" />
      <div className="absolute -bottom-4 -left-4 w-10 h-10 bg-fuchsia-500/8 rounded-full blur-xl pointer-events-none" />
    </div>
  );
}
