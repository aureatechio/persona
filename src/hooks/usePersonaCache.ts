'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export function usePersonaCache() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [count, setCount] = useState(2000);
  const [isLoading, setIsLoading] = useState(false);
  const loadedRef = useRef(false);
  const countLoadedRef = useRef<number | null>(null);
  const personasRef = useRef<any[]>([]);

  const loadCount = useCallback(async () => {
    if (countLoadedRef.current !== null) return countLoadedRef.current;
    const { count: c } = await supabase.from('personas').select('*', { count: 'exact', head: true });
    if (c && c > 0) {
      setCount(c);
      countLoadedRef.current = c;
      return c;
    }
    return 2000;
  }, []);

  const loadAll = useCallback(async (
    onBatch?: (loaded: number, total: number, batch: any[]) => void,
  ): Promise<any[]> => {
    const currentCount = await loadCount();

    // Return cached data only if we have a reasonable amount (at least 80% of expected)
    if (personasRef.current.length > 0 && personasRef.current.length >= currentCount * 0.8) {
      console.log(`[PersonaCache] Already loaded: ${personasRef.current.length}/${currentCount} personas`);
      return personasRef.current;
    }

    // If already loading, wait (prevent concurrent loads)
    if (loadedRef.current) {
      console.log(`[PersonaCache] Load in progress, waiting...`);
      // Wait for the ongoing load to finish
      while (loadedRef.current && personasRef.current.length < currentCount * 0.8) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (personasRef.current.length > 0) return personasRef.current;
    }

    setIsLoading(true);
    loadedRef.current = true;

    console.log(`[PersonaCache] Loading all personas. Count from DB: ${currentCount}`);

    const batchSize = 1000;
    let allData: any[] = [];

    for (let from = 0; from < currentCount; from += batchSize) {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .range(from, from + batchSize - 1);

      if (error) {
        console.error(`[PersonaCache] Batch ${from}-${from + batchSize - 1} error:`, error);
        continue; // Don't break, try next batch
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        console.log(`[PersonaCache] Loaded batch ${from}-${from + data.length - 1}, total so far: ${allData.length}`);
        onBatch?.(allData.length, currentCount, data);
      } else {
        console.log(`[PersonaCache] Empty batch at ${from}, stopping`);
        break;
      }
    }

    console.log(`[PersonaCache] Done loading: ${allData.length} personas total (expected ~${currentCount})`);

    if (allData.length > 0) {
      personasRef.current = allData;
      setPersonas(allData);
    } else {
      // Loading failed completely — allow retry
      loadedRef.current = false;
    }
    setIsLoading(false);
    return allData;
  }, [loadCount]);

  return useMemo(
    () => ({ personas, count, loadCount, loadAll, isLoading }),
    [personas, count, loadCount, loadAll, isLoading]
  );
}
