'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, User, MapPin, MessageCircle, Filter, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const PERSONA_FIELDS = 'id,name,age,city,state,photo_path,gender_identity,archetype_primary,nome_grupo,political_leaning,region_br,generation,social_class';
const PAGE_SIZE = 30;

// Filter options
const STATES = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

const CLUSTERS = [
  { id: 'P1', name: 'Base Social' },
  { id: 'P2', name: 'Trabalhista' },
  { id: 'P3', name: 'Progressista Urbano' },
  { id: 'P4', name: 'Regulador Tecnico' },
  { id: 'P5', name: 'Desenvolvimentista' },
  { id: 'P6', name: 'Centro-Esquerda Moderada' },
  { id: 'M1', name: 'Centro Economico' },
  { id: 'M2', name: 'Centro Conservador' },
  { id: 'M3', name: 'Institucional' },
  { id: 'M4', name: 'Gestor Pragmatico' },
  { id: 'M5', name: 'Volatil Economico' },
  { id: 'M6', name: 'Empreendedor Urbano' },
  { id: 'M7', name: 'Classe Media Sensivel' },
  { id: 'M8', name: 'Cetico Politico' },
  { id: 'C1', name: 'Liberal de Mercado' },
  { id: 'C2', name: 'Conservador Religioso' },
  { id: 'C3', name: 'Nacionalista' },
  { id: 'C4', name: 'Linha Dura Seguranca' },
  { id: 'C5', name: 'Antissistema' },
  { id: 'C6', name: 'Pequeno Empresario' },
  { id: 'C7', name: 'Direita Digital' },
  { id: 'C8', name: 'Conservador Tradicional' },
  { id: 'T1', name: 'Desengajado' },
  { id: 'T2', name: 'Anti-Incumbente' },
];

const POLITICAL_LEANINGS = [
  'Extrema Esquerda', 'Esquerda', 'Centro-Esquerda', 'Centro', 'Centro-Liberal',
  'Centro-Direita', 'Direita', 'Extrema Direita', 'Libertario', 'Apolitico',
];

const GENERATIONS = ['Gen Z', 'Millennial', 'Gen X', 'Boomer'];

interface Filters {
  state: string | null;
  region: string | null;
  cluster: string | null;
  political: string | null;
  generation: string | null;
}

const EMPTY_FILTERS: Filters = { state: null, region: null, cluster: null, political: null, generation: null };

interface PersonaSelectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (personaId: string) => void;
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 whitespace-nowrap',
        active
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
          : 'bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300'
      )}
    >
      {label}
    </button>
  );
}

function FilterSection({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors duration-200 py-1"
      >
        {label}
        <ChevronDown size={12} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function PersonaSelectorDrawer({ isOpen, onClose, onSelect }: PersonaSelectorDrawerProps) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const offsetRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const fetchPersonas = useCallback(async (searchTerm: string, activeFilters: Filters, offset: number, append: boolean) => {
    setLoading(true);
    try {
      let q = supabase.from('personas').select(PERSONA_FIELDS);

      if (searchTerm.trim()) {
        q = q.or(`name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`);
      }
      if (activeFilters.state) q = q.eq('state', activeFilters.state);
      if (activeFilters.region) q = q.eq('region_br', activeFilters.region);
      if (activeFilters.cluster) q = q.eq('nome_grupo', activeFilters.cluster);
      if (activeFilters.political) q = q.eq('political_leaning', activeFilters.political);
      if (activeFilters.generation) q = q.eq('generation', activeFilters.generation);

      const { data } = await q.order('name').range(offset, offset + PAGE_SIZE - 1);

      if (data) {
        setPersonas(prev => append ? [...prev, ...data] : data);
        setHasMore(data.length === PAGE_SIZE);
        offsetRef.current = offset + data.length;
      } else {
        if (!append) setPersonas([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('[PersonaDrawer] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial personas when drawer opens
  useEffect(() => {
    if (isOpen && !initialLoaded) {
      offsetRef.current = 0;
      fetchPersonas('', EMPTY_FILTERS, 0, false);
      setInitialLoaded(true);
    }
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 200);
    }
  }, [isOpen, initialLoaded, fetchPersonas]);

  // Reset when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setFilters(EMPTY_FILTERS);
      setShowFilters(false);
      setInitialLoaded(false);
    }
  }, [isOpen]);

  // Debounced search + filter change
  useEffect(() => {
    if (!initialLoaded) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      offsetRef.current = 0;
      fetchPersonas(search, filters, 0, false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, filters, fetchPersonas, initialLoaded]);

  const loadMore = () => {
    if (loading || !hasMore) return;
    fetchPersonas(search, filters, offsetRef.current, true);
  };

  const toggleFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key] === value ? null : value,
    }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-full sm:w-[440px] bg-zinc-950/95 backdrop-blur-2xl border-l border-white/[0.06] shadow-2xl shadow-black/60 flex flex-col transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Selecionar Persona</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Escolha uma persona para conversar</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search + Filters */}
        <div className="px-6 py-4 space-y-3 border-b border-white/[0.04]">
          {/* Search row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, cidade..."
                className="w-full pl-11 pr-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'relative p-3 rounded-xl border transition-all duration-200 shrink-0',
                showFilters || activeFilterCount > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
              )}
            >
              <Filter size={16} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-[9px] font-bold text-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter panels */}
          {showFilters && (
            <div className="space-y-3 pt-1">
              {/* Active filters summary + clear */}
              {activeFilterCount > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {filters.state && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {filters.state}
                        <button onClick={() => toggleFilter('state', filters.state!)} className="hover:text-white"><X size={10} /></button>
                      </span>
                    )}
                    {filters.region && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {filters.region}
                        <button onClick={() => toggleFilter('region', filters.region!)} className="hover:text-white"><X size={10} /></button>
                      </span>
                    )}
                    {filters.cluster && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {filters.cluster}
                        <button onClick={() => toggleFilter('cluster', filters.cluster!)} className="hover:text-white"><X size={10} /></button>
                      </span>
                    )}
                    {filters.political && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {filters.political}
                        <button onClick={() => toggleFilter('political', filters.political!)} className="hover:text-white"><X size={10} /></button>
                      </span>
                    )}
                    {filters.generation && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        {filters.generation}
                        <button onClick={() => toggleFilter('generation', filters.generation!)} className="hover:text-white"><X size={10} /></button>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={clearFilters}
                    className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors duration-200 shrink-0"
                  >
                    Limpar
                  </button>
                </div>
              )}

              {/* Region */}
              <FilterSection label="Regiao" defaultOpen>
                {REGIONS.map(r => (
                  <FilterChip key={r} label={r} active={filters.region === r} onClick={() => toggleFilter('region', r)} />
                ))}
              </FilterSection>

              {/* State */}
              <FilterSection label="Estado (UF)">
                {STATES.map(s => (
                  <FilterChip key={s} label={s} active={filters.state === s} onClick={() => toggleFilter('state', s)} />
                ))}
              </FilterSection>

              {/* Cluster */}
              <FilterSection label="Grupo Ideologico">
                {CLUSTERS.map(c => (
                  <FilterChip
                    key={c.id}
                    label={`${c.id} ${c.name}`}
                    active={filters.cluster === c.name}
                    onClick={() => toggleFilter('cluster', c.name)}
                  />
                ))}
              </FilterSection>

              {/* Political leaning */}
              <FilterSection label="Orientacao Politica">
                {POLITICAL_LEANINGS.map(p => (
                  <FilterChip key={p} label={p} active={filters.political === p} onClick={() => toggleFilter('political', p)} />
                ))}
              </FilterSection>

              {/* Generation */}
              <FilterSection label="Geracao">
                {GENERATIONS.map(g => (
                  <FilterChip key={g} label={g} active={filters.generation === g} onClick={() => toggleFilter('generation', g)} />
                ))}
              </FilterSection>
            </div>
          )}
        </div>

        {/* Persona List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-2">
          {personas.map(persona => (
            <button
              key={persona.id}
              onClick={() => onSelect(persona.id)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200 group text-left"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800/50 flex items-center justify-center overflow-hidden shrink-0">
                {persona.photo_path ? (
                  <img src={persona.photo_path} alt={persona.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-zinc-600" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors duration-200">
                  {persona.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                  <span className="flex items-center gap-1">
                    <MapPin size={10} />
                    {persona.city}, {persona.state}
                  </span>
                  <span>{persona.age} anos</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {persona.archetype_primary && (
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                      {persona.archetype_primary}
                    </span>
                  )}
                  {persona.nome_grupo && (
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/20">
                      {persona.nome_grupo}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat icon */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <MessageCircle size={16} className="text-black" />
                </div>
              </div>
            </button>
          ))}

          {/* Load more */}
          {hasMore && !loading && personas.length > 0 && (
            <button
              onClick={loadMore}
              className="w-full py-3 text-sm font-medium text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all duration-200"
            >
              Carregar mais
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!loading && personas.length === 0 && initialLoaded && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                <User size={28} className="text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-sm">
                {search || activeFilterCount > 0
                  ? 'Nenhuma persona encontrada com esses filtros'
                  : 'Nenhuma persona disponivel'}
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors duration-200"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
