// Arena PWA — Map Screen (Leaflet + state/city drill-down)

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Users, ChevronLeft, Globe } from 'lucide-react';

import { useArenaStore } from '../store';
import { useAuthStore } from '../authStore';
import { STATE_NAMES, scoreToHex, scoreToEmoji, scoreToLabel, displayPersonaCount } from '../constants';
import type { CityData } from '../types';

import { ArenaNav } from '../components/ArenaNav';
import { SentimentBars } from '../components/SentimentBars';

// Dynamic import Leaflet (no SSR)
const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false });

// ── Score Gauge ──

function ScoreGauge({ score }: { score: number }) {
  const hex = scoreToHex(score);
  const emoji = scoreToEmoji(score);
  const label = scoreToLabel(score);
  const barPos = (score / 10) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2.5">
        <span className="text-[28px]">{emoji}</span>
        <span className="text-[40px] font-black tabular-nums" style={{ color: hex }}>{score.toFixed(1)}</span>
      </div>
      <p className="text-[13px] font-bold text-center" style={{ color: `${hex}cc` }}>{label}</p>
      <div className="h-2.5 rounded-full bg-zinc-800/50 overflow-hidden relative">
        <div className="absolute inset-0 rounded-full bg-white/[0.08]" />
        <div
          className="absolute top-0 w-1.5 h-full rounded-full -ml-[3px] transition-all duration-500"
          style={{ left: `${barPos}%`, backgroundColor: hex, boxShadow: `0 0 6px ${hex}80` }}
        />
      </div>
    </div>
  );
}

// ── State Mini Row ──

function StateMiniRow({
  sigla,
  stateData,
  scoreOverride,
  isSelected,
  onPress,
}: {
  sigla: string;
  stateData: { count: number; positive: number; negative: number; neutral: number; avgScore?: number };
  scoreOverride?: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const total = stateData.count;
  const score = scoreOverride ?? stateData.avgScore ?? (total > 0
    ? Math.round(((stateData.positive * 9 + stateData.neutral * 5 + stateData.negative * 1) / total) * 10) / 10
    : 5.0);
  const hex = scoreToHex(score);
  const emoji = scoreToEmoji(score);

  return (
    <button
      onClick={onPress}
      className={`w-full flex items-center bg-white/[0.03] rounded-xl border overflow-hidden py-2.5 pr-3 active:scale-[0.98] transition-all duration-200 ${
        isSelected ? 'border-white/[0.15] bg-white/[0.06]' : 'border-white/[0.06] hover:bg-white/[0.05]'
      }`}
    >
      <div className="w-[3px] self-stretch rounded-l-xl" style={{ backgroundColor: hex }} />
      <span className="text-[10px] font-black text-zinc-600 tracking-wider w-7 text-center ml-2">{sigla}</span>
      <span className="flex-1 text-[13px] font-semibold text-zinc-400 ml-1.5 text-left truncate">{STATE_NAMES[sigla] || sigla}</span>
      <span className="text-[10px] text-zinc-600 mr-2">{displayPersonaCount(total)}</span>
      <span className="text-sm mr-1">{emoji}</span>
      <span className="text-sm font-black tabular-nums w-8 text-right" style={{ color: hex }}>{score.toFixed(1)}</span>
    </button>
  );
}

// ── Waiting ──

function MapWaiting() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-20">
      <motion.div className="relative w-48 h-48 flex items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full border-[1.5px] border-emerald-400/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Globe size={32} className="text-emerald-400/30" />
        </div>
      </motion.div>
      <h2 className="text-lg font-extrabold text-emerald-400 tracking-tight">Mapa de Personas</h2>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-emerald-400/60"
            animate={{ y: [-8, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse', delay: i * 0.15 }}
          />
        ))}
      </div>
      <p className="text-[13px] text-zinc-600">Aguardando dados...</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════

export default function MapaPage() {
  const stateBreakdown = useArenaStore((s) => s.data.stateBreakdown) || {};
  const cityBreakdown = useArenaStore((s) => s.data.cityBreakdown) || {};
  const liveComments = useArenaStore((s) => s.data.liveComments) || [];
  const overallAvgScore = useArenaStore((s) => s.data.avgScore);
  const hasEverReceived = useArenaStore((s) => s.hasEverReceived);

  // When only one state has data (filter case), its score must equal the dashboard's overall avgScore.
  const singleStateOverride = useMemo(() => {
    const withData = Object.entries(stateBreakdown).filter(([, d]) => d.count > 0);
    if (withData.length === 1 && overallAvgScore > 0) {
      return { sigla: withData[0][0], score: overallAvgScore };
    }
    return null;
  }, [stateBreakdown, overallAvgScore]);

  const initAuth = useAuthStore((s) => s.initialize);
  const profile = useAuthStore((s) => s.profile);
  useEffect(() => { initAuth(); }, [initAuth]);

  const focusState = profile?.state || null;

  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);

  const stateEntries = useMemo(() => {
    const all = Object.entries(stateBreakdown)
      .map(([sigla, d]) => ({ sigla, ...d }))
      .sort((a, b) => b.count - a.count);
    if (focusState) return all.filter((e) => e.sigla === focusState);
    return all;
  }, [stateBreakdown, focusState]);

  const handleStatePress = useCallback((sigla: string) => {
    setSelectedCity(null);
    setSelectedState(sigla);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedState(null);
    setSelectedCity(null);
  }, []);

  if (!hasEverReceived) {
    return (
      <div className="flex flex-col h-[100dvh] bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <MapWaiting />
        <ArenaNav />
      </div>
    );
  }

  // City detail
  if (selectedCity && selectedState) {
    return (
      <div className="flex flex-col h-[100dvh] bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-start justify-between px-4 py-3.5 border-b border-white/[0.06] shrink-0">
          <div>
            <button onClick={() => setSelectedCity(null)} className="flex items-center gap-0.5 mb-1">
              <ChevronLeft size={12} className="text-zinc-500" />
              <span className="text-[10px] text-zinc-500 tracking-wide">{STATE_NAMES[selectedState]}</span>
            </button>
            <div className="flex items-center gap-1.5">
              <MapPin size={14} style={{ color: scoreToHex(selectedCity.avgScore) }} />
              <h2 className="text-[22px] font-extrabold text-white tracking-tight">{selectedCity.city}</h2>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg bg-white/[0.04]">
            <X size={16} className="text-zinc-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-20">
          <ScoreGauge score={selectedCity.avgScore} />
          <SentimentBars positive={selectedCity.positive} negative={selectedCity.negative} neutral={selectedCity.neutral} total={selectedCity.count} />
          <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.06]">
            <Users size={12} className="text-zinc-500" />
            <span className="text-xs text-zinc-400">{displayPersonaCount(selectedCity.count).toLocaleString('pt-BR')} personas</span>
          </div>
        </div>
        <ArenaNav />
      </div>
    );
  }

  // State detail
  if (selectedState && stateBreakdown[selectedState]) {
    const stateData = stateBreakdown[selectedState];
    const total = stateData.count;
    const score = singleStateOverride?.sigla === selectedState
      ? singleStateOverride.score
      : stateData.avgScore ?? (total > 0
        ? Math.round(((stateData.positive * 9 + stateData.neutral * 5 + stateData.negative * 1) / total) * 10) / 10
        : 5.0);
    const cities = (cityBreakdown[selectedState] || []) as CityData[];

    return (
      <div className="flex flex-col h-[100dvh] bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-start justify-between px-4 py-3.5 border-b border-white/[0.06] shrink-0">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <MapPin size={12} className="text-emerald-400" />
              <span className="text-[9px] font-semibold text-emerald-400/70 uppercase tracking-[1.5px]">Estado</span>
            </div>
            <h2 className="text-[22px] font-extrabold text-white tracking-tight">{STATE_NAMES[selectedState]}</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg bg-white/[0.04]">
            <X size={16} className="text-zinc-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-20">
          <ScoreGauge score={score} />
          <SentimentBars positive={stateData.positive} negative={stateData.negative} neutral={stateData.neutral} total={total} />
          <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.06]">
            <Users size={12} className="text-zinc-500" />
            <span className="text-xs text-zinc-400">{displayPersonaCount(total).toLocaleString('pt-BR')} personas</span>
          </div>

          {cities.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[1.5px]">Cidades ({cities.length})</span>
              {cities.slice(0, 30).map((city) => (
                <button
                  key={city.city}
                  onClick={() => setSelectedCity(city)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06] active:scale-[0.98] transition-all duration-200"
                >
                  <span className="flex-1 text-[13px] text-zinc-400 font-medium text-left truncate">{city.city}</span>
                  <span className="text-[13px] font-black tabular-nums" style={{ color: scoreToHex(city.avgScore) }}>{city.avgScore.toFixed(1)}</span>
                  <span className="text-[10px] text-zinc-600">{displayPersonaCount(city.count)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <ArenaNav />
      </div>
    );
  }

  // Primary view: Map + state list
  return (
    <div className="flex flex-col h-[100dvh] bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04] shrink-0">
        <MapPin size={14} className="text-emerald-400" />
        <span className="text-[11px] font-black text-emerald-400 tracking-[1.5px] flex-1">MAPA DE PERSONAS</span>
        {focusState ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 tracking-wider">
            {focusState}
          </span>
        ) : (
          <span className="text-[11px] text-zinc-600">{stateEntries.length} estados</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 overscroll-contain">
        {/* Leaflet Map */}
        <div className="h-[500px]">
          <LeafletMap
            stateBreakdown={stateBreakdown}
            cityBreakdown={cityBreakdown}
            liveComments={liveComments}
            onStatePress={handleStatePress}
            focusState={focusState}
            scoreOverrideSigla={singleStateOverride?.sigla ?? null}
            scoreOverrideValue={singleStateOverride?.score}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-y border-white/[0.04]">
          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mr-1">Nota por Estado</span>
          <span className="text-xs">💣</span>
          <div className="flex-1 h-3 rounded-full max-w-[140px] bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400" />
          <span className="text-xs">🔥</span>
        </div>

        {/* State list */}
        {stateEntries.length === 0 ? (
          <p className="text-[13px] text-zinc-600 text-center py-10 px-4 leading-relaxed">
            Nenhum dado geográfico ainda. Os estados aparecerão conforme as personas são processadas.
          </p>
        ) : (
          <div className="px-4 pt-3 space-y-1.5">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[1.5px]">
              {focusState ? `Seu estado · ${STATE_NAMES[focusState] || focusState}` : `Estados (${stateEntries.length})`}
            </span>
            {stateEntries.map(({ sigla }) => (
              <StateMiniRow
                key={sigla}
                sigla={sigla}
                stateData={stateBreakdown[sigla]}
                scoreOverride={singleStateOverride?.sigla === sigla ? singleStateOverride.score : undefined}
                isSelected={selectedState === sigla}
                onPress={() => handleStatePress(sigla)}
              />
            ))}
          </div>
        )}
      </div>

      <ArenaNav />
    </div>
  );
}
