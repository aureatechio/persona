'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import Link from 'next/link';

interface PersonaMapProps {
  personas: any[];
}

export default function PersonaMap({ personas }: PersonaMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Fix for default marker icons in Leaflet with Next.js
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });

    if (!mapRef.current) {
      // Limites geográficos do Brasil
      const brasilBounds = L.latLngBounds(
        L.latLng(-33.75, -73.99), // Sudoeste (extremo sul e oeste)
        L.latLng(5.27, -32.39)   // Nordeste (extremo norte e leste)
      );

      mapRef.current = L.map('map-container', {
        center: [-14.235, -51.9253], // Centro do Brasil
        zoom: 4,
        minZoom: 4,
        maxZoom: 18,
        maxBounds: brasilBounds,
        maxBoundsViscosity: 1.0 // Impede completamente de sair dos limites
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 18,
        bounds: brasilBounds
      }).addTo(mapRef.current);

      // Ajustar a visualização para os limites do Brasil
      mapRef.current.fitBounds(brasilBounds, { padding: [20, 20] });
    }

    if (clusterRef.current) {
      mapRef.current.removeLayer(clusterRef.current);
    }

    // @ts-ignore
    clusterRef.current = L.markerClusterGroup();

    personas.forEach(persona => {
      if (persona.lat && persona.lng) {
        const marker = L.marker([persona.lat, persona.lng]);
        
        const popupContent = `
          <div class="p-2 min-w-[150px] bg-zinc-900 text-white rounded-lg">
            <h4 class="font-bold text-base mb-1">${persona.name}</h4>
            <p class="text-xs text-zinc-400 mb-3">${persona.age} anos • ${persona.city}, ${persona.state}</p>
            <a href="/chat/${persona.id}" class="block w-full text-center bg-white text-black text-xs font-bold py-2 rounded hover:bg-zinc-200 transition-colors">
              Iniciar Chat
            </a>
          </div>
        `;

        marker.bindPopup(popupContent, {
          className: 'custom-leaflet-popup'
        });
        
        clusterRef.current.addLayer(marker);
      }
    });

    mapRef.current.addLayer(clusterRef.current);

    return () => {
      // Cleanup is handled by Next.js component lifecycle if needed
    };
  }, [personas]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-zinc-800">
      <div id="map-container" className="w-full h-full z-0" />
      <style jsx global>{`
        .leaflet-popup-content-wrapper {
          background: #18181b !important;
          color: white !important;
          border: 1px solid #27272a !important;
          border-radius: 12px !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
        }
        .leaflet-popup-tip {
          background: #18181b !important;
          border: 1px solid #27272a !important;
        }
        .leaflet-container {
          background: #09090b !important;
        }
      `}</style>
    </div>
  );
}
