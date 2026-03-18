'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, X, TrendingUp, TrendingDown, Minus, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';
import { scoreToEmoji, scoreToLabel, scoreToHex } from '@/lib/arena/types';
import type { GeoCity } from '@/lib/arena/types';

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

/* ─── Color: uses avgScore with deviation from global average for contrast ── */

function scoreToMapColor(avgScore: number, globalAvgScore: number): string {
  // Deviation from global average, amplified for visual contrast
  // Positive deviation = this state scored HIGHER than average (greener)
  // Negative deviation = this state scored LOWER than average (redder)
  const deviation = avgScore - globalAvgScore;

  // Amplify small differences (2.5x) so even 0.5 point differences are visible
  const amplified = Math.max(-1, Math.min(1, deviation * 0.5));

  // Also factor in the absolute score position (0-10 → -1 to +1)
  const absolute = (avgScore - 5) / 5;

  // Blend: 50% relative deviation + 50% absolute position
  const blended = Math.max(-1, Math.min(1, amplified * 0.5 + absolute * 0.5));

  // Color gradient: Rose (#f43f5e) → Amber (#f59e0b) → Emerald (#10b981)
  if (blended >= 0) {
    const t = blended;
    // Amber → Emerald
    return `rgb(${Math.round(245 - t * 229)}, ${Math.round(158 + t * 27)}, ${Math.round(11 + t * 118)})`;
  } else {
    const t = -blended;
    // Amber → Rose
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
  stateData: { count: number; positive: number; negative: number; neutral: number; avgScore?: number };
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
        {/* Score display — use real avgScore from backend */}
        {(() => {
          const score = stateData.avgScore ?? (total > 0
            ? Math.round(((stateData.positive * 9 + stateData.neutral * 5 + stateData.negative * 1) / total) * 10) / 10
            : 5.0);
          const emoji = scoreToEmoji(score);
          const hex = scoreToHex(score);
          const label = scoreToLabel(score);
          const barPos = (score / 10) * 100;
          return (<>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl leading-none">{emoji}</span>
              <span className="text-4xl font-black tabular-nums leading-none" style={{ color: hex }}>{score.toFixed(1)}</span>
            </div>
            <p className="text-center text-sm font-bold" style={{ color: `${hex}cc` }}>{label}</p>
            <div className="h-3 rounded-full overflow-hidden relative bg-zinc-800/50">
              <div className="absolute inset-0 rounded-full opacity-25" style={{ background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)' }} />
              <div className="absolute top-0 h-full w-[6px] rounded-full transition-all duration-500" style={{ left: `calc(${barPos}% - 3px)`, backgroundColor: hex, boxShadow: `0 0 8px ${hex}80` }} />
            </div>
          </>);
        })()}
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
  const geoCities: GeoCity[] = (data as any)?.geoCities || [];
  const hasGeoFilter = geoCities.length > 0;

  // Compute global average score for relative color comparison
  const globalTotal = (data?.positive || 0) + (data?.negative || 0) + (data?.neutral || 0);
  const globalAvgScore = data?.avgScore ?? 5.0;

  // Auto-zoom when geo filter provides city data
  useEffect(() => {
    if (!geoCities.length || !geoData) return;
    if (selectedState) return; // don't override manual zoom

    const validCities = geoCities.filter(c => c.lat && c.lng);
    if (validCities.length === 0) return;

    if (validCities.length === 1) {
      const [px, py] = projectPoint(validCities[0].lng, validCities[0].lat);
      setZoom({ scale: 4, x: 300 - px * 4, y: 240 - py * 4 });
    } else {
      const lats = validCities.map(c => c.lat);
      const lngs = validCities.map(c => c.lng);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const [px, py] = projectPoint(centerLng, centerLat);
      const latSpread = Math.max(...lats) - Math.min(...lats);
      const lngSpread = Math.max(...lngs) - Math.min(...lngs);
      const maxSpread = Math.max(latSpread, lngSpread, 2);
      const scale = Math.min(6, Math.max(2, 10 / maxSpread));
      setZoom({ scale, x: 300 - px * scale, y: 240 - py * scale });
    }
  }, [geoCities, geoData, selectedState]);

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
        <div className="flex-1" />
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
        {(selectedState || (hasGeoFilter && zoom.scale > 1)) && (
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
                const sd = stateBreakdown[sigla] as { count: number; positive: number; negative: number; neutral: number; avgScore?: number } | undefined;
                const color = sd?.avgScore != null ? scoreToMapColor(sd.avgScore, globalAvgScore) : '#27272a';
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
              {/* City markers — geo filter active */}
              {hasGeoFilter && geoCities.filter(c => c.lat && c.lng).map(city => {
                const [x, y] = projectPoint(city.lng, city.lat);
                return (
                  <g key={`geo-${city.city}-${city.state}`}>
                    <circle cx={x} cy={y} r={8 / zoom.scale} fill="rgba(52, 211, 153, 0.15)"
                      style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                    <circle cx={x} cy={y} r={3.5 / zoom.scale}
                      fill="#34d399" stroke="#000" strokeWidth={1.5 / zoom.scale} />
                    <text x={x + 8 / zoom.scale} y={y + 3 / zoom.scale}
                      fill="#d4d4d8" fontSize={`${7 / zoom.scale}px`} fontWeight="500"
                      className="pointer-events-none select-none">
                      {city.city} ({city.personaCount})
                    </text>
                  </g>
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

        {/* Geo filter info badge */}
        {hasGeoFilter && (
          <div className="absolute bottom-6 left-6 z-10 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-950/90 backdrop-blur-xl border border-emerald-500/20">
            <MapPin size={14} className="text-emerald-400 shrink-0" />
            <span className="text-xs text-zinc-300">
              <span className="font-bold text-emerald-400">{geoCities.length}</span>{' '}
              {geoCities.length === 1 ? 'cidade' : 'cidades'} analisadas
              {' • '}
              <span className="font-bold text-white">{geoCities.reduce((s, c) => s + c.personaCount, 0).toLocaleString()}</span> personas
            </span>
          </div>
        )}
      </div>

      {/* Bottom legend */}
      <div className="shrink-0 px-6 pb-5">
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.04] rounded-2xl p-4">
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
            {total > 0 && (() => {
              const globalScore = Math.round(((data.avgScore ?? 5.0)) * 10) / 10;
              const hex = scoreToHex(globalScore);
              const emoji = scoreToEmoji(globalScore);
              return (
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">{emoji}</span>
                  <span className="text-sm font-black tabular-nums" style={{ color: hex }}>{globalScore.toFixed(1)}</span>
                  <span className="text-[10px] text-zinc-600">{total.toLocaleString()} personas</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
