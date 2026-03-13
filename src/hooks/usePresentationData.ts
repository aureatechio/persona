'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';

const EMPTY_SEGMENTS = {
  gender: [], religion: [], race: [], region: [],
  generation: [], socialClass: [], education: [], politicalLeaning: [],
  voto2022: [], aprovacaoLula: [], voto2026: [],
  archetype: [], clusterMacro: [], scoreEco: [], scoreCost: [],
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
export function usePresentationData(): { data: ArenaLiveData; hasEverReceived: boolean } {
  const [data, setData] = useState<ArenaLiveData>(() => makeZeroedData());
  const hasEverReceivedRef = useRef(false);
  const [hasEverReceived, setHasEverReceived] = useState(false);
  const throttleRef = useRef(false);
  const pendingRef = useRef<ArenaLiveData | null>(null);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      channel = new BroadcastChannel('arena-monitor');
      console.log('[Presentation] BroadcastChannel connected');

      channel.onmessage = (event) => {
        // Reset: keep dashboard mounted with zeroed data instead of null
        if (event.data?.type === 'arena-reset') {
          setData(makeZeroedData(event.data.data?.question || ''));
          pendingRef.current = null;
          return;
        }

        if (event.data?.type === 'arena-live-update') {
          const incoming = event.data.data as ArenaLiveData;

          // Mark that we've received real data at least once
          if (!hasEverReceivedRef.current) {
            hasEverReceivedRef.current = true;
            setHasEverReceived(true);
          }

          // Throttle to ~15fps using setTimeout (works in background tabs unlike rAF)
          if (!throttleRef.current) {
            throttleRef.current = true;
            setData(incoming);
            timer = setTimeout(() => {
              throttleRef.current = false;
              // Flush any pending update
              if (pendingRef.current) {
                setData(pendingRef.current);
                pendingRef.current = null;
              }
            }, 66); // ~15fps
          } else {
            pendingRef.current = incoming;
          }
        }
      };
    } catch (err) {
      console.error('[Presentation] BroadcastChannel error:', err);
    }

    return () => {
      if (timer) clearTimeout(timer);
      channel?.close();
    };
  }, []);

  return { data, hasEverReceived };
}
