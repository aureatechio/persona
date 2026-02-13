'use client';

import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

interface PersonaMapProps {
  personas: any[];
}

export default function PersonaMap({ personas }: PersonaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<any>(null);

  // Filtra apenas personas com coordenadas válidas (memoizado)
  const validPersonas = useMemo(
    () => personas.filter(p => p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng)),
    [personas]
  );

  // Inicializar mapa uma vez
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Fix Leaflet default icons
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });

    if (mapRef.current) return; // já inicializado

    const brasilBounds = L.latLngBounds(
      L.latLng(-33.75, -73.99),
      L.latLng(5.27, -32.39)
    );

    mapRef.current = L.map(mapContainerRef.current, {
      center: [-14.235, -51.9253],
      zoom: 4,
      minZoom: 4,
      maxZoom: 18,
      maxBounds: brasilBounds,
      maxBoundsViscosity: 1.0,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18,
    }).addTo(mapRef.current);

    mapRef.current.fitBounds(brasilBounds, { padding: [20, 20] });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Atualizar markers quando personas mudam
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove cluster anterior
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }

    if (validPersonas.length === 0) return;

    // @ts-ignore
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,       // carrega em chunks para não travar
      chunkInterval: 100,         // ms entre chunks
      chunkDelay: 10,             // delay entre processamento
      maxClusterRadius: 50,       // agrupa markers próximos
      disableClusteringAtZoom: 14,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    // Criar todos os markers de uma vez (o chunkedLoading cuida do batching)
    const markers = validPersonas.map(persona => {
      const marker = L.marker([persona.lat, persona.lng]);

      marker.bindPopup(`
        <div class="p-4 min-w-[180px] bg-zinc-900 text-white">
          <h4 class="font-bold text-lg mb-1">${persona.name || 'Persona'}</h4>
          <p class="text-xs text-zinc-400 mb-4">${persona.age || '?'} anos • ${persona.city || ''}, ${persona.state || ''}</p>
          <a href="/chat/${persona.id}" class="block w-full text-center bg-white text-black text-xs font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5">
            Iniciar Chat
          </a>
        </div>
      `, { className: 'custom-leaflet-popup' });

      return marker;
    });

    cluster.addLayers(markers); // batch add (mais rápido que addLayer individual)
    map.addLayer(cluster);
    clusterRef.current = cluster;
  }, [validPersonas]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden border border-zinc-800/50 shadow-2xl shadow-black/20">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Counter overlay */}
      {validPersonas.length > 0 && (
        <div className="absolute top-4 right-4 z-[1000] px-3 py-1.5 rounded-xl bg-zinc-950/80 backdrop-blur-sm border border-zinc-800/50">
          <span className="text-[10px] font-bold text-zinc-400 tabular-nums">
            {validPersonas.length.toLocaleString('pt-BR')} no mapa
          </span>
        </div>
      )}

      <style jsx global>{`
        .leaflet-popup-content-wrapper {
          background: #18181b !important;
          color: white !important;
          border: 1px solid #27272a !important;
          border-radius: 24px !important;
          padding: 0 !important;
          overflow: hidden !important;
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
        .marker-cluster-small,
        .marker-cluster-medium,
        .marker-cluster-large {
          background-color: rgba(16, 185, 129, 0.15) !important;
        }
        .marker-cluster-small div,
        .marker-cluster-medium div,
        .marker-cluster-large div {
          background-color: rgba(16, 185, 129, 0.6) !important;
          color: white !important;
          font-weight: 700 !important;
          font-size: 12px !important;
        }
      `}</style>
    </div>
  );
}
