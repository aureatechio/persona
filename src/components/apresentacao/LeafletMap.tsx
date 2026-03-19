'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CityData, GeoCity } from '@/lib/arena/types';
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

/* ── Jitter helpers: spread persona pins around city center ──────────────── */

/** Deterministic pseudo-random based on index (so markers are stable across renders) */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

/** Generate jittered positions for N personas around a center lat/lng */
function jitterPositions(lat: number, lng: number, count: number, spreadDeg: number): [number, number][] {
  if (count <= 1) return [[lat, lng]];
  const positions: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + seededRandom(i * 7 + 3) * 0.5;
    const radius = spreadDeg * (0.3 + seededRandom(i * 13 + 1) * 0.7);
    positions.push([
      lat + Math.cos(angle) * radius,
      lng + Math.sin(angle) * radius,
    ]);
  }
  return positions;
}

/* ── Merge cityBreakdown + geoCities to get best available data ──────────── */

interface MergedCity {
  city: string;
  state: string;
  lat: number;
  lng: number;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  avgScore: number;
}

function mergeCityData(
  cityBreakdown: Record<string, CityData[]> | null | undefined,
  geoCities: GeoCity[] | null | undefined,
): MergedCity[] {
  const result: MergedCity[] = [];
  const seen = new Set<string>();

  try {
    // First: use cityBreakdown (has sentiment data)
    if (cityBreakdown && typeof cityBreakdown === 'object') {
      for (const [state, cities] of Object.entries(cityBreakdown)) {
        if (!Array.isArray(cities)) continue;
        for (const c of cities) {
          if (!c || !c.city) continue;
          const key = `${c.city}-${state}`;
          if (seen.has(key)) continue;
          seen.add(key);

          if (c.lat && c.lng && isFinite(c.lat) && isFinite(c.lng)) {
            result.push({ ...c, state });
            continue;
          }

          // Fallback 1: find coords from geoCities
          const geo = Array.isArray(geoCities) ? geoCities.find(g => g.city === c.city && g.state === state) : null;
          if (geo?.lat && geo?.lng) {
            result.push({ ...c, state, lat: geo.lat, lng: geo.lng });
            continue;
          }

          // Fallback 2: lookup from city coordinates table
          const coords = getCityCoords(c.city, state);
          if (coords) {
            result.push({ ...c, state, lat: coords[0], lng: coords[1] });
          }
        }
      }
    }

    // Also add geoCities that weren't in cityBreakdown
    if (Array.isArray(geoCities)) {
      for (const g of geoCities) {
        if (!g || !g.city || !g.state) continue;
        const key = `${g.city}-${g.state}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (g.lat && g.lng) {
          result.push({
            city: g.city,
            state: g.state,
            lat: g.lat,
            lng: g.lng,
            count: g.personaCount || 1,
            positive: 0,
            negative: 0,
            neutral: 0,
            avgScore: 5,
          });
        }
      }
    }
  } catch (err) {
    console.error('[Map] mergeCityData error:', err);
  }

  result.sort((a, b) => b.count - a.count);
  return result;
}

/* ── Pulse-ring marker HTML ──────────────────────────────────────────────── */

function cityMarkerHtml(color: string, sz: number, isSelected: boolean): string {
  return `<div style="position:relative;width:${sz * 3}px;height:${sz * 3}px;
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
}

/** Small individual persona pin */
function personaPinHtml(color: string): string {
  return `<div style="width:10px;height:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
    <div style="width:6px;height:6px;border-radius:50%;background:${color};
      box-shadow:0 0 6px ${color}aa,0 0 3px ${color};"></div>
  </div>`;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function LeafletMap({
  stateBreakdown,
  cityBreakdown,
  geoCities,
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
  const markersRef = useRef<L.LayerGroup | null>(null);
  const personaPinsRef = useRef<L.LayerGroup | null>(null);
  const rafRef = useRef<number>(0);
  const mapReadyRef = useRef(false);

  // Keep refs in sync
  const selectedStateRef = useRef(selectedState);
  const selectedCityRef = useRef(selectedCity);
  selectedStateRef.current = selectedState;
  selectedCityRef.current = selectedCity;

  /* ── Canvas draw (static grid, called once per map event) ────────────── */
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

    // Base tiles
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

    // Layer groups
    markersRef.current = L.layerGroup().addTo(map);
    personaPinsRef.current = L.layerGroup().addTo(map);

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
    map.on('move zoom moveend zoomend resize', scheduleRedraw);
    scheduleRedraw();

    mapReadyRef.current = true;

    return () => {
      cancelAnimationFrame(rafRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Helper: Update a GeoJSON layer style ───────────────────────────────── */
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

  /* ── Update GeoJSON colors ──────────────────────────────────────────────── */
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
      const cities = (selectedState && Array.isArray(cityBreakdown?.[selectedState])) ? cityBreakdown[selectedState] : [];
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
     CITY MARKERS + INDIVIDUAL PERSONA PINS
     - City markers: pulse-ring markers at city centers (always visible)
     - Persona pins: individual small dots jittered around city (zoom >= 7)
     ══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    const markerGroup = markersRef.current;
    const pinGroup = personaPinsRef.current;
    const map = mapRef.current;
    if (!markerGroup || !pinGroup || !map) return;

    const rebuild = () => {
      try {
      markerGroup.clearLayers();
      pinGroup.clearLayers();

      const allCities = mergeCityData(cityBreakdown, geoCities);
      if (allCities.length === 0) return;

      const zoom = map.getZoom();
      const maxCount = Math.max(...allCities.map(c => c.count), 1);

      // Debug: log what we have
      console.log(`[Map] Rebuilding markers: ${allCities.length} cities, zoom=${zoom}, selectedState=${selectedState}`);

      // Filter cities based on selected state (if any)
      const citiesToShow = selectedState
        ? allCities.filter(c => c.state === selectedState)
        : allCities;

      // Progressive limit for unselected view
      const limit = selectedState
        ? 100 // show all cities in selected state
        : (zoom >= 10 ? 300 : zoom >= 8 ? 150 : zoom >= 7 ? 80 : zoom >= 6 ? 50 : zoom >= 5 ? 30 : 15);

      const visible = citiesToShow.slice(0, limit);

      // ── City-center markers (always visible) ──
      visible.forEach(city => {
        if (!city.lat || !city.lng || !isFinite(city.lat) || !isFinite(city.lng)) return;
        const color = scoreToHex(city.avgScore ?? 5);
        const baseSz = zoom >= 8 ? 14 : zoom >= 6 ? 11 : 9;
        const sz = Math.max(7, Math.min(baseSz, (city.count / maxCount) * baseSz));
        const isSelected = selectedCity === city.city;

        const icon = L.divIcon({
          html: cityMarkerHtml(color, isSelected ? sz * 1.3 : sz, isSelected),
          className: '',
          iconSize: [sz * 3, sz * 3],
          iconAnchor: [(sz * 3) / 2, (sz * 3) / 2],
        });

        L.marker([city.lat, city.lng], { icon, zIndexOffset: isSelected ? 1000 : city.count })
          .addTo(markerGroup)
          .on('click', () => {
            if (!selectedState) {
              onSelectState(city.state);
              setTimeout(() => onSelectCity(city as CityData), 50);
            } else {
              onSelectCity(selectedCityRef.current === city.city ? null : city as CityData);
            }
          })
          .bindTooltip(
            `<div style="font-family:monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">
              <strong style="color:${color}">${city.city}</strong><br/>
              <span style="color:#a1a1aa">${city.count} persona${city.count > 1 ? 's' : ''} · ${city.avgScore.toFixed(1)}</span>
            </div>`,
            { direction: 'top', offset: [0, -sz], className: 'city-tooltip' }
          );
      });

      // ── Individual persona pins (at higher zoom) ──
      if (zoom >= 7) {
        // Spread radius decreases with zoom (closer = tighter cluster)
        const spreadDeg = zoom >= 12 ? 0.003 : zoom >= 10 ? 0.008 : zoom >= 8 ? 0.02 : 0.04;
        // Limit total pins for performance
        let totalPins = 0;
        const maxPins = zoom >= 10 ? 500 : zoom >= 8 ? 300 : 150;

        visible.forEach(city => {
          if (totalPins >= maxPins) return;
          if (!city.lat || !city.lng || !isFinite(city.lat) || !isFinite(city.lng)) return;
          const pinsForCity = Math.min(city.count, maxPins - totalPins, 50);
          if (pinsForCity <= 1) return;

          const color = scoreToHex(city.avgScore);
          const positions = jitterPositions(city.lat, city.lng, pinsForCity, spreadDeg);

          positions.forEach(([lat, lng]) => {
            if (!isFinite(lat) || !isFinite(lng)) return;
            const icon = L.divIcon({
              html: personaPinHtml(color),
              className: '',
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            });

            L.marker([lat, lng], { icon, zIndexOffset: 0 })
              .addTo(pinGroup)
              .on('click', () => {
                if (!selectedState) {
                  onSelectState(city.state);
                  setTimeout(() => onSelectCity(city as CityData), 50);
                } else {
                  onSelectCity(city as CityData);
                }
              })
              .bindTooltip(
                `<div style="font-family:monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">
                  <strong style="color:${color}">${city.city}</strong><br/>
                  <span style="color:#a1a1aa">Persona analisada · Score ${city.avgScore.toFixed(1)}</span>
                </div>`,
                { direction: 'top', offset: [0, -5], className: 'city-tooltip' }
              );
          });

          totalPins += pinsForCity;
        });

        console.log(`[Map] Created ${totalPins} persona pins`);
      }
      } catch (err) {
        console.error('[Map] rebuild error:', err);
      }
    };

    // Run immediately
    rebuild();

    // Re-run on zoom changes
    map.on('zoomend', rebuild);

    return () => {
      map.off('zoomend', rebuild);
    };
  }, [cityBreakdown, geoCities, selectedState, selectedCity, onSelectState, onSelectCity]);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Canvas overlay for grid effect */}
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
        .leaflet-fade-anim .leaflet-popup { transition: opacity 0.3s ease-out; }
      `}</style>
    </div>
  );
}
