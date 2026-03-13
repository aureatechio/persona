'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';

/** Pre-seeded segments with known Brazilian demographic labels (zero counts).
 *  This ensures the dashboard shows card structures immediately,
 *  and bars grow from 0 as real data arrives. */
function z(label: string) { return { label, count: 0, positive: 0, negative: 0, neutral: 0 }; }

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
  archetype: [] as { label: string; count: number; positive: number; negative: number; neutral: number }[],
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
