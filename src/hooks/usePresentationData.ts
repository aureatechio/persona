'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';

/**
 * Hook that listens to BroadcastChannel for real-time ArenaLiveData
 * from the main input screen. Used by all presentation screens.
 */
export function usePresentationData() {
  const [data, setData] = useState<ArenaLiveData | null>(null);
  const throttleRef = useRef(false);
  const pendingRef = useRef<ArenaLiveData | null>(null);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      channel = new BroadcastChannel('arena-monitor');
      console.log('[Presentation] BroadcastChannel connected');

      channel.onmessage = (event) => {
        // Reset presentation screens when a new question starts
        if (event.data?.type === 'arena-reset') {
          setData(null);
          return;
        }

        if (event.data?.type === 'arena-live-update') {
          const incoming = event.data.data as ArenaLiveData;

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

  return data;
}
