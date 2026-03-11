'use client';

import { useState, useEffect, useRef } from 'react';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';

/**
 * Hook that listens to BroadcastChannel for real-time ArenaLiveData
 * from the main input screen. Used by all presentation screens.
 */
export function usePresentationData() {
  const [data, setData] = useState<ArenaLiveData | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestRef = useRef<ArenaLiveData | null>(null);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('arena-monitor');
      channel.onmessage = (event) => {
        if (event.data?.type === 'arena-live-update') {
          // Debounce via rAF to avoid excessive re-renders during streaming
          latestRef.current = event.data.data;
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
              rafRef.current = null;
              if (latestRef.current) {
                setData(latestRef.current);
              }
            });
          }
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      channel?.close();
    };
  }, []);

  return data;
}
