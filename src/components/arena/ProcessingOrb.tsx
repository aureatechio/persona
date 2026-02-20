'use client';

import { Brain } from 'lucide-react';

export function ProcessingOrb() {
  return (
    <div className="relative w-52 h-52 flex items-center justify-center">
      {/* Outer radar pulse rings */}
      <div className="absolute inset-0 rounded-full border border-violet-500/10 arena-radar-pulse" />
      <div className="absolute inset-0 rounded-full border border-fuchsia-500/10 arena-radar-pulse" style={{ animationDelay: '0.6s' }} />
      <div className="absolute inset-0 rounded-full border border-cyan-500/8 arena-radar-pulse" style={{ animationDelay: '1.2s' }} />
      <div className="absolute inset-0 rounded-full border border-violet-500/5 arena-radar-pulse" style={{ animationDelay: '1.8s' }} />

      {/* Outer rotating dashed ring */}
      <svg className="absolute inset-0 w-full h-full" style={{ animation: 'hex-rotate 20s linear infinite' }}>
        <circle cx="50%" cy="50%" r="48%" fill="none" stroke="rgba(139,92,246,0.12)" strokeWidth="1" strokeDasharray="8 12" />
      </svg>

      {/* Second rotating dashed ring (reverse) */}
      <svg className="absolute inset-0 w-full h-full" style={{ animation: 'hex-rotate 15s linear infinite reverse' }}>
        <circle cx="50%" cy="50%" r="42%" fill="none" stroke="rgba(236,72,153,0.08)" strokeWidth="1" strokeDasharray="4 16" />
      </svg>

      {/* Primary spinning ring - thick gradient */}
      <div
        className="absolute inset-3 rounded-full border-2 border-transparent border-t-violet-500/70 border-r-fuchsia-500/50"
        style={{ animation: 'ring-segment 1.8s linear infinite' }}
      />

      {/* Secondary spinning ring - thin, reverse */}
      <div
        className="absolute inset-6 rounded-full border-[1.5px] border-transparent border-b-cyan-400/50 border-l-violet-400/40"
        style={{ animation: 'ring-segment 2.5s linear infinite reverse' }}
      />

      {/* Third spinning ring - dotted */}
      <div
        className="absolute inset-9 rounded-full border border-dashed border-violet-500/15"
        style={{ animation: 'ring-segment 8s linear infinite' }}
      />

      {/* Orbiting particles */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            animation: `orbit ${3 + i * 0.8}s linear infinite`,
            animationDelay: `${i * -0.5}s`,
            '--orbit-radius': `${60 + i * 8}px`,
          } as React.CSSProperties}
        >
          <div
            className="rounded-full"
            style={{
              width: `${3 - i * 0.3}px`,
              height: `${3 - i * 0.3}px`,
              backgroundColor: i % 2 === 0 ? 'rgba(139,92,246,0.7)' : 'rgba(236,72,153,0.6)',
              boxShadow: i % 2 === 0
                ? '0 0 6px rgba(139,92,246,0.5)'
                : '0 0 6px rgba(236,72,153,0.4)',
            }}
          />
        </div>
      ))}

      {/* Energy wave rings */}
      <div
        className="absolute inset-8 rounded-full border border-violet-500/20"
        style={{ animation: 'energy-wave 3s ease-out infinite' }}
      />
      <div
        className="absolute inset-8 rounded-full border border-fuchsia-500/15"
        style={{ animation: 'energy-wave 3s ease-out infinite', animationDelay: '1.5s' }}
      />

      {/* Inner glow background */}
      <div className="absolute inset-12 rounded-full bg-gradient-to-br from-violet-600/15 via-fuchsia-600/10 to-cyan-600/8 blur-md" />

      {/* Core */}
      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-600/25 to-fuchsia-600/15 flex items-center justify-center backdrop-blur-sm border border-violet-500/25 shadow-lg shadow-violet-500/10">
        <Brain size={28} className="text-violet-400 animate-glow-oscillate relative z-10" />
      </div>
    </div>
  );
}
