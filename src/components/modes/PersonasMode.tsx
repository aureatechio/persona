'use client';

import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ConversationBlock } from '@/hooks/useConversation';

const PAGE_SIZE = 30;
const LIST_FIELDS = 'id,name,age,city,state,gender,photo_path,gender_identity,civil_status,social_class,education_level,generation,political_leaning,archetype_primary,disc_main_factor,macro_religion,cronotype,region_br,area_type,apelido_politico,cluster_id,nome_grupo,score_economico,score_costumes,psychology_json,career_json,beliefs_json,demographic_json,raca_cor,voto_2022,aprovacao_lula,voto_2026,religiao_subtipo,recebe_beneficio,usa_transporte_publico,time_futebol';

interface PersonasModeProps {
  onAddBlock: (block: ConversationBlock) => void;
  onProcessing: (processing: boolean) => void;
}

export function PersonasMode({ onAddBlock, onProcessing }: PersonasModeProps) {
  const handleSearch = useCallback(async (searchTerm: string) => {
    onProcessing(true);

    try {
      // Count
      let countQ = supabase.from('personas').select('*', { count: 'exact', head: true });
      if (searchTerm) {
        countQ = countQ.or(`name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`);
      }
      const { count } = await countQ;

      // Fetch
      let dataQ = supabase.from('personas').select(LIST_FIELDS);
      if (searchTerm) {
        dataQ = dataQ.or(`name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`);
      }
      const { data } = await dataQ.order('name', { ascending: true }).range(0, PAGE_SIZE - 1);

      onAddBlock({
        id: crypto.randomUUID(),
        type: 'processing' as any,
        timestamp: new Date(),
        data: {
          searchTerm,
          personas: data || [],
          totalCount: count || 0,
          currentPage: 0,
        },
      });
    } catch (err) {
      console.error('[Personas] Search failed:', err);
    } finally {
      onProcessing(false);
    }
  }, [onAddBlock, onProcessing]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.mode === 'personas') {
        handleSearch(detail.value);
      }
    };
    window.addEventListener('unified-submit', handler);
    return () => window.removeEventListener('unified-submit', handler);
  }, [handleSearch]);

  return null;
}
