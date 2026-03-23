// Arena PWA — Leaflet Map with GeoJSON filled states (matches mobile LeafletWebView)

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function scoreToHex(score: number): string {
  if (score <= 2) return '#fb7185';
  if (score <= 4) return '#fb923c';
  if (score <= 6) return '#fbbf24';
  if (score <= 8) return '#34d399';
  return '#6ee7b7';
}

interface LeafletMapProps {
  stateBreakdown: Record<string, { count: number; positive: number; negative: number; neutral: number; avgScore?: number }>;
  onStatePress: (sigla: string) => void;
}

// GeoJSON URL for Brazil states
const GEOJSON_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';

export default function LeafletMap({ stateBreakdown, onStatePress }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const breakdownRef = useRef(stateBreakdown);
  breakdownRef.current = stateBreakdown;

  // State name to sigla mapping
  const nameToSigla: Record<string, string> = {
    'Acre': 'AC', 'Alagoas': 'AL', 'Amazonas': 'AM', 'Amapá': 'AP', 'Bahia': 'BA',
    'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO',
    'Maranhão': 'MA', 'Minas Gerais': 'MG', 'Mato Grosso do Sul': 'MS', 'Mato Grosso': 'MT',
    'Pará': 'PA', 'Paraíba': 'PB', 'Pernambuco': 'PE', 'Piauí': 'PI', 'Paraná': 'PR',
    'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN', 'Rondônia': 'RO', 'Roraima': 'RR',
    'Rio Grande do Sul': 'RS', 'Santa Catarina': 'SC', 'Sergipe': 'SE', 'São Paulo': 'SP',
    'Tocantins': 'TO',
  };

  function getStateStyle(sigla: string) {
    const sd = breakdownRef.current[sigla];
    let color = '#27272a';
    let fillOpacity = 0.15;

    if (sd && sd.count > 0) {
      const score = sd.avgScore ?? Math.round(((sd.positive * 9 + sd.neutral * 5 + sd.negative * 1) / sd.count) * 10) / 10;
      color = scoreToHex(score);
      fillOpacity = 0.6;
    }

    return {
      fillColor: color,
      fillOpacity,
      color: 'rgba(255,255,255,0.12)',
      weight: 1,
    };
  }

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
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      pane: 'overlayPane',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Load GeoJSON
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((geojson) => {
        const geoLayer = L.geoJSON(geojson, {
          style: (feature) => {
            const name = feature?.properties?.name || '';
            const sigla = feature?.properties?.sigla || nameToSigla[name] || '';
            return getStateStyle(sigla);
          },
          onEachFeature: (feature, layer) => {
            const name = feature?.properties?.name || '';
            const sigla = feature?.properties?.sigla || nameToSigla[name] || '';

            layer.on('click', () => {
              if (sigla) onStatePress(sigla);
            });

            const sd = breakdownRef.current[sigla];
            if (sd && sd.count > 0) {
              const score = sd.avgScore ?? Math.round(((sd.positive * 9 + sd.neutral * 5 + sd.negative * 1) / sd.count) * 10) / 10;
              layer.bindTooltip(`${sigla}: ${score.toFixed(1)} (${sd.count})`, {
                className: 'arena-tooltip',
                direction: 'top',
                sticky: true,
              });
            }
          },
        }).addTo(map);

        geoLayerRef.current = geoLayer;
      })
      .catch((err) => console.warn('[Map] GeoJSON load error:', err));

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      geoLayerRef.current = null;
    };
  }, []);

  // Recolor states when stateBreakdown changes
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
  }, [stateBreakdown]);

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
        .arena-tooltip::before {
          border-top-color: rgba(0,0,0,0.85) !important;
        }
      `}</style>
      <div ref={mapRef} className="w-full h-full" />
    </>
  );
}
