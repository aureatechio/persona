'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';
import type { SegmentItem } from '@/lib/arena/segments';

/** Pre-seeded segments with known Brazilian demographic labels (zero counts).
 *  This ensures the dashboard shows card structures immediately,
 *  and bars grow from 0 as real data arrives. */
function z(label: string) { return { label, count: 0, positive: 0, negative: 0, neutral: 0, avgScore: 0 }; }

const EMPTY_SEGMENTS = {
  gender: [z('Masculino'), z('Feminino')],
  religion: [z('Católico'), z('Evangélico/Protestante'), z('Sem religião'), z('Espírita (Kardecista)'), z('Ateu/Agnóstico'), z('Umbanda/Candomblé'), z('Espiritualidade Eclética'), z('Outros')],
  race: [z('Branco'), z('Pardo'), z('Preto'), z('Amarelo'), z('Indígena')],
  region: [z('Sudeste'), z('Nordeste'), z('Sul'), z('Norte'), z('Centro-Oeste')],
  generation: [z('Gen Z'), z('Millennial'), z('Gen X'), z('Boomer')],
  socialClass: [z('Classe A'), z('Classe B'), z('Classe C'), z('Classe D'), z('Classe E')],
  education: [z('Superior Completo'), z('Médio'), z('Fundamental'), z('Mestrado/Doutorado'), z('Pós-Graduação/MBA')],
  politicalLeaning: [z('Centro'), z('Centro-Direita'), z('Centro-Esquerda'), z('Direita'), z('Esquerda'), z('Extrema Direita'), z('Extrema Esquerda'), z('Centro-Liberal'), z('Libertário')],
  voto2022: [z('Lula'), z('Bolsonaro'), z('Nulo/Branco'), z('Ciro'), z('Tebet'), z('Não votou')],
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
/** Merge incoming segments with pre-seeded labels.
 *  When Python sends data, use it as-is (Python labels are authoritative).
 *  Pre-seeded labels are only used as placeholder when no data exists for a segment. */
function mergeSegments(incoming: ArenaLiveData): void {
  if (!incoming.segments || Object.keys(incoming.segments).length === 0) {
    incoming.segments = { ...EMPTY_SEGMENTS };
  } else {
    const merged = {} as any;
    for (const key of Object.keys(EMPTY_SEGMENTS)) {
      const preSeeded: SegmentItem[] = (EMPTY_SEGMENTS as any)[key] || [];
      const incomingSeg: SegmentItem[] = (incoming.segments as any)?.[key] || [];

      if (incomingSeg.length === 0) {
        // No data from Python — show pre-seeded placeholders
        merged[key] = preSeeded.map(s => ({ ...s }));
      } else {
        // Python sent data — use it directly (Python labels are the source of truth)
        merged[key] = incomingSeg;
      }
    }
    // Pass through any extra segment keys Python sends that aren't in EMPTY_SEGMENTS
    for (const key of Object.keys(incoming.segments || {})) {
      if (!(key in merged)) merged[key] = (incoming.segments as any)[key];
    }
    incoming.segments = merged;
  }
}

/**
 * Grace period (ms) after backend signals 'complete'.
 * During this window the dashboard stays in "live" mode so all
 * animations can finish their ramp to the final values without freezing.
 */
const COMPLETION_GRACE_MS = 8000;

export function usePresentationData(): { data: ArenaLiveData; hasEverReceived: boolean } {
  const [data, setData] = useState<ArenaLiveData>(() => makeZeroedData());
  const hasEverReceivedRef = useRef(false);
  const [hasEverReceived, setHasEverReceived] = useState(false);
  const throttleRef = useRef(false);
  const pendingRef = useRef<ArenaLiveData | null>(null);
  const resetEpochRef = useRef(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Grace period: delay phase='complete' so animations can finish ──
  const [visuallyComplete, setVisuallyComplete] = useState(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backendComplete = data.phase === 'complete';

  useEffect(() => {
    if (!backendComplete) {
      // Analysis is running — cancel any pending grace timer, stay live
      setVisuallyComplete(false);
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
      return;
    }
    // Backend just finished — start grace period before showing "Completo"
    graceTimerRef.current = setTimeout(() => {
      setVisuallyComplete(true);
      graceTimerRef.current = null;
    }, COMPLETION_GRACE_MS);
    return () => {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    };
  }, [backendComplete]);

  // Exposed data: override phase during grace period so dashboard stays "live"
  const exposedData = useMemo<ArenaLiveData>(() => {
    if (backendComplete && !visuallyComplete) {
      // Grace period active — keep phase as 'processing' so isLive stays true
      // and progress < 100 so jitter continues (organic feel while ramp finishes)
      return {
        ...data,
        phase: 'processing' as ArenaLiveData['phase'],
        processedCount: Math.min(
          data.processedCount,
          Math.max(1, Math.floor(data.totalCount * 0.95)),
        ),
      };
    }
    return data;
  }, [data, backendComplete, visuallyComplete]);

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
          setVisuallyComplete(false);
          if (graceTimerRef.current) {
            clearTimeout(graceTimerRef.current);
            graceTimerRef.current = null;
          }
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
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      channel?.close();
    };
  }, []);

  return { data: exposedData, hasEverReceived };
}
