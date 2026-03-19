'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, X, Users, ChevronLeft, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';
import { scoreToEmoji, scoreToLabel, scoreToHex } from '@/lib/arena/types';
import type { CityData, GeoCity } from '@/lib/arena/types';

/* ── Lazy-load Leaflet (no SSR) ────────────────────────────────────────────── */

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase">Inicializando...</span>
      </div>
    </div>
  ),
});

/* ── State Names ────────────────────────────────────────────────────────────── */

const STATE_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima',
  RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo',
  TO: 'Tocantins',
};

/* ── Score gauge (shared between State and City panels) ────────────────────── */

function ScoreGauge({ score }: { score: number }) {
  const emoji = scoreToEmoji(score);
  const hex = scoreToHex(score);
  const label = scoreToLabel(score);
  const barPos = (score / 10) * 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <span className="text-3xl leading-none">{emoji}</span>
        <span className="text-4xl font-black tabular-nums leading-none" style={{ color: hex }}>{score.toFixed(1)}</span>
      </div>
      <p className="text-center text-sm font-bold" style={{ color: `${hex}cc` }}>{label}</p>
      <div className="h-3 rounded-full overflow-hidden relative bg-zinc-800/50">
        <div className="absolute inset-0 rounded-full opacity-25" style={{ background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)' }} />
        <div className="absolute top-0 h-full w-[6px] rounded-full transition-all duration-500" style={{ left: `calc(${barPos}% - 3px)`, backgroundColor: hex, boxShadow: `0 0 8px ${hex}80` }} />
      </div>
    </div>
  );
}

/* ── Sentiment bars ────────────────────────────────────────────────────────── */

function SentimentBars({ positive, negative, neutral, total }: { positive: number; negative: number; neutral: number; total: number }) {
  const pPos = total > 0 ? (positive / total) * 100 : 0;
  const pNeg = total > 0 ? (negative / total) * 100 : 0;
  const pNeu = total > 0 ? (neutral / total) * 100 : 0;
  return (
    <div className="space-y-2">
      {[
        { label: 'Positivo', pct: pPos, color: '#34d399' },
        { label: 'Negativo', pct: pNeg, color: '#fb7185' },
        { label: 'Neutro', pct: pNeu, color: '#fbbf24' },
      ].map(b => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-500 w-16 tracking-wider uppercase">{b.label}</span>
          <div className="flex-1 h-[6px] bg-zinc-800/50 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${b.pct}%`, background: b.color }} />
          </div>
          <span className="text-[11px] font-mono font-bold tabular-nums w-10 text-right" style={{ color: b.color }}>{b.pct.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

/* ── State Detail Panel (Maestro-inspired glass slide-in) ──────────────────── */

function StateDetailPanel({ sigla, stateData, cities, onClose, onCityClick }: {
  sigla: string;
  stateData: { count: number; positive: number; negative: number; neutral: number; avgScore?: number };
  cities: CityData[];
  onClose: () => void;
  onCityClick: (city: CityData) => void;
}) {
  const total = stateData.count;
  const score = stateData.avgScore ?? (total > 0
    ? Math.round(((stateData.positive * 9 + stateData.neutral * 5 + stateData.negative * 1) / total) * 10) / 10
    : 5.0);

  return (
    <div
      className="absolute top-4 right-4 w-[340px] z-[500] overflow-hidden rounded-2xl"
      style={{
        animation: 'slideInRight 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        background: 'rgba(9,9,11,0.95)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 25px 80px rgba(0,0,0,0.8)',
        maxHeight: 'calc(100vh - 180px)',
      }}
    >
      {/* Top accent line */}
      <div className="h-0.5 w-full bg-emerald-500/50" />

      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-emerald-400" />
            <span className="text-[9px] font-mono text-emerald-400/70 tracking-[0.2em] uppercase">Estado</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors duration-200">
            <X size={14} className="text-zinc-500" />
          </button>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">{STATE_NAMES[sigla] || sigla}</h2>
      </div>

      {/* Score */}
      <div className="p-4">
        <ScoreGauge score={score} />
      </div>

      {/* Sentiment bars */}
      <div className="px-4 pb-3">
        <SentimentBars positive={stateData.positive} negative={stateData.negative} neutral={stateData.neutral} total={total} />
      </div>

      {/* Persona count */}
      <div className="px-4 pb-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
        <Users size={12} className="text-zinc-500" />
        <span className="text-xs text-zinc-400">{total.toLocaleString()} personas</span>
      </div>

      {/* City list */}
      {cities.length > 0 && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
          <span className="text-[9px] font-mono text-zinc-500 tracking-[0.2em] uppercase mb-2 block">
            Cidades ({cities.length})
          </span>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
            {cities.slice(0, 30).map(city => (
              <button key={city.city} onClick={() => onCityClick(city)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl
                           bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04]
                           hover:border-white/[0.1] transition-all duration-200 group">
                <span className="text-sm text-zinc-300 group-hover:text-white truncate mr-2">{city.city}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold tabular-nums" style={{ color: scoreToHex(city.avgScore) }}>
                    {city.avgScore.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-zinc-600">{city.count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── City Detail Panel ─────────────────────────────────────────────────────── */

function CityDetailPanel({ city, stateSigla, onClose, onBack }: {
  city: CityData;
  stateSigla: string;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <div
      className="absolute top-4 right-4 w-[340px] z-[500] overflow-hidden rounded-2xl"
      style={{
        animation: 'slideInRight 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        background: 'rgba(9,9,11,0.95)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 25px 80px rgba(0,0,0,0.8)',
      }}
    >
      {/* Top accent line */}
      <div className="h-0.5 w-full" style={{ background: scoreToHex(city.avgScore) }} />

      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-start justify-between mb-1">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 hover:text-zinc-300 tracking-[0.15em] transition-colors">
            <ChevronLeft size={12} />
            {STATE_NAMES[stateSigla] || stateSigla}
          </button>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors duration-200">
            <X size={14} className="text-zinc-500" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <MapPin size={14} style={{ color: scoreToHex(city.avgScore) }} />
          <h2 className="text-xl font-bold text-white tracking-tight">{city.city}</h2>
        </div>
        <span className="text-[10px] font-mono text-zinc-600 tracking-wider mt-0.5 block">
          {STATE_NAMES[stateSigla]} · {city.lat?.toFixed(4)}°S, {Math.abs(city.lng || 0).toFixed(4)}°W
        </span>
      </div>

      {/* Score */}
      <div className="p-4">
        <ScoreGauge score={city.avgScore} />
      </div>

      {/* Sentiment bars */}
      <div className="px-4 pb-3">
        <SentimentBars positive={city.positive} negative={city.negative} neutral={city.neutral} total={city.count} />
      </div>

      {/* Persona count */}
      <div className="px-4 pb-4 flex items-center gap-2 border-t border-white/[0.06] pt-3">
        <Users size={12} className="text-zinc-500" />
        <span className="text-xs text-zinc-400">{city.count.toLocaleString()} personas nesta cidade</span>
      </div>
    </div>
  );
}

/* ── Loading state — Spinning Globe (cobe) ─────────────────────────────────── */

function MapWaiting() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let globe: import('cobe').Globe | null = null;
    let phi = 0;
    let raf: number;

    import('cobe').then(({ default: createGlobe }) => {
      if (!canvasRef.current) return;
      globe = createGlobe(canvasRef.current, {
        devicePixelRatio: 2,
        width: 800 * 2,
        height: 800 * 2,
        phi: 0,
        theta: -0.3,
        dark: 1,
        diffuse: 3,
        mapSamples: 16000,
        mapBrightness: 12,
        baseColor: [0.3, 0.35, 0.4],
        markerColor: [0.16, 0.73, 0.50],
        glowColor: [0.15, 0.2, 0.25],
        markers: [
          { location: [-23.55, -46.63], size: 0.06 },
          { location: [-22.91, -43.17], size: 0.05 },
          { location: [-15.79, -47.88], size: 0.04 },
          { location: [-12.97, -38.51], size: 0.04 },
          { location: [-3.72, -38.52], size: 0.04 },
          { location: [-8.05, -34.87], size: 0.04 },
          { location: [-30.03, -51.23], size: 0.04 },
          { location: [-19.92, -43.94], size: 0.04 },
          { location: [-25.43, -49.27], size: 0.04 },
          { location: [-2.50, -44.28], size: 0.03 },
        ],
      });

      // Rotate the globe continuously
      const spin = () => {
        phi += 0.005;
        globe?.update({ phi });
        raf = requestAnimationFrame(spin);
      };
      raf = requestAnimationFrame(spin);
    });

    return () => {
      cancelAnimationFrame(raf);
      globe?.destroy();
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      {/* Subtle glow behind globe (not on top) */}
      <div className="absolute w-[800px] h-[800px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(120,160,200,0.15) 0%, rgba(60,100,140,0.08) 35%, transparent 65%)' }} />

      {/* Globe */}
      <div className="relative flex flex-col items-center gap-6">
        <canvas
          ref={canvasRef}
          style={{
            width: 520, height: 520,
            maxWidth: '85vmin', maxHeight: '85vmin',
            aspectRatio: '1',
          }}
        />

        {/* Text below */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-[10px] font-mono text-emerald-400/70 tracking-[0.35em] uppercase">
            Mapa de Personas
          </span>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                style={{ animation: `waitDot 0.9s ease-in-out ${i * 0.2}s infinite alternate` }} />
            ))}
          </div>
          <span className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase">
            Aguardando dados...
          </span>
        </div>
      </div>

      <style>{`
        @keyframes waitDot { 0% { opacity: 0.2; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1.2); } }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN MAP SCREEN
═══════════════════════════════════════════════════════════════════════════ */

export function MapaScreen() {
  const { data, hasEverReceived } = usePresentationData();
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCityData, setSelectedCityData] = useState<CityData | null>(null);

  const stateBreakdown = data?.stateBreakdown || {};
  const cityBreakdown = (data as any)?.cityBreakdown || {};
  const geoCities: GeoCity[] = (data as any)?.geoCities || [];
  const hasGeoFilter = geoCities.length > 0;
  const globalTotal = (data?.positive || 0) + (data?.negative || 0) + (data?.neutral || 0);
  const globalAvgScore = data?.avgScore ?? 5.0;

  const handleSelectState = useCallback((sigla: string | null) => {
    setSelectedState(sigla);
    setSelectedCityData(null);
  }, []);

  const handleSelectCity = useCallback((city: CityData | null) => {
    setSelectedCityData(city);
  }, []);

  const handleCityClickFromPanel = useCallback((city: CityData) => {
    setSelectedCityData(city);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedState(null);
    setSelectedCityData(null);
  }, []);

  const handleBackToState = useCallback(() => {
    setSelectedCityData(null);
  }, []);

  if (!hasEverReceived) return <MapWaiting />;

  const selectedCity = selectedCityData?.city ?? null;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">

      {/* Leaflet Map (full-screen) */}
      <LeafletMap
        stateBreakdown={stateBreakdown}
        cityBreakdown={cityBreakdown}
        geoCities={geoCities}
        globalAvgScore={globalAvgScore}
        selectedState={selectedState}
        selectedCity={selectedCity}
        onSelectState={handleSelectState}
        onSelectCity={handleSelectCity}
      />

      {/* Top bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-[470] px-6 pt-6 pb-3 flex items-center gap-4 pointer-events-none">
        <div className="flex-1" />

        {/* Progress bar */}
        {data.question && data.phase !== 'complete' && (() => {
          const mapProgress = data.totalCount > 0 ? Math.round((data.processedCount / data.totalCount) * 100) : 0;
          return (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shrink-0 pointer-events-auto backdrop-blur-xl">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <div className="w-28 h-[6px] rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full" style={{ width: `${mapProgress}%`, transition: mapProgress <= 2 ? 'none' : 'width 2s ease-out' }} />
              </div>
              <span className="text-xs font-bold text-zinc-300 tabular-nums">
                {data.processedCount > 0 ? `${data.processedCount}/${data.totalCount}` : 'Preparando...'}
              </span>
              {mapProgress > 0 && <span className="text-xs font-black text-emerald-400 tabular-nums">{mapProgress}%</span>}
            </div>
          );
        })()}

        {/* Navigation buttons */}
        {(selectedState || selectedCityData) && (
          <div className="flex items-center gap-2 pointer-events-auto">
            {selectedCityData && (
              <button onClick={handleBackToState}
                className="px-4 py-2.5 bg-black/70 hover:bg-black/90 backdrop-blur-xl border border-white/[0.08] rounded-xl text-sm text-zinc-300 font-medium transition-all duration-200 flex items-center gap-2">
                <ArrowLeft size={14} />
                {STATE_NAMES[selectedState!] || selectedState}
              </button>
            )}
            <button onClick={handleClose}
              className="px-4 py-2.5 bg-black/70 hover:bg-black/90 backdrop-blur-xl border border-white/[0.08] rounded-xl text-sm text-zinc-300 font-medium transition-all duration-200">
              Ver Brasil
            </button>
          </div>
        )}
      </div>

      {/* Detail panels */}
      {selectedState && !selectedCityData && stateBreakdown[selectedState] && (
        <StateDetailPanel
          sigla={selectedState}
          stateData={stateBreakdown[selectedState]}
          cities={cityBreakdown[selectedState] || []}
          onClose={handleClose}
          onCityClick={handleCityClickFromPanel}
        />
      )}

      {selectedCityData && selectedState && (
        <CityDetailPanel
          city={selectedCityData}
          stateSigla={selectedState}
          onClose={handleClose}
          onBack={handleBackToState}
        />
      )}

      {/* Geo filter info badge */}
      {hasGeoFilter && (
        <div className="absolute bottom-20 left-6 z-[470] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-950/90 backdrop-blur-xl border border-emerald-500/20">
          <MapPin size={14} className="text-emerald-400 shrink-0" />
          <span className="text-xs text-zinc-300">
            <span className="font-bold text-emerald-400">{geoCities.length}</span>{' '}
            {geoCities.length === 1 ? 'cidade' : 'cidades'} analisadas
            {' · '}
            <span className="font-bold text-white">{geoCities.reduce((s, c) => s + c.personaCount, 0).toLocaleString()}</span> personas
          </span>
        </div>
      )}

      {/* Bottom legend */}
      <div className="absolute bottom-0 left-0 right-0 z-[470] px-6 pb-5 pointer-events-none">
        <div className="bg-black/70 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-4 pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Nota por Estado</span>
              <div className="flex items-center gap-1">
                <span className="text-xs">💣</span>
                <div className="w-24 h-3 rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" />
                <span className="text-xs">🔥</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                <span>0</span><span>5</span><span>10</span>
              </div>
            </div>
            {globalTotal > 0 && (() => {
              const globalScore = Math.round((data.avgScore ?? 5.0) * 10) / 10;
              const hex = scoreToHex(globalScore);
              const emoji = scoreToEmoji(globalScore);
              return (
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">{emoji}</span>
                  <span className="text-sm font-black tabular-nums" style={{ color: hex }}>{globalScore.toFixed(1)}</span>
                  <span className="text-[10px] text-zinc-600">{globalTotal.toLocaleString()} personas</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
