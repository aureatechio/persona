'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, X, TrendingUp, TrendingDown, Minus, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';

const STATE_CENTERS: Record<string, [number, number]> = {
  AC: [-8.77, -70.55], AL: [-9.57, -36.78], AM: [-3.47, -65.10], AP: [1.41, -51.77],
  BA: [-12.97, -41.68], CE: [-5.20, -39.53], DF: [-15.83, -47.86], ES: [-19.19, -40.34],
  GO: [-15.98, -49.86], MA: [-5.42, -45.44], MG: [-18.10, -44.38], MS: [-20.51, -54.54],
  MT: [-12.64, -55.42], PA: [-3.79, -52.48], PB: [-7.28, -36.72], PE: [-8.38, -37.86],
  PI: [-7.72, -42.73], PR: [-24.89, -51.55], RJ: [-22.25, -42.66], RN: [-5.81, -36.59],
  RO: [-10.83, -63.34], RR: [1.99, -61.33], RS: [-29.75, -53.25], SC: [-27.45, -50.95],
  SE: [-10.57, -37.45], SP: [-22.19, -48.79], TO: [-10.25, -48.25],
};

const STATE_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapa', BA: 'Bahia',
  CE: 'Ceara', DF: 'Distrito Federal', ES: 'Espirito Santo', GO: 'Goias',
  MA: 'Maranhao', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Para', PB: 'Paraiba', PE: 'Pernambuco', PI: 'Piaui', PR: 'Parana',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondonia', RR: 'Roraima',
  RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'Sao Paulo',
  TO: 'Tocantins',
};

/* ─── Color: uses per-state % relative to global average for more contrast ── */

function sentimentToColor(
  positive: number, negative: number, neutral: number,
  globalPosRatio: number, globalNegRatio: number,
): string {
  const total = positive + negative + neutral;
  if (total === 0) return '#27272a';

  const posRatio = positive / total;
  const negRatio = negative / total;

  // Compare to global average — amplify differences
  // deviation: positive if this state is MORE positive than average, negative if more negative
  const deviation = (posRatio - globalPosRatio) - (negRatio - globalNegRatio);
  // Map deviation to [-1, 1] with amplification (3x)
  const amplified = Math.max(-1, Math.min(1, deviation * 3));

  // Also factor in absolute sentiment
  const absoluteRatio = (positive - negative) / total;
  // Blend: 60% relative (deviation), 40% absolute
  const blended = amplified * 0.6 + absoluteRatio * 0.4;
  const clamped = Math.max(-1, Math.min(1, blended));

  // Emerald-500: #10b981, Amber-500: #f59e0b, Rose-500: #f43f5e
  if (clamped >= 0) {
    const t = clamped;
    return `rgb(${Math.round(245 - t * 235)}, ${Math.round(158 + t * 27)}, ${Math.round(11 + t * 118)})`;
  } else {
    const t = -clamped;
    return `rgb(${Math.round(245 - t * 1)}, ${Math.round(158 - t * 95)}, ${Math.round(11 + t * 83)})`;
  }
}

interface GeoFeature {
  type: string;
  properties: { sigla: string; name: string };
  geometry: { type: string; coordinates: any };
}

function projectPoint(lon: number, lat: number): [number, number] {
  const x = (lon + 75) * 12;
  const y = (-lat + 6) * 12;
  return [x, y];
}

function coordinatesToPath(coords: number[][][]): string {
  return coords.map(ring =>
    ring.map((point, i) => {
      const [x, y] = projectPoint(point[0], point[1]);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ') + 'Z'
  ).join(' ');
}

function featureToPath(geometry: any): string {
  if (geometry.type === 'Polygon') return coordinatesToPath(geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p: any) => coordinatesToPath(p)).join(' ');
  return '';
}

/* ─── State Detail Panel ────────────────────────────────────────────── */

function StateDetailPanel({ sigla, stateData, onClose }: {
  sigla: string;
  stateData: { count: number; positive: number; negative: number; neutral: number };
  onClose: () => void;
}) {
  const total = stateData.count;
  const pPos = total > 0 ? (stateData.positive / total) * 100 : 0;
  const pNeg = total > 0 ? (stateData.negative / total) * 100 : 0;
  const pNeu = total > 0 ? (stateData.neutral / total) * 100 : 0;

  return (
    <div className="absolute right-6 top-1/2 -translate-y-1/2 w-80 bg-zinc-950/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-6 shadow-2xl shadow-black/60 z-20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MapPin size={18} className="text-emerald-400" />
          <h3 className="text-xl font-bold text-white tracking-tight">{STATE_NAMES[sigla] || sigla}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors duration-200">
          <X size={16} className="text-zinc-500" />
        </button>
      </div>
      <div className="space-y-4">
        <div className="h-4 rounded-full overflow-hidden flex bg-zinc-800/50">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pPos}%` }} />
          <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${pNeu}%` }} />
          <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${pNeg}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center"><div className="text-2xl font-black text-emerald-400">{pPos.toFixed(1)}%</div><div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">A Favor</div></div>
          <div className="text-center"><div className="text-2xl font-black text-amber-400">{pNeu.toFixed(1)}%</div><div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">Neutros</div></div>
          <div className="text-center"><div className="text-2xl font-black text-rose-400">{pNeg.toFixed(1)}%</div><div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">Contra</div></div>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/[0.06]">
          <Users size={14} className="text-zinc-500" />
          <span className="text-sm text-zinc-400">{total.toLocaleString()} personas</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Animated Waiting ──────────────────────────────────────────────── */

function MapWaiting() {
  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      <div className="absolute w-[400px] h-[400px] bg-emerald-500/[0.04] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'mapFloat1 8s ease-in-out infinite' }} />
      <div className="absolute w-[350px] h-[350px] bg-rose-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'mapFloat2 10s ease-in-out infinite' }} />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative w-28 h-28">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" style={{ animation: 'spin 6s linear infinite' }} />
          <div className="absolute inset-4 rounded-full border border-dashed border-rose-500/15" style={{ animation: 'spin 8s linear infinite reverse' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin size={36} className="text-emerald-400/50 animate-pulse" />
          </div>
        </div>
        <p className="text-lg text-zinc-500">Aguardando dados do mapa...</p>
        <div className="flex gap-2">
          {[0, 200, 400].map(d => <div key={d} className="w-2 h-2 bg-emerald-400/50 rounded-full" style={{ animation: `bounce 1.4s ease-in-out ${d}ms infinite` }} />)}
        </div>
      </div>
      <style>{`
        @keyframes mapFloat1 { 0%,100% { transform: translate(-80px,-40px); } 50% { transform: translate(80px,40px); } }
        @keyframes mapFloat2 { 0%,100% { transform: translate(60px,50px); } 50% { transform: translate(-100px,-30px); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>
    </div>
  );
}

/* ─── Main Map Screen ───────────────────────────────────────────────── */

export function MapaScreen() {
  const { data, hasEverReceived } = usePresentationData();
  const [geoData, setGeoData] = useState<GeoFeature[] | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    fetch('/brazil-states.geojson').then(r => r.json()).then(geo => setGeoData(geo.features)).catch(console.error);
  }, []);

  const stateBreakdown = data?.stateBreakdown || {};

  // Compute global averages for relative color comparison
  const globalTotal = (data?.positive || 0) + (data?.negative || 0) + (data?.neutral || 0);
  const globalPosRatio = globalTotal > 0 ? (data!.positive / globalTotal) : 0.33;
  const globalNegRatio = globalTotal > 0 ? (data!.negative / globalTotal) : 0.33;

  const handleStateClick = useCallback((sigla: string) => {
    if (selectedState === sigla) {
      setSelectedState(null);
      setZoom({ scale: 1, x: 0, y: 0 });
    } else {
      setSelectedState(sigla);
      const center = STATE_CENTERS[sigla];
      if (center) {
        const [px, py] = projectPoint(center[1], center[0]);
        setZoom({ scale: 2.5, x: 300 - px * 2.5, y: 240 - py * 2.5 });
      }
    }
  }, [selectedState]);

  if (!hasEverReceived) return <MapWaiting />;

  const total = globalTotal;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative flex flex-col">
      <div className="absolute -top-40 left-1/4 w-80 h-80 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-80 h-80 bg-rose-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Top bar */}
      <div className="shrink-0 px-6 pt-6 pb-3 flex items-center gap-4 z-10">
        <div className="flex-1 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl px-5 py-3">
          <p className="text-base text-zinc-300 font-medium truncate">{data.question}</p>
        </div>
        {data.question && data.phase !== 'complete' && (() => {
          const mapProgress = data.totalCount > 0 ? Math.round((data.processedCount / data.totalCount) * 100) : 0;
          const isCollecting = data.phase === 'collecting';
          return (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shrink-0">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              {isCollecting ? (
                <>
                  <div className="w-28 h-[6px] rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full w-1/3 bg-gradient-to-r from-emerald-500/60 to-sky-400/60 rounded-full animate-pulse" />
                  </div>
                  <span className="text-xs font-medium text-emerald-400/70">Preparando...</span>
                </>
              ) : (
                <>
                  <div className="w-28 h-[6px] rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full transition-all duration-[2s] ease-out" style={{ width: `${mapProgress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-zinc-300 tabular-nums">{data.processedCount}/{data.totalCount}</span>
                  <span className="text-xs font-black text-emerald-400 tabular-nums">{mapProgress}%</span>
                </>
              )}
            </div>
          );
        })()}
        {selectedState && (
          <button onClick={() => { setSelectedState(null); setZoom({ scale: 1, x: 0, y: 0 }); }}
            className="px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl text-sm text-zinc-300 font-medium transition-all duration-200">
            Ver Brasil
          </button>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative flex items-center justify-center">
        {!geoData ? (
          <div className="flex flex-col items-center gap-4">
            <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/[0.04]"><MapPin size={48} className="text-zinc-700" /></div>
            <p className="text-zinc-600 text-lg">Carregando mapa...</p>
          </div>
        ) : (
          <svg viewBox="0 0 600 480" className="w-full h-full max-w-[900px] max-h-[calc(100vh-180px)]" style={{ overflow: 'visible' }}>
            <g className="transition-transform duration-700 ease-out" style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}>
              {geoData.map((feature) => {
                const sigla = feature.properties.sigla;
                const sd = stateBreakdown[sigla];
                const color = sd ? sentimentToColor(sd.positive, sd.negative, sd.neutral, globalPosRatio, globalNegRatio) : '#27272a';
                const isHovered = hoveredState === sigla;
                const isSelected = selectedState === sigla;

                return (
                  <path key={sigla} d={featureToPath(feature.geometry)} fill={color}
                    stroke={isSelected ? '#fff' : isHovered ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}
                    strokeWidth={isSelected ? 1.5 / zoom.scale : isHovered ? 1 / zoom.scale : 0.5 / zoom.scale}
                    className="cursor-pointer"
                    style={{ transition: 'fill 1.5s ease-out, stroke 0.2s', filter: isHovered ? 'brightness(1.2) saturate(1.3)' : 'none' }}
                    onClick={() => handleStateClick(sigla)}
                    onMouseEnter={() => setHoveredState(sigla)}
                    onMouseLeave={() => setHoveredState(null)} />
                );
              })}

              {/* State labels */}
              {geoData.map((feature) => {
                const sigla = feature.properties.sigla;
                const center = STATE_CENTERS[sigla];
                if (!center) return null;
                const [px, py] = projectPoint(center[1], center[0]);
                const sd = stateBreakdown[sigla];
                const t = sd ? sd.count : 0;
                if (t === 0 && zoom.scale < 2) return null;
                return (
                  <text key={`lbl-${sigla}`} x={px} y={py} textAnchor="middle" dominantBaseline="middle"
                    className="pointer-events-none select-none"
                    fill="white" fontSize={zoom.scale >= 2 ? 5 : 4} fontWeight="bold"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)', opacity: zoom.scale >= 2 || (selectedState === null) ? 0.9 : 0.4 }}>
                    {sigla}
                  </text>
                );
              })}
            </g>

            {/* Tooltip */}
            {hoveredState && !selectedState && (() => {
              const center = STATE_CENTERS[hoveredState];
              if (!center) return null;
              const [px, py] = projectPoint(center[1], center[0]);
              const sd = stateBreakdown[hoveredState];
              const t = sd ? sd.count : 0;
              const pp = t > 0 ? ((sd.positive / t) * 100).toFixed(0) : '0';
              const pn = t > 0 ? ((sd.negative / t) * 100).toFixed(0) : '0';
              return (
                <g className="pointer-events-none">
                  <rect x={px - 50} y={py - 30} width={100} height={26} rx={8} fill="rgba(0,0,0,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
                  <text x={px} y={py - 16} textAnchor="middle" fill="white" fontSize={7} fontWeight="bold">{STATE_NAMES[hoveredState]}</text>
                  <text x={px - 22} y={py - 6} textAnchor="middle" fill="#34d399" fontSize={6} fontWeight="bold">{pp}% favor</text>
                  <text x={px + 22} y={py - 6} textAnchor="middle" fill="#fb7185" fontSize={6} fontWeight="bold">{pn}% contra</text>
                </g>
              );
            })()}
          </svg>
        )}

        {selectedState && stateBreakdown[selectedState] && (
          <StateDetailPanel sigla={selectedState} stateData={stateBreakdown[selectedState]}
            onClose={() => { setSelectedState(null); setZoom({ scale: 1, x: 0, y: 0 }); }} />
        )}
      </div>

      {/* Bottom legend */}
      <div className="shrink-0 px-6 pb-5">
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.04] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Sentimento por Estado</span>
              <div className="flex items-center">
                <div className="w-24 h-3 rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                <span>Contra</span><span>Neutro</span><span>A Favor</span>
              </div>
            </div>
            {total > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-emerald-400">{Math.round((data.positive / total) * 100)}%</span>
                <span className="text-xs font-bold text-amber-400">{Math.round((data.neutral / total) * 100)}%</span>
                <span className="text-xs font-bold text-rose-400">{Math.round((data.negative / total) * 100)}%</span>
                <span className="text-[10px] text-zinc-600">{total.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
