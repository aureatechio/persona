// Arena PWA — Bottom tab bar

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Vote, BarChart3, MapPin } from 'lucide-react';
import { useArenaStore } from '../store';

const ACTIVE = '#34d399';
const INACTIVE = '#52525b';

export function ArenaNav() {
  const pathname = usePathname();
  const hasEverReceived = useArenaStore((s) => s.hasEverReceived);
  const phase = useArenaStore((s) => s.data.phase);
  const processedCount = useArenaStore((s) => s.data.processedCount);

  // Data exists = personas started being processed (not just collecting phase)
  const hasData = processedCount > 0;
  const isLive = hasEverReceived && phase !== 'complete';

  const isDashboard = pathname === '/arena/dashboard';
  const isVoto = pathname === '/arena';
  const isMapa = pathname.startsWith('/arena/mapa');

  return (
    <>
      {/* Keyframe animation for pulsing dot */}
      <style>{`
        @keyframes arena-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }
        .arena-dot-pulse {
          animation: arena-pulse 1s ease-in-out infinite;
        }
      `}</style>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          backgroundColor: '#000000',
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
          height: 85,
          paddingTop: 8,
          paddingBottom: 28,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-end justify-around h-full max-w-lg mx-auto px-4">
          {/* Painel (left) */}
          <Link
            href="/arena/dashboard"
            className="flex flex-col items-center gap-0.5"
            style={{ opacity: hasData ? 1 : 0.5, pointerEvents: hasData ? 'auto' : 'none' }}
          >
            <div className="relative w-11 h-8 flex items-center justify-center">
              {isDashboard && (
                <>
                  <div className="absolute -top-0.5 w-1 h-1 rounded-full" style={{ backgroundColor: ACTIVE }} />
                  <div className="absolute w-9 h-9 rounded-full" style={{ backgroundColor: 'rgba(52,211,153,0.1)' }} />
                </>
              )}
              {/* Red pulsing dot when data exists */}
              {hasData && !isDashboard && (
                <span
                  className="absolute -top-1 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 arena-dot-pulse"
                  style={{ border: '2px solid #000', boxShadow: '0 0 8px rgba(239,68,68,0.8)' }}
                />
              )}
              <BarChart3
                size={22}
                color={isDashboard ? ACTIVE : (hasData ? INACTIVE : '#3f3f46')}
                strokeWidth={isDashboard ? 2.5 : 1.5}
              />
            </div>
            <span
              className="text-[10px] font-semibold tracking-wide mt-0.5"
              style={{ color: isDashboard ? ACTIVE : (hasData ? INACTIVE : '#3f3f46') }}
            >
              Painel
            </span>
          </Link>

          {/* VOTIA (center, raised) */}
          <Link href="/arena" className="flex flex-col items-center" style={{ marginTop: -20 }}>
            <div
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center"
              style={isVoto ? {
                backgroundColor: ACTIVE,
                borderColor: ACTIVE,
                border: `1px solid ${ACTIVE}`,
                boxShadow: `0 0 12px rgba(52,211,153,0.4)`,
              } : {
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Vote size={28} color={isVoto ? '#000' : '#71717a'} strokeWidth={isVoto ? 2.5 : 1.5} />
            </div>
            <span
              className="text-[10px] font-semibold tracking-wide mt-1"
              style={{ color: isVoto ? ACTIVE : INACTIVE }}
            >
              VOTIA
            </span>
          </Link>

          {/* Mapa (right) */}
          <Link
            href="/arena/mapa"
            className="flex flex-col items-center gap-0.5"
            style={{ opacity: hasData ? 1 : 0.5, pointerEvents: hasData ? 'auto' : 'none' }}
          >
            <div className="relative w-11 h-8 flex items-center justify-center">
              {isMapa && (
                <>
                  <div className="absolute -top-0.5 w-1 h-1 rounded-full" style={{ backgroundColor: ACTIVE }} />
                  <div className="absolute w-9 h-9 rounded-full" style={{ backgroundColor: 'rgba(52,211,153,0.1)' }} />
                </>
              )}
              {/* Red pulsing dot when data exists */}
              {hasData && !isMapa && (
                <span
                  className="absolute -top-1 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 arena-dot-pulse"
                  style={{ border: '2px solid #000', boxShadow: '0 0 8px rgba(239,68,68,0.8)' }}
                />
              )}
              <MapPin
                size={22}
                color={isMapa ? ACTIVE : (hasData ? INACTIVE : '#3f3f46')}
                strokeWidth={isMapa ? 2.5 : 1.5}
              />
            </div>
            <span
              className="text-[10px] font-semibold tracking-wide mt-0.5"
              style={{ color: isMapa ? ACTIVE : (hasData ? INACTIVE : '#3f3f46') }}
            >
              Mapa
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
}
