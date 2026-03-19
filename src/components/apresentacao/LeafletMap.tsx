'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CityData, GeoCity, CommentResult } from '@/lib/arena/types';
import { scoreToHex } from '@/lib/arena/types';
import { getCityCoords } from '@/lib/brazil-city-coords';

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
  geoCities: GeoCity[];
  liveComments: CommentResult[];
  globalAvgScore: number;
  selectedState: string | null;
  selectedCity: string | null;
  onSelectState: (sigla: string | null) => void;
  onSelectCity: (city: CityData | null) => void;
}

/* ── Score → Map Color ──────────────────────────────────────────────────── */

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

/* ── Sentiment → color ──────────────────────────────────────────────────── */

function sentimentColor(s: string): string {
  if (s === 'positive') return '#34d399';
  if (s === 'negative') return '#fb7185';
  return '#fbbf24';
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

/* ── Jitter: spread pins around a center ──────────────────────────────────── */

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function jitterPosition(lat: number, lng: number, index: number, spreadDeg: number): [number, number] {
  const angle = (index * 2.399) + seededRandom(index * 7) * 0.4; // golden angle spread
  const radius = spreadDeg * (0.3 + seededRandom(index * 13) * 0.7);
  return [lat + Math.cos(angle) * radius, lng + Math.sin(angle) * radius];
}

/* ── Resolve lat/lng for a comment/persona ────────────────────────────────── */

function resolvePersonaCoords(
  c: CommentResult,
  cityBreakdown: Record<string, CityData[]>,
  geoCities: GeoCity[],
): [number, number] | null {
  // 1. Direct from persona
  if (c.lat && c.lng && isFinite(c.lat) && isFinite(c.lng)) return [c.lat, c.lng];

  const city = c.city || '';
  const state = c.state || '';
  if (!city && !state) return null;

  // 2. From cityBreakdown
  if (city && state && cityBreakdown[state]) {
    const found = cityBreakdown[state].find(cd => cd.city === city);
    if (found?.lat && found?.lng && isFinite(found.lat) && isFinite(found.lng)) return [found.lat, found.lng];
  }

  // 3. From geoCities
  if (city && state && Array.isArray(geoCities)) {
    const geo = geoCities.find(g => g.city === city && g.state === state);
    if (geo?.lat && geo?.lng) return [geo.lat, geo.lng];
  }

  // 4. Static lookup
  if (city && state) {
    const coords = getCityCoords(city, state);
    if (coords) return coords;
  }

  // 5. Fallback: state center
  if (state && STATE_CENTERS[state]) return STATE_CENTERS[state];

  return null;
}

/* ── Persona pin HTML (colored by sentiment) ─────────────────────────────── */

function personaPinHtml(color: string, size: number): string {
  return `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
    <div style="width:${size - 2}px;height:${size - 2}px;border-radius:50%;background:${color};
      border:1.5px solid rgba(255,255,255,0.3);
      box-shadow:0 0 8px ${color}aa,0 0 4px ${color};
      transition:transform 0.15s;"></div>
  </div>`;
}

/* ── City label marker (different visual from persona pins) ───────────────── */

function cityLabelHtml(cityName: string, count: number): string {
  return `<div style="display:flex;align-items:center;gap:4px;padding:2px 8px;
    background:rgba(255,255,255,0.08);backdrop-filter:blur(8px);
    border:1px solid rgba(255,255,255,0.15);border-radius:12px;
    cursor:pointer;white-space:nowrap;">
    <div style="width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.5);"></div>
    <span style="font-family:monospace;font-size:9px;color:rgba(255,255,255,0.7);
      letter-spacing:0.08em;text-transform:uppercase;">${cityName}</span>
    <span style="font-family:monospace;font-size:8px;color:rgba(255,255,255,0.4);">${count}</span>
  </div>`;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function LeafletMap({
  stateBreakdown,
  cityBreakdown,
  geoCities,
  liveComments,
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
  const personaPinsRef = useRef<L.LayerGroup | null>(null);
  const cityLabelsRef = useRef<L.LayerGroup | null>(null);
  const rafRef = useRef<number>(0);

  // Keep refs in sync for event handlers
  const stateBreakdownRef = useRef(stateBreakdown);
  const globalAvgScoreRef = useRef(globalAvgScore);
  const selectedStateRef = useRef(selectedState);
  const selectedCityRef = useRef(selectedCity);
  stateBreakdownRef.current = stateBreakdown;
  globalAvgScoreRef.current = globalAvgScore;
  selectedStateRef.current = selectedState;
  selectedCityRef.current = selectedCity;

  /* ── Canvas draw (static grid) ───────────────────────────────────────── */
  const drawOnce = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.015)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 90) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 90) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }, []);

  const scheduleRedraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawOnce);
  }, [drawOnce]);

  /* ── Recolor GeoJSON state based on current data ─────────────────────── */
  const recolorState = useCallback((layer: any, sigla: string, isSelected: boolean) => {
    const sd = stateBreakdownRef.current[sigla];
    const color = sd?.avgScore != null
      ? scoreToMapColor(sd.avgScore, globalAvgScoreRef.current)
      : '#27272a';
    layer.setStyle({
      fillColor: color,
      fillOpacity: isSelected ? 0.85 : 0.6,
      color: isSelected ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)',
      weight: isSelected ? 2 : 1,
    });
  }, []);

  /* ── Map initialization ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined' || !mapDivRef.current || mapRef.current) return;

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
      preferCanvas: true,
    });
    mapRef.current = map;

    const basePane = map.createPane('basePane');
    basePane.style.zIndex = '200';
    basePane.style.filter = 'brightness(0.72) saturate(0.5) contrast(1.06)';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19, keepBuffer: 4, pane: 'basePane',
    }).addTo(map);

    const labelPane = map.createPane('labelPane');
    labelPane.style.zIndex = '260';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19, keepBuffer: 4, pane: 'labelPane',
    }).addTo(map);

    personaPinsRef.current = L.layerGroup().addTo(map);
    cityLabelsRef.current = L.layerGroup().addTo(map);

    setTimeout(() => map.flyTo([-14, -51], 5, { duration: 2.0, easeLinearity: 0.28 }), 350);

    // GeoJSON — state polygons
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
              const sigla = feature.properties.sigla;
              const sd = stateBreakdownRef.current[sigla];
              const color = sd?.avgScore != null
                ? scoreToMapColor(sd.avgScore, globalAvgScoreRef.current)
                : '#27272a';
              (layer as any).setStyle({
                fillColor: color,
                fillOpacity: 0.8,
                color: 'rgba(255,255,255,0.4)',
                weight: 1.5,
              });
            });
            layer.on('mouseout', () => {
              const sigla = feature.properties.sigla;
              const isSelected = selectedStateRef.current === sigla;
              recolorState(layer, sigla, isSelected);
            });
            layer.on('click', () => {
              const sigla = feature.properties.sigla;
              onSelectState(selectedStateRef.current === sigla ? null : sigla);
            });
          },
        }).addTo(map);
      })
      .catch(console.error);

    map.on('move zoom moveend zoomend resize', scheduleRedraw);
    scheduleRedraw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Recolor ALL states when data/selection changes ──────────────────── */
  useEffect(() => {
    if (!geoLayerRef.current) return;
    geoLayerRef.current.eachLayer((layer: any) => {
      const feature = layer.feature;
      if (!feature) return;
      const sigla = feature.properties.sigla;
      const isSelected = selectedState === sigla;
      recolorState(layer, sigla, isSelected);
    });
  }, [stateBreakdown, globalAvgScore, selectedState, recolorState]);

  /* ── Fly to state / city / reset ────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedCity) {
      const cities = (selectedState && Array.isArray(cityBreakdown?.[selectedState]))
        ? cityBreakdown[selectedState] : [];
      const city = cities?.find((c: CityData) => c.city === selectedCity);
      if (city?.lat && city?.lng) {
        map.flyTo([city.lat, city.lng], 12, { duration: 1.2, easeLinearity: 0.2 });
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

  /* ══════════════════════════════════════════════════════════════════════════
     PERSONA PINS (from cityBreakdown — ALL personas, jittered per city)
     + Enriched with liveComments data when available
     + CITY LABELS (white/grey pill badge — different from persona pins)
     ══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    const pinGroup = personaPinsRef.current;
    const labelGroup = cityLabelsRef.current;
    const map = mapRef.current;
    if (!pinGroup || !labelGroup || !map) return;

    // Index liveComments by city+state for quick lookup
    const commentsByCity = new Map<string, CommentResult[]>();
    if (liveComments && liveComments.length > 0) {
      for (const c of liveComments) {
        const key = `${c.city || ''}-${c.state || ''}`;
        if (!commentsByCity.has(key)) commentsByCity.set(key, []);
        commentsByCity.get(key)!.push(c);
      }
    }

    const rebuild = () => {
      try {
        pinGroup.clearLayers();
        labelGroup.clearLayers();

        const zoom = map.getZoom();
        const pinSize = zoom >= 10 ? 14 : zoom >= 8 ? 12 : zoom >= 6 ? 10 : 8;
        const spreadDeg = zoom >= 12 ? 0.002 : zoom >= 10 ? 0.005 : zoom >= 8 ? 0.015 : zoom >= 6 ? 0.03 : 0.05;

        let totalPins = 0;
        const maxPins = zoom >= 10 ? 600 : zoom >= 8 ? 300 : zoom >= 6 ? 150 : 60;

        // Collect all cities from cityBreakdown + geoCities
        const allCities: { city: string; state: string; lat: number; lng: number; count: number; avgScore: number; positive: number; negative: number; neutral: number }[] = [];
        const seen = new Set<string>();

        if (cityBreakdown && typeof cityBreakdown === 'object') {
          for (const [state, cities] of Object.entries(cityBreakdown)) {
            if (!Array.isArray(cities)) continue;
            for (const c of cities) {
              if (!c?.city) continue;
              const key = `${c.city}-${state}`;
              if (seen.has(key)) continue;
              seen.add(key);

              let lat = c.lat, lng = c.lng;
              if (!lat || !lng || !isFinite(lat) || !isFinite(lng)) {
                const geo = Array.isArray(geoCities) ? geoCities.find(g => g.city === c.city && g.state === state) : null;
                if (geo?.lat && geo?.lng) { lat = geo.lat; lng = geo.lng; }
                else {
                  const coords = getCityCoords(c.city, state);
                  if (coords) { lat = coords[0]; lng = coords[1]; }
                  else continue;
                }
              }
              allCities.push({ ...c, state, lat, lng });
            }
          }
        }

        // Also from geoCities
        if (Array.isArray(geoCities)) {
          for (const g of geoCities) {
            if (!g?.city || !g.state) continue;
            const key = `${g.city}-${g.state}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (g.lat && g.lng) {
              allCities.push({
                city: g.city, state: g.state, lat: g.lat, lng: g.lng,
                count: g.personaCount || 1, avgScore: 5, positive: 0, negative: 0, neutral: 0,
              });
            }
          }
        }

        allCities.sort((a, b) => b.count - a.count);

        // ── Create pins per city (each persona = one pin) ──
        allCities.forEach(cityData => {
          if (totalPins >= maxPins) return;
          if (!isFinite(cityData.lat) || !isFinite(cityData.lng)) return;

          const pinsForCity = Math.min(cityData.count, maxPins - totalPins);
          if (pinsForCity === 0) return;

          const cityKey = `${cityData.city}-${cityData.state}`;
          const comments = commentsByCity.get(cityKey) || [];
          const color = scoreToHex(cityData.avgScore);

          // Create individual persona pins
          for (let i = 0; i < pinsForCity; i++) {
            const [lat, lng] = jitterPosition(cityData.lat, cityData.lng, i, spreadDeg);
            if (!isFinite(lat) || !isFinite(lng)) continue;

            // Try to match a liveComment for this pin
            const comment = comments[i % Math.max(comments.length, 1)] as CommentResult | undefined;
            const hasComment = comment && i < comments.length;

            // Pin color: if we have a comment, color by sentiment; otherwise by city avgScore
            const pinColor = hasComment ? sentimentColor(comment!.sentiment) : color;

            const icon = L.divIcon({
              html: personaPinHtml(pinColor, pinSize),
              className: '',
              iconSize: [pinSize, pinSize],
              iconAnchor: [pinSize / 2, pinSize / 2],
            });

            // Tooltip content
            let tooltipHtml: string;
            if (hasComment) {
              const c = comment!;
              const sColor = sentimentColor(c.sentiment);
              tooltipHtml = `
                <div style="font-family:'Manrope',sans-serif;font-size:11px;max-width:220px;line-height:1.4;">
                  <div style="font-weight:700;color:#fff;margin-bottom:3px;">${c.personaName}</div>
                  <div style="font-size:9px;color:#a1a1aa;margin-bottom:4px;">
                    ${c.age ? c.age + ' anos' : ''}${cityData.city ? ' · ' + cityData.city : ''}${cityData.state ? ', ' + cityData.state : ''}
                  </div>
                  ${c.gender ? `<div style="font-size:9px;color:#71717a;">${c.gender}${c.politicalLeaning ? ' · ' + c.politicalLeaning : ''}</div>` : ''}
                  <div style="margin-top:4px;font-size:10px;color:${sColor};font-weight:600;">
                    ${c.sentiment === 'positive' ? 'Positivo' : c.sentiment === 'negative' ? 'Negativo' : 'Neutro'}
                    ${c.score ? ' · Score ' + (typeof c.score === 'number' ? c.score.toFixed(1) : c.score) : ''}
                  </div>
                  <div style="margin-top:4px;font-size:10px;color:#d4d4d8;font-style:italic;
                    overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">
                    "${(c.comment || '').slice(0, 120)}${(c.comment?.length || 0) > 120 ? '...' : ''}"
                  </div>
                </div>`;
            } else {
              tooltipHtml = `
                <div style="font-family:monospace;font-size:10px;letter-spacing:0.05em;">
                  <strong style="color:${color}">${cityData.city}</strong>, ${cityData.state}<br/>
                  <span style="color:#a1a1aa">Persona · Score ${cityData.avgScore.toFixed(1)}</span>
                </div>`;
            }

            L.marker([lat, lng], { icon, zIndexOffset: 100 })
              .addTo(pinGroup)
              .on('click', () => {
                if (selectedStateRef.current !== cityData.state) {
                  onSelectState(cityData.state);
                }
                setTimeout(() => onSelectCity(cityData as CityData), 80);
              })
              .bindTooltip(tooltipHtml, {
                direction: 'top',
                offset: [0, -pinSize / 2],
                className: 'persona-tooltip',
              });
          }

          totalPins += pinsForCity;

          // ── City label (white pill, only at higher zoom) ──
          if (zoom >= 6) {
            const labelIcon = L.divIcon({
              html: cityLabelHtml(cityData.city, cityData.count),
              className: '',
              iconSize: [120, 20],
              iconAnchor: [60, -8],
            });
            L.marker([cityData.lat, cityData.lng], { icon: labelIcon, zIndexOffset: 50 })
              .addTo(labelGroup);
          }
        });

        console.log(`[Map] ${totalPins} persona pins, ${allCities.length} cities`);
      } catch (err) {
        console.error('[Map] rebuild error:', err);
      }
    };

    rebuild();
    map.on('zoomend', rebuild);
    return () => { map.off('zoomend', rebuild); };
  }, [liveComments, cityBreakdown, geoCities, selectedState, onSelectState, onSelectCity]);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 450,
      }} />

      {/* Vignettes */}
      {[
        { top: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to bottom,rgba(0,0,0,.80) 0%,transparent 100%)' },
        { bottom: 0, left: 0, right: 0, height: '110px', background: 'linear-gradient(to top,rgba(0,0,0,.88) 0%,transparent 100%)' },
        { top: 0, left: 0, bottom: 0, width: '60px', background: 'linear-gradient(to right,rgba(0,0,0,.4) 0%,transparent 100%)' },
        { top: 0, right: 0, bottom: 0, width: '60px', background: 'linear-gradient(to left,rgba(0,0,0,.4) 0%,transparent 100%)' },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', pointerEvents: 'none', zIndex: 460, ...s as any }} />
      ))}

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .persona-tooltip {
          background: rgba(9,9,11,0.95) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.7) !important;
          max-width: 240px !important;
        }
        .persona-tooltip::before {
          border-top-color: rgba(9,9,11,0.95) !important;
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
