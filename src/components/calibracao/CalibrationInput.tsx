'use client';

import { useState, useEffect } from 'react';
import { Send, MapPin, Loader2 } from 'lucide-react';
import { useCalibrationStore, calibrationSubmit } from '@/app/calibracao/store';

interface CityOption {
  city: string;
  count: number;
}

const STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export default function CalibrationInput() {
  const { isProcessing } = useCalibrationStore();
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    if (!state) {
      setCities([]);
      setCity('');
      return;
    }
    setLoadingCities(true);
    setCity('');
    fetch(`/api/arena/cities?state=${state}`)
      .then((r) => r.json())
      .then((data) => setCities(data || []))
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [state]);

  function handleSubmit() {
    if (!query.trim() || isProcessing) return;
    const geoFilter = state ? { state, city: city || undefined } : undefined;
    calibrationSubmit(query.trim(), geoFilter);
  }

  return (
    <div className="p-5 border-b border-white/[0.06]">
      {/* Geo filter row */}
      <div className="flex items-center gap-3 mb-3">
        <MapPin size={14} className="text-zinc-500 shrink-0" />
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          disabled={isProcessing}
          className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 disabled:opacity-50"
        >
          <option value="">Todo o Brasil</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {state && (
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={isProcessing || loadingCities}
            className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 disabled:opacity-50"
          >
            <option value="">Todas as cidades</option>
            {cities.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city} ({c.count})
              </option>
            ))}
          </select>
        )}

        {loadingCities && <Loader2 size={14} className="text-zinc-500 animate-spin" />}
      </div>

      {/* Query input */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Ex: Qual a opiniao do pessoal de SP sobre o Flamengo?"
          disabled={isProcessing}
          className="flex-1 px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={isProcessing || !query.trim()}
          className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          Analisar
        </button>
      </div>
    </div>
  );
}
