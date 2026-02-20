'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export function usePersonaCache() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [count, setCount] = useState(2000);
  const [isLoading, setIsLoading] = useState(false);
  const loadedRef = useRef(false);
  const countLoadedRef = useRef(false);
  const personasRef = useRef<any[]>([]);

  const loadCount = useCallback(async () => {
    if (countLoadedRef.current) return countLoadedRef.current as unknown as number;
    const { count: c } = await supabase.from('personas').select('*', { count: 'exact', head: true });
    if (c && c > 0) {
      setCount(c);
      countLoadedRef.current = true;
      return c;
    }
    return 2000;
  }, []);

  const loadAll = useCallback(async (): Promise<any[]> => {
    if (personasRef.current.length > 0) return personasRef.current;
    if (loadedRef.current) return personasRef.current;

    setIsLoading(true);
    loadedRef.current = true;

    const currentCount = await loadCount();
    const batchSize = 1000;
    let allData: any[] = [];

    for (let from = 0; from < currentCount; from += batchSize) {
      const { data } = await supabase
        .from('personas')
        .select('*')
        .range(from, from + batchSize - 1);
      if (data && data.length > 0) {
        allData = [...allData, ...data];
      } else {
        break;
      }
    }

    if (allData.length > 0) {
      personasRef.current = allData;
      setPersonas(allData);
    }
    setIsLoading(false);
    return allData;
  }, [loadCount]);

  return useMemo(
    () => ({ personas, count, loadCount, loadAll, isLoading }),
    [personas, count, loadCount, loadAll, isLoading]
  );
}
