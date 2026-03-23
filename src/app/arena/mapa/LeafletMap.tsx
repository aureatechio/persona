// Arena PWA — Leaflet Map Component (client-only, no SSR)

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { scoreToHex } from '../constants';

// State center coordinates for markers
const STATE_CENTERS: Record<string, [number, number]> = {
  AC: [-8.77, -70.55], AL: [-9.57, -36.78], AM: [-3.47, -65.10], AP: [1.41, -51.77],
  BA: [-12.97, -41.68], CE: [-5.20, -39.53], DF: [-15.83, -47.86], ES: [-19.19, -40.34],
  GO: [-15.98, -49.86], MA: [-5.42, -45.44], MG: [-18.10, -44.38], MS: [-20.51, -54.54],
  MT: [-12.64, -55.42], PA: [-3.79, -52.48], PB: [-7.28, -36.72], PE: [-8.38, -37.86],
  PI: [-7.72, -42.73], PR: [-24.89, -51.55], RJ: [-22.25, -42.66], RN: [-5.81, -36.59],
  RO: [-10.83, -63.34], RR: [1.99, -61.33], RS: [-29.75, -53.25], SC: [-27.45, -50.95],
  SE: [-10.57, -37.45], SP: [-22.19, -48.79], TO: [-10.25, -48.25],
};

interface LeafletMapProps {
  stateBreakdown: Record<string, { count: number; positive: number; negative: number; neutral: number; avgScore?: number }>;
  onStatePress: (sigla: string) => void;
}

export default function LeafletMap({ stateBreakdown, onStatePress }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [-14.24, -51.93],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark CartoDB basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when stateBreakdown changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    // Add state markers
    Object.entries(stateBreakdown).forEach(([sigla, data]) => {
      const center = STATE_CENTERS[sigla];
      if (!center) return;

      const total = data.count;
      const score = data.avgScore ?? (total > 0
        ? Math.round(((data.positive * 9 + data.neutral * 5 + data.negative * 1) / total) * 10) / 10
        : 5.0);
      const hex = scoreToHex(score);
      const radius = Math.max(8, Math.min(25, Math.sqrt(total) * 0.8));

      const marker = L.circleMarker(center, {
        radius,
        fillColor: hex,
        fillOpacity: 0.6,
        color: hex,
        weight: 2,
        opacity: 0.8,
      }).addTo(map);

      marker.bindTooltip(`${sigla}: ${score.toFixed(1)} (${total})`, {
        className: 'arena-tooltip',
        direction: 'top',
      });

      marker.on('click', () => onStatePress(sigla));
    });
  }, [stateBreakdown, onStatePress]);

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
