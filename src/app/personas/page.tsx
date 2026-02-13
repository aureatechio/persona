'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PersonaCard } from '@/components/PersonaCard';
import { Search, Filter, Menu, ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/Sidebar';

const PersonaMap = dynamic(() => import('@/components/PersonaMap'), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl gap-3">
      <MapPin size={32} className="text-zinc-600 animate-pulse" />
      <p className="text-sm text-zinc-500 font-medium">Carregando mapa...</p>
    </div>
  )
});

const PAGE_SIZE = 30;

// Campos mínimos necessários para o card (evita carregar JSONs gigantes desnecessariamente)
const LIST_SELECT_FIELDS = 'id,name,age,city,state,gender,photo_path,gender_identity,civil_status,social_class,education_level,generation,political_leaning,archetype_primary,disc_main_factor,macro_religion,cronotype,region_br,area_type,psychology_json,career_json,beliefs_json,demographic_json';

// Campos mínimos para o mapa (lat/lng + popup info)
const MAP_SELECT_FIELDS = 'id,name,age,city,state,lat,lng';

export default function Home() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [personas, setPersonas] = useState<any[]>([]);
  const [mapPersonas, setMapPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    search: '',
    genderIdentity: '',
    macroReligion: '',
    politicalLeaning: '',
    discMainFactor: '',
    archetypePrimary: '',
    generation: '',
    cronotype: '',
    regionBr: '',
    areaType: '',
    minAge: '',
    maxAge: '',
    socialClass: '',
    educationLevel: '',
    civilStatus: '',
    ethnicity: '',
    minIncome: '',
    maxIncome: '',
  });

  const enumOptions = {
    genderIdentity: ['Masculino', 'Feminino', 'Não-Binário', 'Outro'],
    macroReligion: [
      'Católico',
      'Evangélico/Protestante',
      'Espírita (Kardecista)',
      'Matriz Africana (Candomblé/Umbanda)',
      'Judaísmo',
      'Islamismo',
      'Ateu/Agnóstico',
      'Espiritualidade Eclética',
      'Outros'
    ],
    politicalLeaning: [
      'Extrema Esquerda',
      'Esquerda',
      'Centro-Esquerda',
      'Centro',
      'Centro-Liberal',
      'Centro-Direita',
      'Direita',
      'Extrema Direita',
      'Libertário',
      'Apolítico'
    ],
    discMainFactor: ['Dominância', 'Influência', 'Estabilidade', 'Conformidade'],
    archetypePrimary: [
      'O Inocente',
      'O Sábio',
      'O Explorador',
      'O Rebelde',
      'O Mago',
      'O Herói',
      'O Amante',
      'O Comediante',
      'O Cidadão Comum',
      'O Cuidador',
      'O Governante',
      'O Criador'
    ],
    generation: ['Gen Z', 'Millennial', 'Gen X', 'Boomer'],
    cronotype: ['Matutino', 'Vespertino', 'Noturno/Night Owl'],
    regionBr: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'],
    areaType: ['Capital/Metrópole', 'Urbana/Interior', 'Rural', 'Litoral'],
    socialClass: ['A', 'B1', 'B2', 'C1', 'C2', 'D', 'E'],
    educationLevel: ['Fundamental', 'Médio', 'Superior Incompleto', 'Superior Completo', 'Pós-Graduação/MBA', 'Mestrado/Doutorado'],
    civilStatus: ['Solteiro', 'Casado', 'União Estável', 'Divorciado', 'Viúvo'],
  };

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push('/login');
      return;
    }
    fetchPersonas(0);
  }, [authLoading, session]);

  // Quando muda para view=map, busca dados leves do mapa (somente lat/lng/nome)
  useEffect(() => {
    if (view === 'map' && mapPersonas.length === 0 && session) {
      fetchMapPersonas();
    }
  }, [view, session]);

  function applyFilters(query: any) {
    if (filters.genderIdentity) query = query.eq('gender_identity', filters.genderIdentity);
    if (filters.macroReligion) query = query.eq('macro_religion', filters.macroReligion);
    if (filters.politicalLeaning) query = query.eq('political_leaning', filters.politicalLeaning);
    if (filters.discMainFactor) query = query.eq('disc_main_factor', filters.discMainFactor);
    if (filters.archetypePrimary) query = query.eq('archetype_primary', filters.archetypePrimary);
    if (filters.generation) query = query.eq('generation', filters.generation);
    if (filters.cronotype) query = query.eq('cronotype', filters.cronotype);
    if (filters.regionBr) query = query.eq('region_br', filters.regionBr);
    if (filters.areaType) query = query.eq('area_type', filters.areaType);

    if (filters.minAge) query = query.gte('age', parseInt(filters.minAge));
    if (filters.maxAge) query = query.lte('age', parseInt(filters.maxAge));

    if (filters.socialClass) query = query.eq('social_class', filters.socialClass);
    if (filters.civilStatus) query = query.eq('civil_status', filters.civilStatus);

    if (filters.ethnicity) {
      query = query.filter('demographic_json->identidade_basica->>etnia', 'eq', filters.ethnicity);
    }

    if (filters.educationLevel) query = query.eq('education_level', filters.educationLevel);

    if (filters.minIncome) {
      query = query.filter('demographic_json->renda_e_financas->>renda_mensal_individual', 'gte', parseInt(filters.minIncome));
    }

    if (filters.maxIncome) {
      query = query.filter('demographic_json->renda_e_financas->>renda_mensal_individual', 'lte', parseInt(filters.maxIncome));
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,state.ilike.%${filters.search}%`);
    }

    return query;
  }

  // Fetch paginado para a lista (apenas campos necessários)
  const fetchPersonas = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Buscar count total
      let countQuery = supabase.from('personas').select('*', { count: 'exact', head: true });
      countQuery = applyFilters(countQuery);
      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Supabase count error:', countError);
        setError(countError.message);
        return;
      }

      setTotalCount(count || 0);

      // 2. Buscar página atual (apenas campos necessários)
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase.from('personas').select(LIST_SELECT_FIELDS);
      dataQuery = applyFilters(dataQuery);
      const { data, error: queryError } = await dataQuery
        .order('name', { ascending: true })
        .range(from, to);

      if (queryError) {
        console.error('Supabase query error:', queryError);
        setError(queryError.message);
        return;
      }

      setPersonas(data || []);
      setCurrentPage(page);
    } catch (err) {
      console.error('Fetch personas error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar personas');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch otimizado para o mapa (somente lat/lng + info do popup)
  async function fetchMapPersonas() {
    setMapLoading(true);
    try {
      const batchSize = 1000;
      let allData: any[] = [];
      let from = 0;

      // Busca em batches mas com campos muito leves
      for (let i = 0; i < 10; i++) { // max 10 batches = 10000 personas
        let query = supabase.from('personas').select(MAP_SELECT_FIELDS);
        query = applyFilters(query);
        const { data, error: queryError } = await query.range(from, from + batchSize - 1);

        if (queryError) {
          console.error('Map query error:', queryError);
          break;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
        }

        if (!data || data.length < batchSize) break;
        from += batchSize;
      }

      setMapPersonas(allData);
    } catch (err) {
      console.error('Fetch map personas error:', err);
    } finally {
      setMapLoading(false);
    }
  }

  // Reset paginação quando filtros mudam
  function handleSearch() {
    setCurrentPage(0);
    setMapPersonas([]); // força refetch do mapa com novos filtros
    fetchPersonas(0);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="flex min-h-screen bg-black text-white overflow-x-hidden font-sans">
      <Sidebar view={view} setView={setView} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 p-4 md:p-8 overflow-y-auto lg:pl-64">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                <Menu size={24} />
              </button>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-1 md:mb-2 tracking-tight">Personas Sintéticas</h1>
                <p className="text-zinc-400 text-sm md:text-base">Gerencie e interaja com suas personas sintéticas.</p>
              </div>
            </div>
          </header>

          <section className="mb-8 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[280px] relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Nome, cidade ou estado..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 md:py-4 pl-12 pr-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm md:text-base shadow-inner"
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              
              <button 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-6 py-3 rounded-2xl transition-all flex items-center gap-2 font-bold border ${
                  showAdvancedFilters 
                    ? 'bg-white text-black border-white shadow-xl' 
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <Filter size={18} />
                {showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}
              </button>

              <button 
                onClick={handleSearch}
                className="bg-zinc-100 hover:bg-white text-black px-8 py-3 rounded-2xl transition-all active:scale-95 flex items-center gap-2 font-black shadow-lg shadow-white/5"
              >
                Buscar
              </button>
            </div>

            {/* Painel de Filtros Avançados */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-8 bg-zinc-950 border border-zinc-900 rounded-[2rem] animate-in fade-in slide-in-from-top-4 duration-300 shadow-2xl">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Gênero</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.genderIdentity}
                    onChange={(e) => setFilters({...filters, genderIdentity: e.target.value})}
                  >
                    <option value="">Todos</option>
                    {enumOptions.genderIdentity.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Religião</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.macroReligion}
                    onChange={(e) => setFilters({...filters, macroReligion: e.target.value})}
                  >
                    <option value="">Todas</option>
                    {enumOptions.macroReligion.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Política</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.politicalLeaning}
                    onChange={(e) => setFilters({...filters, politicalLeaning: e.target.value})}
                  >
                    <option value="">Todas</option>
                    {enumOptions.politicalLeaning.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Classe Social</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.socialClass}
                    onChange={(e) => setFilters({...filters, socialClass: e.target.value})}
                  >
                    <option value="">Todas</option>
                    {enumOptions.socialClass.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Estado Civil</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.civilStatus}
                    onChange={(e) => setFilters({...filters, civilStatus: e.target.value})}
                  >
                    <option value="">Todos</option>
                    {enumOptions.civilStatus.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Etnia</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.ethnicity}
                    onChange={(e) => setFilters({...filters, ethnicity: e.target.value})}
                  >
                    <option value="">Todas</option>
                    <option value="Branca">Branca</option>
                    <option value="Preta">Preta</option>
                    <option value="Parda">Parda</option>
                    <option value="Amarela">Amarela</option>
                    <option value="Indígena">Indígena</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Escolaridade</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.educationLevel}
                    onChange={(e) => setFilters({...filters, educationLevel: e.target.value})}
                  >
                    <option value="">Todas</option>
                    {enumOptions.educationLevel.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">DISC Dominante</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.discMainFactor}
                    onChange={(e) => setFilters({...filters, discMainFactor: e.target.value})}
                  >
                    <option value="">Todos</option>
                    {enumOptions.discMainFactor.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Arquétipo</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.archetypePrimary}
                    onChange={(e) => setFilters({...filters, archetypePrimary: e.target.value})}
                  >
                    <option value="">Todos</option>
                    {enumOptions.archetypePrimary.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Geração</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.generation}
                    onChange={(e) => setFilters({...filters, generation: e.target.value})}
                  >
                    <option value="">Todas</option>
                    {enumOptions.generation.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Cronotipo</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.cronotype}
                    onChange={(e) => setFilters({...filters, cronotype: e.target.value})}
                  >
                    <option value="">Todos</option>
                    {enumOptions.cronotype.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Região</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.regionBr}
                    onChange={(e) => setFilters({...filters, regionBr: e.target.value})}
                  >
                    <option value="">Todas</option>
                    {enumOptions.regionBr.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Tipo de Área</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.areaType}
                    onChange={(e) => setFilters({...filters, areaType: e.target.value})}
                  >
                    <option value="">Todos</option>
                    {enumOptions.areaType.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Faixa Etária</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      placeholder="Mín"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm"
                      value={filters.minAge}
                      onChange={(e) => setFilters({...filters, minAge: e.target.value})}
                    />
                    <span className="text-zinc-700 text-xs">até</span>
                    <input 
                      type="number" 
                      placeholder="Máx"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm"
                      value={filters.maxAge}
                      onChange={(e) => setFilters({...filters, maxAge: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Renda Individual</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      placeholder="Mín"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm"
                      value={filters.minIncome}
                      onChange={(e) => setFilters({...filters, minIncome: e.target.value})}
                    />
                    <span className="text-zinc-700 text-xs">até</span>
                    <input 
                      type="number" 
                      placeholder="Máx"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm"
                      value={filters.maxIncome}
                      onChange={(e) => setFilters({...filters, maxIncome: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-end lg:col-span-2 gap-3">
                  <button 
                    onClick={() => {
                      const cleared = {
                        search: '',
                        genderIdentity: '',
                        macroReligion: '',
                        politicalLeaning: '',
                        discMainFactor: '',
                        archetypePrimary: '',
                        generation: '',
                        cronotype: '',
                        regionBr: '',
                        areaType: '',
                        minAge: '',
                        maxAge: '',
                        socialClass: '',
                        educationLevel: '',
                        civilStatus: '',
                        ethnicity: '',
                        minIncome: '',
                        maxIncome: '',
                      };
                      setFilters(cleared);
                      // Fetch com filtros limpos após setState
                      setTimeout(() => {
                        setMapPersonas([]);
                        fetchPersonas(0);
                      }, 0);
                    }}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-3"
                  >
                    Limpar todos os filtros
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Counter badge */}
          {!loading && !error && (
            <div className="flex items-center gap-2 mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-sm">
                <Users size={14} className="text-zinc-500" />
                <span className="text-xs font-bold text-zinc-300 tabular-nums">
                  {totalCount.toLocaleString('pt-BR')} personas encontradas
                </span>
              </div>
              {view === 'grid' && totalPages > 1 && (
                <span className="text-[10px] text-zinc-600 font-medium">
                  Página {currentPage + 1} de {totalPages}
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
              <p className="text-xs text-zinc-500">Carregando personas...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-red-500/30 rounded-3xl bg-red-500/5">
              <p className="text-red-400 text-sm mb-4">Erro ao carregar personas: {error}</p>
              <button
                onClick={() => fetchPersonas(currentPage)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] rounded-xl font-medium text-sm active:scale-[0.97] transition-all duration-200"
              >
                Tentar novamente
              </button>
            </div>
          ) : view === 'grid' ? (
            <>
              <div className="flex flex-col gap-4">
                {personas.map(persona => (
                  <PersonaCard key={persona.id} persona={persona} />
                ))}
                {personas.length === 0 && (
                  <div className="col-span-full text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
                    Nenhuma persona encontrada com esses filtros.
                  </div>
                )}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8 mb-4">
                  <button
                    onClick={() => fetchPersonas(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i;
                      } else if (currentPage < 3) {
                        pageNum = i;
                      } else if (currentPage > totalPages - 4) {
                        pageNum = totalPages - 7 + i;
                      } else {
                        pageNum = currentPage - 3 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => fetchPersonas(pageNum)}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                            pageNum === currentPage
                              ? 'bg-white text-black shadow-lg shadow-white/10'
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => fetchPersonas(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Próxima
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="h-[700px]">
              {mapLoading ? (
                <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                  <p className="text-xs text-zinc-500">Carregando mapa com {totalCount.toLocaleString('pt-BR')} personas...</p>
                </div>
              ) : (
                <PersonaMap personas={mapPersonas} />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
