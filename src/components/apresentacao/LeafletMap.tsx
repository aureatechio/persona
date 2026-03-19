'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CityData } from '@/lib/arena/types';
import { scoreToHex } from '@/lib/arena/types';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface StateBreakdownItem {
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  avgScore?: number;
}

interface Props {
  stateBreakdown: Record<string, StateBreakdownItem>;
  cityBreakdown: Record<string, CityData[]>;
  globalAvgScore: number;
  selectedState: string | null;
  selectedCity: string | null;
  onSelectState: (sigla: string | null) => void;
  onSelectCity: (city: CityData | null) => void;
}

/* ── Score → Map Color (same logic as old SVG map) ─────────────────────────── */

function scoreToMapColor(avgScore: number, globalAvgScore: number): string {
  const deviation = avgScore - globalAvgScore;
  const amplified = Math.max(-1, Math.min(1, deviation * 0.5));
  const absolute = (avgScore - 5) / 5;
  const blended = Math.max(-1, Math.min(1, amplified * 0.5 + absolute * 0.5));
  if (blended >= 0) {
    const t = blended;
    return `rgb(${Math.round(245 - t * 229)}, ${Math.round(158 + t * 27)}, ${Math.round(11 + t * 118)})`;
  } else {
    const t = -blended;
    return `rgb(${Math.round(245 - t * 1)}, ${Math.round(158 - t * 95)}, ${Math.round(11 + t * 83)})`;
  }
}

/* ── State centers for fly-to ─────────────────────────────────────────────── */

const STATE_CENTERS: Record<string, [number, number]> = {
  AC: [-8.77, -70.55], AL: [-9.57, -36.78], AM: [-3.47, -65.10], AP: [1.41, -51.77],
  BA: [-12.97, -41.68], CE: [-5.20, -39.53], DF: [-15.83, -47.86], ES: [-19.19, -40.34],
  GO: [-15.98, -49.86], MA: [-5.42, -45.44], MG: [-18.10, -44.38], MS: [-20.51, -54.54],
  MT: [-12.64, -55.42], PA: [-3.79, -52.48], PB: [-7.28, -36.72], PE: [-8.38, -37.86],
  PI: [-7.72, -42.73], PR: [-24.89, -51.55], RJ: [-22.25, -42.66], RN: [-5.81, -36.59],
  RO: [-10.83, -63.34], RR: [1.99, -61.33], RS: [-29.75, -53.25], SC: [-27.45, -50.95],
  SE: [-10.57, -37.45], SP: [-22.19, -48.79], TO: [-10.25, -48.25],
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function LeafletMap({
  stateBreakdown,
  cityBreakdown,
  globalAvgScore,
  selectedState,
  selectedCity,
  onSelectState,
  onSelectCity,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const cityMarkersRef = useRef<L.LayerGroup | null>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(0);

  // Keep refs in sync for canvas draw
  const selectedStateRef = useRef(selectedState);
  const selectedCityRef = useRef(selectedCity);
  selectedStateRef.current = selectedState;
  selectedCityRef.current = selectedCity;

  /* ── Canvas animation loop (Maestro-inspired grid + pulse) ──────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    phaseRef.current += 0.009;

    // Subtle full-canvas grid
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.015)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 90) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 90) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  /* ── Map initialization ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined' || !mapDivRef.current || mapRef.current) return;

    // Fix Leaflet default icons
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' });

    const map = L.map(mapDivRef.current, {
      center: [-14, -51],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });
    mapRef.current = map;

    // Base tiles — dark, brightness adjusted
    const basePane = map.createPane('basePane');
    basePane.style.zIndex = '200';
    basePane.style.filter = 'brightness(0.72) saturate(0.5) contrast(1.06)';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19, keepBuffer: 4, pane: 'basePane',
    }).addTo(map);

    // Label tiles — crisp white
    const labelPane = map.createPane('labelPane');
    labelPane.style.zIndex = '260';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19, keepBuffer: 4, pane: 'labelPane',
    }).addTo(map);

    // City markers layer
    cityMarkersRef.current = L.layerGroup().addTo(map);

    // Animated fly-in
    setTimeout(() => map.flyTo([-14, -51], 5, { duration: 2.0, easeLinearity: 0.28 }), 350);

    // Load GeoJSON
    fetch('/brazil-states.geojson')
      .then(r => r.json())
      .then(geoData => {
        geoLayerRef.current = L.geoJSON(geoData, {
          style: () => ({
            fillColor: '#27272a',
            fillOpacity: 0.6,
            color: 'rgba(255,255,255,0.12)',
            weight: 1,
          }),
          onEachFeature: (feature, layer) => {
            layer.on('mouseover', () => {
              (layer as any).setStyle({ color: 'rgba(255,255,255,0.4)', weight: 1.5, fillOpacity: 0.75 });
            });
            layer.on('mouseout', () => {
              const sigla = feature.properties.sigla;
              if (selectedStateRef.current !== sigla) {
                updateStateStyle(layer, feature);
              }
            });
            layer.on('click', () => {
              const sigla = feature.properties.sigla;
              onSelectState(selectedStateRef.current === sigla ? null : sigla);
            });
          },
        }).addTo(map);
      })
      .catch(console.error);

    // Canvas overlay
    const loop = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(draw); };
    map.on('move zoom moveend zoomend', loop);
    loop();

    return () => {
      cancelAnimationFrame(rafRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Helper: Update a GeoJSON layer style based on current data ─────────── */
  const updateStateStyle = useCallback((layer: any, feature: any) => {
    const sigla = feature.properties.sigla;
    const sd = stateBreakdown[sigla];
    const color = sd?.avgScore != null
      ? scoreToMapColor(sd.avgScore, globalAvgScore)
      : '#27272a';
    layer.setStyle({
      fillColor: color,
      fillOpacity: 0.6,
      color: 'rgba(255,255,255,0.12)',
      weight: 1,
    });
  }, [stateBreakdown, globalAvgScore]);

  /* ── Update GeoJSON colors when data changes ────────────────────────────── */
  useEffect(() => {
    if (!geoLayerRef.current) return;
    geoLayerRef.current.eachLayer((layer: any) => {
      const feature = layer.feature;
      if (!feature) return;
      const sigla = feature.properties.sigla;
      const isSelected = selectedState === sigla;
      const sd = stateBreakdown[sigla];
      const color = sd?.avgScore != null
        ? scoreToMapColor(sd.avgScore, globalAvgScore)
        : '#27272a';
      layer.setStyle({
        fillColor: color,
        fillOpacity: isSelected ? 0.85 : 0.6,
        color: isSelected ? '#fff' : 'rgba(255,255,255,0.12)',
        weight: isSelected ? 2 : 1,
      });
    });
  }, [stateBreakdown, globalAvgScore, selectedState]);

  /* ── Fly to state / city / reset ────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedCity) {
      // Find city data
      const cities = selectedState ? cityBreakdown[selectedState] : [];
      const city = cities?.find(c => c.city === selectedCity);
      if (city?.lat && city?.lng) {
        map.flyTo([city.lat, city.lng], 10, { duration: 1.2, easeLinearity: 0.2 });
      }
    } else if (selectedState) {
      const center = STATE_CENTERS[selectedState];
      if (center) {
        map.flyTo(center, 7, { duration: 1.5, easeLinearity: 0.2 });
      }
    } else {
      map.flyTo([-14, -51], 5, { duration: 1.5, easeLinearity: 0.28 });
    }
  }, [selectedState, selectedCity, cityBreakdown]);

  /* ── City markers ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const group = cityMarkersRef.current;
    if (!group) return;
    group.clearLayers();

    if (!selectedState || !cityBreakdown[selectedState]) return;

    const cities = cityBreakdown[selectedState].slice(0, 50); // top 50 by count
    const maxCount = Math.max(...cities.map(c => c.count), 1);

    cities.forEach(city => {
      if (!city.lat || !city.lng) return;
      const color = scoreToHex(city.avgScore);
      const sz = Math.max(8, Math.min(16, (city.count / maxCount) * 16));
      const isSelected = selectedCity === city.city;

      const html = `
        <div style="position:relative;width:${sz * 3}px;height:${sz * 3}px;
          display:flex;align-items:center;justify-content:center;cursor:pointer;">
          ${[0, 0.75, 1.5].map(delay => `
            <div style="position:absolute;width:${sz}px;height:${sz}px;border-radius:50%;
              border:1.5px solid ${color};opacity:${isSelected ? 0.6 : 0.3};
              animation:pulse-ring 2.2s ease-out ${delay}s infinite;"></div>
          `).join('')}
          <div style="width:${Math.round(sz * 0.65)}px;height:${Math.round(sz * 0.65)}px;
            border-radius:50%;background:${color};
            box-shadow:0 0 10px ${color}bb,0 0 4px ${color};
            position:relative;z-index:2;"></div>
        </div>`;

      const icon = L.divIcon({
        html,
        className: '',
        iconSize: [sz * 3, sz * 3],
        iconAnchor: [(sz * 3) / 2, (sz * 3) / 2],
      });

      L.marker([city.lat, city.lng], { icon, zIndexOffset: isSelected ? 1000 : city.count })
        .addTo(group)
        .on('click', () => {
          onSelectCity(selectedCityRef.current === city.city ? null : city);
        })
        .bindTooltip(
          `<div style="font-family:monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">
            <strong style="color:${color}">${city.city}</strong><br/>
            <span style="color:#a1a1aa">${city.count} personas · ${city.avgScore.toFixed(1)}</span>
          </div>`,
          { direction: 'top', offset: [0, -sz], className: 'city-tooltip' }
        );
    });
  }, [selectedState, selectedCity, cityBreakdown, onSelectCity]);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Canvas overlay for grid effect */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 450,
      }} />

      {/* Vignettes (Maestro-style edge gradients) */}
      {[
        { top: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to bottom,rgba(0,0,0,.80) 0%,transparent 100%)' },
        { bottom: 0, left: 0, right: 0, height: '110px', background: 'linear-gradient(to top,rgba(0,0,0,.88) 0%,transparent 100%)' },
        { top: 0, left: 0, bottom: 0, width: '60px', background: 'linear-gradient(to right,rgba(0,0,0,.4) 0%,transparent 100%)' },
        { top: 0, right: 0, bottom: 0, width: '60px', background: 'linear-gradient(to left,rgba(0,0,0,.4) 0%,transparent 100%)' },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', pointerEvents: 'none', zIndex: 460, ...s as any }} />
      ))}

      {/* Pulse ring keyframes */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .city-tooltip {
          background: rgba(0,0,0,0.9) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
        }
        .city-tooltip::before {
          border-top-color: rgba(0,0,0,0.9) !important;
        }
      `}</style>
    </div>
  );
}
