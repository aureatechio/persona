'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapPin, X, TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';

/* ─── Brazil state centers for zoom ─────────────────────────────────── */

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

/* ─── Color interpolation ───────────────────────────────────────────── */

function sentimentToColor(positive: number, negative: number, neutral: number): string {
  const total = positive + negative + neutral;
  if (total === 0) return '#27272a'; // zinc-800

  const ratio = (positive - negative) / total; // -1 to 1
  // -1 = full red, 0 = yellow, 1 = full green
  if (ratio >= 0) {
    // Yellow to Green
    const t = ratio;
    const r = Math.round(245 - t * 229); // 245 -> 16
    const g = Math.round(158 + t * 27);  // 158 -> 185
    const b = Math.round(11 + t * 118);  // 11 -> 129
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Red
    const t = -ratio;
    const r = Math.round(245 - t * 6);   // 245 -> 239
    const g = Math.round(158 - t * 90);  // 158 -> 68
    const b = Math.round(11 + t * 57);   // 11 -> 68
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/* ─── SVG Map Component (using raw GeoJSON) ─────────────────────────── */

interface GeoFeature {
  type: string;
  properties: { sigla: string; name: string };
  geometry: { type: string; coordinates: any };
}

function projectPoint(lon: number, lat: number): [number, number] {
  // Simple Mercator projection scaled for Brazil
  const x = (lon + 75) * 12;
  const y = (-lat + 6) * 12;
  return [x, y];
}

function coordinatesToPath(coords: number[][][]): string {
  return coords.map(ring => {
    return ring.map((point, i) => {
      const [x, y] = projectPoint(point[0], point[1]);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ') + 'Z';
  }).join(' ');
}

function featureToPath(geometry: any): string {
  if (geometry.type === 'Polygon') {
    return coordinatesToPath(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((poly: number[][][]) => coordinatesToPath(poly)).join(' ');
  }
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
    <div className="absolute right-6 top-1/2 -translate-y-1/2 w-80 bg-zinc-950/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-6 shadow-2xl shadow-black/60 z-20 animate-in fade-in slide-in-from-right-4 duration-300">
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
        {/* Sentiment bar */}
        <div className="h-4 rounded-full overflow-hidden flex bg-zinc-800/50">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pPos}%` }} />
          <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${pNeu}%` }} />
          <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${pNeg}%` }} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-black text-emerald-400">{pPos.toFixed(1)}%</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">A Favor</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-amber-400">{pNeu.toFixed(1)}%</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">Neutros</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-rose-400">{pNeg.toFixed(1)}%</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">Contra</div>
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/[0.06]">
          <Users size={14} className="text-zinc-500" />
          <span className="text-sm text-zinc-400">{total.toLocaleString()} personas</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Map Screen ───────────────────────────────────────────────── */

export function MapaScreen() {
  const data = usePresentationData();
  const [geoData, setGeoData] = useState<GeoFeature[] | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });

  // Load GeoJSON
  useEffect(() => {
    fetch('/brazil-states.geojson')
      .then(r => r.json())
      .then(geo => setGeoData(geo.features))
      .catch(console.error);
  }, []);

  const stateBreakdown = data?.stateBreakdown || {};

  const handleStateClick = useCallback((sigla: string) => {
    if (selectedState === sigla) {
      setSelectedState(null);
      setZoom({ scale: 1, x: 0, y: 0 });
    } else {
      setSelectedState(sigla);
      const center = STATE_CENTERS[sigla];
      if (center) {
        const [px, py] = projectPoint(center[1], center[0]);
        // Center the map on the state
        const viewCenterX = 300;
        const viewCenterY = 240;
        setZoom({
          scale: 2.5,
          x: viewCenterX - px * 2.5,
          y: viewCenterY - py * 2.5,
        });
      }
    }
  }, [selectedState]);

  const total = (data?.positive || 0) + (data?.negative || 0) + (data?.neutral || 0);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative flex flex-col">
      {/* Decorative glow */}
      <div className="absolute -top-40 left-1/4 w-80 h-80 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-80 h-80 bg-rose-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Top bar */}
      <div className="shrink-0 px-6 pt-6 pb-3 flex items-center gap-4 z-10">
        <div className="flex-1 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl px-5 py-3">
          <p className="text-base text-zinc-300 font-medium truncate">{data?.question || 'Aguardando analise...'}</p>
        </div>
        {data && data.phase !== 'complete' && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shrink-0">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">
              {Math.round((data.processedCount / data.totalCount) * 100)}%
            </span>
          </div>
        )}
        {selectedState && (
          <button
            onClick={() => { setSelectedState(null); setZoom({ scale: 1, x: 0, y: 0 }); }}
            className="px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl text-sm text-zinc-300 font-medium transition-all duration-200"
          >
            Ver Brasil
          </button>
        )}
      </div>

      {/* Map container */}
      <div className="flex-1 relative flex items-center justify-center">
        {!geoData ? (
          <div className="flex flex-col items-center gap-4">
            <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/[0.04]">
              <MapPin size={48} className="text-zinc-700" />
            </div>
            <p className="text-zinc-600 text-lg">Carregando mapa...</p>
          </div>
        ) : (
          <svg
            viewBox="0 0 600 480"
            className="w-full h-full max-w-[900px] max-h-[calc(100vh-180px)]"
            style={{ overflow: 'visible' }}
          >
            <g
              className="transition-transform duration-700 ease-out"
              style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}
            >
              {geoData.map((feature) => {
                const sigla = feature.properties.sigla;
                const stateData = stateBreakdown[sigla];
                const color = stateData
                  ? sentimentToColor(stateData.positive, stateData.negative, stateData.neutral)
                  : '#27272a';
                const isHovered = hoveredState === sigla;
                const isSelected = selectedState === sigla;

                return (
                  <path
                    key={sigla}
                    d={featureToPath(feature.geometry)}
                    fill={color}
                    stroke={isSelected ? '#fff' : isHovered ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}
                    strokeWidth={isSelected ? 1.5 / zoom.scale : isHovered ? 1 / zoom.scale : 0.5 / zoom.scale}
                    className="cursor-pointer"
                    style={{
                      transition: 'fill 1.5s ease-out, stroke 0.2s, stroke-width 0.2s',
                      filter: isHovered ? 'brightness(1.2)' : 'none',
                    }}
                    onClick={() => handleStateClick(sigla)}
                    onMouseEnter={() => setHoveredState(sigla)}
                    onMouseLeave={() => setHoveredState(null)}
                  />
                );
              })}

              {/* State labels when zoomed */}
              {zoom.scale >= 2 && selectedState && geoData.map((feature) => {
                const sigla = feature.properties.sigla;
                if (sigla !== selectedState) return null;
                const center = STATE_CENTERS[sigla];
                if (!center) return null;
                const [px, py] = projectPoint(center[1], center[0]);
                return (
                  <text
                    key={`label-${sigla}`}
                    x={px}
                    y={py}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none"
                    fill="white"
                    fontSize={6}
                    fontWeight="bold"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {STATE_NAMES[sigla] || sigla}
                  </text>
                );
              })}
            </g>

            {/* Tooltip for hovered state (when not zoomed in on selected) */}
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
                  <rect x={px - 45} y={py - 26} width={90} height={22} rx={6} fill="rgba(0,0,0,0.85)" />
                  <text x={px} y={py - 12} textAnchor="middle" fill="white" fontSize={7} fontWeight="bold">
                    {STATE_NAMES[hoveredState]}
                  </text>
                  <text x={px - 20} y={py - 2} textAnchor="middle" fill="#34d399" fontSize={6}>
                    {pp}%
                  </text>
                  <text x={px + 20} y={py - 2} textAnchor="middle" fill="#fb7185" fontSize={6}>
                    {pn}%
                  </text>
                </g>
              );
            })()}
          </svg>
        )}

        {/* State detail panel */}
        {selectedState && stateBreakdown[selectedState] && (
          <StateDetailPanel
            sigla={selectedState}
            stateData={stateBreakdown[selectedState]}
            onClose={() => { setSelectedState(null); setZoom({ scale: 1, x: 0, y: 0 }); }}
          />
        )}
      </div>

      {/* Bottom legend */}
      <div className="shrink-0 px-6 pb-5">
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.04] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            {/* Color scale */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Sentimento</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-rose-500" />
                <div className="w-4 h-4 rounded bg-rose-400" />
                <div className="w-4 h-4 rounded bg-amber-500" />
                <div className="w-4 h-4 rounded bg-emerald-400" />
                <div className="w-4 h-4 rounded bg-emerald-500" />
              </div>
              <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                <span>Contra</span>
                <span>Neutro</span>
                <span>A Favor</span>
              </div>
            </div>

            {/* Stats */}
            {data && total > 0 && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">{total > 0 ? Math.round((data.positive / total) * 100) : 0}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Minus size={12} className="text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">{total > 0 ? Math.round((data.neutral / total) * 100) : 0}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={12} className="text-rose-400" />
                  <span className="text-xs font-bold text-rose-400">{total > 0 ? Math.round((data.negative / total) * 100) : 0}%</span>
                </div>
                <span className="text-[10px] text-zinc-600">{total.toLocaleString()} personas</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
