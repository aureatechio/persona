'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';
import type { SegmentItem } from '@/lib/arena/segments';

/** Pre-seeded segments with known Brazilian demographic labels (zero counts).
 *  This ensures the dashboard shows card structures immediately,
 *  and bars grow from 0 as real data arrives. */
function z(label: string) { return { label, count: 0, positive: 0, negative: 0, neutral: 0, avgScore: 0 }; }

const EMPTY_SEGMENTS = {
  gender: [z('Masculino'), z('Feminino')],
  religion: [z('Católico'), z('Evangélico'), z('Sem religião'), z('Espírita'), z('Umbanda/Candomblé'), z('Outros')],
  race: [z('Branco'), z('Pardo'), z('Preto'), z('Amarelo'), z('Indígena')],
  region: [z('Sudeste'), z('Nordeste'), z('Sul'), z('Norte'), z('Centro-Oeste')],
  generation: [z('Gen Z'), z('Millennial'), z('Gen X'), z('Boomer')],
  socialClass: [z('Classe A'), z('Classe B'), z('Classe C'), z('Classe D'), z('Classe E')],
  education: [z('Superior Completo'), z('Médio Completo'), z('Fundamental'), z('Pós-graduação')],
  politicalLeaning: [z('Centro'), z('Centro-Direita'), z('Centro-Esquerda'), z('Direita'), z('Esquerda')],
  voto2022: [z('Lula'), z('Bolsonaro'), z('Nulo/Branco'), z('Ciro'), z('Tebet')],
  aprovacaoLula: [z('Aprova'), z('Desaprova'), z('Neutro')],
  voto2026: [z('Lula'), z('Bolsonaro'), z('Outros'), z('Indeciso')],
  archetype: [z('O Cidadão Comum'), z('O Governante'), z('O Cuidador'), z('O Herói'), z('O Rebelde'), z('O Sábio')],
  clusterMacro: [z('Progressista'), z('Moderado'), z('Conservador'), z('Transversal')],
  scoreEco: [z('Esquerda Forte'), z('Centro-Esquerda'), z('Centro'), z('Centro-Direita'), z('Direita Forte')],
  scoreCost: [z('Progressista Forte'), z('Progressista'), z('Centro'), z('Conservador'), z('Conservador Forte')],
};

function makeZeroedData(question = ''): ArenaLiveData {
  return {
    question,
    phase: 'collecting',
    processedCount: 0,
    totalCount: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
    avgScore: 0,
    scoreSum: 0,
    simulation: null,
    totalPersonas: 0,
    segments: { ...EMPTY_SEGMENTS },
    liveComments: [],
    stateBreakdown: {},
  };
}

/**
 * Hook that listens to BroadcastChannel for real-time ArenaLiveData
 * from the main input screen. Used by all presentation screens.
 */
/** Merge incoming segments with pre-seeded labels */
function mergeSegments(incoming: ArenaLiveData): void {
  if (!incoming.segments || Object.keys(incoming.segments).length === 0) {
    incoming.segments = { ...EMPTY_SEGMENTS };
  } else {
    const merged = {} as any;
    for (const key of Object.keys(EMPTY_SEGMENTS)) {
      const preSeeded: SegmentItem[] = (EMPTY_SEGMENTS as any)[key] || [];
      const incomingSeg: SegmentItem[] = (incoming.segments as any)?.[key] || [];

      if (incomingSeg.length === 0) {
        merged[key] = preSeeded.map(s => ({ ...s }));
        continue;
      }

      const incomingMap = new Map<string, SegmentItem>();
      for (const item of incomingSeg) incomingMap.set(item.label, item);

      const result: SegmentItem[] = [];
      const seenLabels = new Set<string>();
      for (const seed of preSeeded) {
        result.push(incomingMap.get(seed.label) || { ...seed });
        seenLabels.add(seed.label);
      }
      for (const item of incomingSeg) {
        if (!seenLabels.has(item.label)) result.push(item);
      }
      merged[key] = result;
    }
    for (const key of Object.keys(incoming.segments || {})) {
      if (!(key in merged)) merged[key] = (incoming.segments as any)[key];
    }
    incoming.segments = merged;
  }
}

export function usePresentationData(): { data: ArenaLiveData; hasEverReceived: boolean } {
  const [data, setData] = useState<ArenaLiveData>(() => makeZeroedData());
  const hasEverReceivedRef = useRef(false);
  const [hasEverReceived, setHasEverReceived] = useState(false);
  const throttleRef = useRef(false);
  const pendingRef = useRef<ArenaLiveData | null>(null);
  const resetEpochRef = useRef(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    try {
      channel = new BroadcastChannel('arena-monitor');
      console.log('[Presentation] BroadcastChannel connected');

      channel.onmessage = (event) => {
        // Reset: keep dashboard mounted with zeroed data instead of null
        if (event.data?.type === 'arena-reset') {
          resetEpochRef.current += 1;
          setData(makeZeroedData(event.data.data?.question || ''));
          pendingRef.current = null;
          // Cancel any pending throttle timer to prevent stale data overwriting reset
          if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = null;
          }
          throttleRef.current = false;
          return;
        }

        if (event.data?.type === 'arena-live-update') {
          const incoming = event.data.data as ArenaLiveData;
          const epochAtReceive = resetEpochRef.current;

          // Merge segments with pre-seeded labels
          mergeSegments(incoming);

          // Mark that we've received real data at least once
          if (!hasEverReceivedRef.current) {
            hasEverReceivedRef.current = true;
            setHasEverReceived(true);
          }

          // Apply data immediately (throttled at ~15fps)
          applyThrottled(incoming, epochAtReceive);
        }
      };

      function applyThrottled(incoming: ArenaLiveData, epoch: number) {
        if (!throttleRef.current) {
          throttleRef.current = true;
          if (epoch === resetEpochRef.current) setData(incoming);
          throttleTimerRef.current = setTimeout(() => {
            throttleRef.current = false;
            throttleTimerRef.current = null;
            if (pendingRef.current && epoch === resetEpochRef.current) {
              setData(pendingRef.current);
              pendingRef.current = null;
            }
          }, 66); // ~15fps
        } else {
          pendingRef.current = incoming;
        }
      }
    } catch (err) {
      console.error('[Presentation] BroadcastChannel error:', err);
    }

    return () => {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      channel?.close();
    };
  }, []);

  return { data, hasEverReceived };
}
