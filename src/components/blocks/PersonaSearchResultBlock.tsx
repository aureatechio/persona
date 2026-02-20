'use client';

import { useState } from 'react';
import { Users, Search, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PersonaCard } from '@/components/PersonaCard';

const PAGE_SIZE = 30;
const LIST_FIELDS = 'id,name,age,city,state,gender,photo_path,gender_identity,civil_status,social_class,education_level,generation,political_leaning,archetype_primary,disc_main_factor,macro_religion,cronotype,region_br,area_type,apelido_politico,cluster_id,nome_grupo,score_economico,score_costumes,psychology_json,career_json,beliefs_json,demographic_json,raca_cor,voto_2022,aprovacao_lula,voto_2026,religiao_subtipo,recebe_beneficio,usa_transporte_publico,time_futebol';

interface PersonaSearchResultBlockProps {
  data: {
    searchTerm: string;
    personas: any[];
    totalCount: number;
    currentPage: number;
  };
  onStartChat?: (personaId: string) => void;
}

export function PersonaSearchResultBlock({ data, onStartChat }: PersonaSearchResultBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const [personas, setPersonas] = useState(data.personas);
  const [currentPage, setCurrentPage] = useState(data.currentPage);
  const [loading, setLoading] = useState(false);
  const totalPages = Math.ceil(data.totalCount / PAGE_SIZE);

  const loadPage = async (page: number) => {
    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      let q = supabase.from('personas').select(LIST_FIELDS);
      if (data.searchTerm) {
        q = q.or(`name.ilike.%${data.searchTerm}%,city.ilike.%${data.searchTerm}%,state.ilike.%${data.searchTerm}%`);
      }
      const { data: newData } = await q.order('name', { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (newData) setPersonas(newData);
      setCurrentPage(page);
    } catch (err) {
      console.error('[Personas] Page load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors duration-200"
      >
        <div className="text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">
            <Search size={10} className="inline mr-1" />
            Busca de Personas
          </p>
          <p className="text-sm font-semibold text-white">
            {data.searchTerm ? `"${data.searchTerm}"` : 'Todas as personas'}
          </p>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Users size={10} /> {data.totalCount.toLocaleString('pt-BR')} resultados
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
      </button>

      {expanded && (
        <div className="px-5 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : personas.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              Nenhuma persona encontrada.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {personas.map(persona => (
                <div key={persona.id} className="relative group">
                  <PersonaCard persona={persona} />
                  {onStartChat && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartChat(persona.id); }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-black text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-[0.97] transition-all duration-200"
                    >
                      <MessageCircle size={12} />
                      Conversar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => loadPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800/50 rounded-xl text-sm font-bold text-zinc-300 hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-xs text-zinc-500">
                {currentPage + 1} de {totalPages}
              </span>
              <button
                onClick={() => loadPage(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800/50 rounded-xl text-sm font-bold text-zinc-300 hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Proxima
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
