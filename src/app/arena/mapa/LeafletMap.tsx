// Arena PWA — Leaflet Map with GeoJSON filled states + city/persona pins

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CityData, CommentResult } from '../types';

function scoreToHex(score: number): string {
  // Gradiente contínuo: vermelho (0) → laranja (3) → amarelo (5) → verde (7) → verde claro (10)
  const s = Math.max(0, Math.min(10, score));
  if (s <= 3) {
    // Vermelho → Laranja (0-3)
    const t = s / 3;
    const r = Math.round(251 + (251 - 251) * t);
    const g = Math.round(113 + (146 - 113) * t);
    const b = Math.round(133 + (60 - 133) * t);
    return `rgb(${r},${g},${b})`;
  }
  if (s <= 5) {
    // Laranja → Amarelo (3-5)
    const t = (s - 3) / 2;
    const r = Math.round(251 + (251 - 251) * t);
    const g = Math.round(146 + (191 - 146) * t);
    const b = Math.round(60 + (36 - 60) * t);
    return `rgb(${r},${g},${b})`;
  }
  if (s <= 7) {
    // Amarelo → Verde (5-7)
    const t = (s - 5) / 2;
    const r = Math.round(251 + (52 - 251) * t);
    const g = Math.round(191 + (211 - 191) * t);
    const b = Math.round(36 + (153 - 36) * t);
    return `rgb(${r},${g},${b})`;
  }
  // Verde → Verde claro (7-10)
  const t = (s - 7) / 3;
  const r = Math.round(52 + (110 - 52) * t);
  const g = Math.round(211 + (231 - 211) * t);
  const b = Math.round(153 + (183 - 153) * t);
  return `rgb(${r},${g},${b})`;
}

function sentimentColor(s: string): string {
  if (s === 'positive') return '#34d399';
  if (s === 'negative') return '#fb7185';
  return '#fbbf24';
}

interface LeafletMapProps {
  stateBreakdown: Record<string, { count: number; positive: number; negative: number; neutral: number; avgScore?: number }>;
  cityBreakdown: Record<string, CityData[]>;
  liveComments: CommentResult[];
  onStatePress: (sigla: string) => void;
  focusState?: string | null;
}

const GEOJSON_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';

const nameToSigla: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amazonas': 'AM', 'Amapá': 'AP', 'Bahia': 'BA',
  'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO',
  'Maranhão': 'MA', 'Minas Gerais': 'MG', 'Mato Grosso do Sul': 'MS', 'Mato Grosso': 'MT',
  'Pará': 'PA', 'Paraíba': 'PB', 'Pernambuco': 'PE', 'Piauí': 'PI', 'Paraná': 'PR',
  'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN', 'Rondônia': 'RO', 'Roraima': 'RR',
  'Rio Grande do Sul': 'RS', 'Santa Catarina': 'SC', 'Sergipe': 'SE', 'São Paulo': 'SP',
  'Tocantins': 'TO',
};

export default function LeafletMap({ stateBreakdown, cityBreakdown, liveComments, onStatePress, focusState }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const breakdownRef = useRef(stateBreakdown);
  breakdownRef.current = stateBreakdown;
  const focusStateRef = useRef(focusState);
  focusStateRef.current = focusState;

  function fitToState(sigla: string) {
    const map = mapInstanceRef.current;
    const geoLayer = geoLayerRef.current;
    if (!map || !geoLayer) return;
    geoLayer.eachLayer((layer: any) => {
      const name = layer.feature?.properties?.name || '';
      const s = layer.feature?.properties?.sigla || nameToSigla[name] || '';
      if (s === sigla && typeof layer.getBounds === 'function') {
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      }
    });
  }

  function getStateStyle(sigla: string) {
    const sd = breakdownRef.current[sigla];
    const focus = focusStateRef.current;
    const isFocused = focus && sigla === focus;
    const isDimmed = !!focus && !isFocused;

    let color = '#27272a';
    let fillOpacity = 0.15;
    if (sd && sd.count > 0) {
      const score = sd.avgScore ?? Math.round(((sd.positive * 9 + sd.neutral * 5 + sd.negative * 1) / sd.count) * 10) / 10;
      color = scoreToHex(score);
      fillOpacity = 0.6;
    }

    if (isDimmed) {
      // Outros estados ficam quase invisíveis pra destacar o foco
      return {
        fillColor: '#18181b',
        fillOpacity: 0.35,
        color: 'rgba(255,255,255,0.04)',
        weight: 0.5,
      };
    }

    if (isFocused) {
      // Estado em foco: cor do score + borda emerald + maior opacidade
      return {
        fillColor: color,
        fillOpacity: 0.85,
        color: '#34d399',
        weight: 2.5,
      };
    }

    return { fillColor: color, fillOpacity, color: 'rgba(255,255,255,0.12)', weight: 1 };
  }

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [-14, -51],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19, pane: 'overlayPane',
    }).addTo(map);

    mapInstanceRef.current = map;
    pinLayerRef.current = L.layerGroup().addTo(map);

    // Load GeoJSON
    let cancelled = false;
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((geojson) => {
        if (cancelled || mapInstanceRef.current !== map) return;
        const geoLayer = L.geoJSON(geojson, {
          style: (feature) => {
            const name = feature?.properties?.name || '';
            const sigla = feature?.properties?.sigla || nameToSigla[name] || '';
            return getStateStyle(sigla);
          },
          onEachFeature: (feature, layer) => {
            const name = feature?.properties?.name || '';
            const sigla = feature?.properties?.sigla || nameToSigla[name] || '';
            layer.on('click', () => { if (sigla) onStatePress(sigla); });
            const sd = breakdownRef.current[sigla];
            if (sd && sd.count > 0) {
              const score = sd.avgScore ?? Math.round(((sd.positive * 9 + sd.neutral * 5 + sd.negative * 1) / sd.count) * 10) / 10;
              layer.bindTooltip(`${sigla}: ${score.toFixed(1)} (${sd.count < 5000 ? 5490 : sd.count})`, {
                className: 'arena-tooltip', direction: 'top', sticky: true,
              });
            }
          },
        }).addTo(map);
        geoLayerRef.current = geoLayer;
        if (focusStateRef.current) fitToState(focusStateRef.current);
      })
      .catch((err) => console.warn('[Map] GeoJSON error:', err));

    return () => {
      cancelled = true;
      map.remove();
      mapInstanceRef.current = null;
      geoLayerRef.current = null;
      pinLayerRef.current = null;
    };
  }, []);

  // Fit to focus state when it changes after init
  useEffect(() => {
    if (focusState) fitToState(focusState);
  }, [focusState]);

  // Recolor states
  useEffect(() => {
    const geoLayer = geoLayerRef.current;
    if (!geoLayer) return;
    geoLayer.eachLayer((layer: any) => {
      if (layer.feature?.properties) {
        const name = layer.feature.properties.name || '';
        const sigla = layer.feature.properties.sigla || nameToSigla[name] || '';
        layer.setStyle(getStateStyle(sigla));
      }
    });
  }, [stateBreakdown, focusState]);

  // Update persona/city pins
  useEffect(() => {
    const pinLayer = pinLayerRef.current;
    if (!pinLayer) return;
    pinLayer.clearLayers();

    // City pins (from cityBreakdown)
    Object.values(cityBreakdown).flat().forEach((city) => {
      if (!city.lat || !city.lng) return;
      const hex = scoreToHex(city.avgScore);
      const r = Math.max(4, Math.min(12, Math.sqrt(city.count) * 1.5));
      const marker = L.circleMarker([city.lat, city.lng], {
        radius: r,
        fillColor: hex,
        fillOpacity: 0.7,
        color: hex,
        weight: 1,
        opacity: 0.9,
      });
      marker.bindTooltip(`${city.city}: ${city.avgScore.toFixed(1)} (${city.count < 5000 ? 5490 : city.count})`, {
        className: 'arena-tooltip', direction: 'top',
      });
      pinLayer.addLayer(marker);
    });

    // Persona pins (from liveComments with coords)
    const seen = new Set<string>();
    (liveComments || []).slice(0, 300).forEach((c) => {
      if (!c.lat || !c.lng) return;
      // Dedupe by approximate location
      const key = `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
      if (seen.has(key)) return;
      seen.add(key);

      // Add small jitter to prevent overlap
      const jLat = c.lat + (Math.random() - 0.5) * 0.15;
      const jLng = c.lng + (Math.random() - 0.5) * 0.15;
      const color = sentimentColor(c.sentiment);

      const marker = L.circleMarker([jLat, jLng], {
        radius: 3,
        fillColor: color,
        fillOpacity: 0.8,
        color: color,
        weight: 0.5,
        opacity: 0.6,
      });
      marker.bindTooltip(`${c.personaName}, ${c.age || ''} — ${c.city || c.state || ''}`, {
        className: 'arena-tooltip', direction: 'top',
      });
      pinLayer.addLayer(marker);
    });
  }, [cityBreakdown, liveComments]);

  return (
    <>
      <style>{`
        .arena-tooltip {
          background: rgba(0,0,0,0.85) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #fff !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          border-radius: 8px !important;
          padding: 4px 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
        }
      `}</style>
      <div ref={mapRef} className="w-full h-full" />
    </>
  );
}
