'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

// Campos necessários para o card
const LIST_FIELDS = 'id,name,age,city,state,gender,photo_path,gender_identity,civil_status,social_class,education_level,generation,political_leaning,archetype_primary,disc_main_factor,macro_religion,cronotype,region_br,area_type,apelido_politico,cluster_id,nome_grupo,score_economico,score_costumes,psychology_json,career_json,beliefs_json,demographic_json,raca_cor,voto_2022,aprovacao_lula,voto_2026,religiao_subtipo,recebe_beneficio,usa_transporte_publico,time_futebol';

// Campos mínimos para o mapa (apenas lat/lng + popup)
const MAP_FIELDS = 'id,name,age,city,state,lat,lng';

interface Filters {
  search: string;
  genderIdentity: string;
  macroReligion: string;
  politicalLeaning: string;
  discMainFactor: string;
  archetypePrimary: string;
  generation: string;
  cronotype: string;
  regionBr: string;
  areaType: string;
  minAge: string;
  maxAge: string;
  socialClass: string;
  educationLevel: string;
  civilStatus: string;
  ethnicity: string;
  minIncome: string;
  maxIncome: string;
  nomeGrupo: string;
  minScoreEconomico: string;
  maxScoreEconomico: string;
  minScoreCostumes: string;
  maxScoreCostumes: string;
  voto2022: string;
  aprovacaoLula: string;
  recebeBeneficio: string;
}

const EMPTY_FILTERS: Filters = {
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
  nomeGrupo: '',
  minScoreEconomico: '',
  maxScoreEconomico: '',
  minScoreCostumes: '',
  maxScoreCostumes: '',
  voto2022: '',
  aprovacaoLula: '',
  recebeBeneficio: '',
};

function applyFilters(query: any, f: Filters) {
  if (f.genderIdentity) query = query.eq('gender_identity', f.genderIdentity);
  if (f.macroReligion) query = query.eq('macro_religion', f.macroReligion);
  if (f.politicalLeaning) query = query.eq('political_leaning', f.politicalLeaning);
  if (f.discMainFactor) query = query.eq('disc_main_factor', f.discMainFactor);
  if (f.archetypePrimary) query = query.eq('archetype_primary', f.archetypePrimary);
  if (f.generation) query = query.eq('generation', f.generation);
  if (f.cronotype) query = query.eq('cronotype', f.cronotype);
  if (f.regionBr) query = query.eq('region_br', f.regionBr);
  if (f.areaType) query = query.eq('area_type', f.areaType);
  if (f.minAge) query = query.gte('age', parseInt(f.minAge));
  if (f.maxAge) query = query.lte('age', parseInt(f.maxAge));
  if (f.socialClass) query = query.eq('social_class', f.socialClass);
  if (f.civilStatus) query = query.eq('civil_status', f.civilStatus);
  if (f.ethnicity) query = query.eq('raca_cor', f.ethnicity);
  if (f.educationLevel) query = query.eq('education_level', f.educationLevel);
  if (f.minIncome) query = query.filter('demographic_json->renda_e_financas->>renda_mensal_individual', 'gte', parseInt(f.minIncome));
  if (f.maxIncome) query = query.filter('demographic_json->renda_e_financas->>renda_mensal_individual', 'lte', parseInt(f.maxIncome));
  if (f.nomeGrupo) query = query.eq('nome_grupo', f.nomeGrupo);
  if (f.minScoreEconomico) query = query.gte('score_economico', parseFloat(f.minScoreEconomico));
  if (f.maxScoreEconomico) query = query.lte('score_economico', parseFloat(f.maxScoreEconomico));
  if (f.minScoreCostumes) query = query.gte('score_costumes', parseFloat(f.minScoreCostumes));
  if (f.maxScoreCostumes) query = query.lte('score_costumes', parseFloat(f.maxScoreCostumes));
  if (f.voto2022) query = query.eq('voto_2022', f.voto2022);
  if (f.aprovacaoLula) query = query.eq('aprovacao_lula', f.aprovacaoLula);
  if (f.recebeBeneficio) query = query.eq('recebe_beneficio', f.recebeBeneficio);
  if (f.search) query = query.or(`name.ilike.%${f.search}%,city.ilike.%${f.search}%,state.ilike.%${f.search}%`);
  return query;
}

export default function PersonasPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="space-y-4 w-full max-w-7xl px-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-900/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <PersonasPage />
    </Suspense>
  );
}

function PersonasPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView = searchParams.get('view') === 'map' ? 'map' : 'grid';
  const [personas, setPersonas] = useState<any[]>([]);
  const [mapPersonas, setMapPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);
  const [view, setView] = useState<'grid' | 'map'>(initialView);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [mapLoaded, setMapLoaded] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const enumOptions = {
    genderIdentity: ['Masculino', 'Feminino', 'Não-Binário', 'Outro'],
    macroReligion: [
      'Católico', 'Evangélico/Protestante', 'Espírita (Kardecista)',
      'Matriz Africana (Candomblé/Umbanda)', 'Judaísmo', 'Islamismo',
      'Ateu/Agnóstico', 'Espiritualidade Eclética', 'Outros'
    ],
    politicalLeaning: [
      'Extrema Esquerda', 'Esquerda', 'Centro-Esquerda', 'Centro',
      'Centro-Liberal', 'Centro-Direita', 'Direita', 'Extrema Direita',
      'Libertário', 'Apolítico'
    ],
    discMainFactor: ['Dominância', 'Influência', 'Estabilidade', 'Conformidade'],
    archetypePrimary: [
      'O Inocente', 'O Sábio', 'O Explorador', 'O Rebelde', 'O Mago', 'O Herói',
      'O Amante', 'O Comediante', 'O Cidadão Comum', 'O Cuidador', 'O Governante', 'O Criador'
    ],
    generation: ['Gen Z', 'Millennial', 'Gen X', 'Boomer'],
    cronotype: ['Matutino', 'Vespertino', 'Noturno/Night Owl'],
    regionBr: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'],
    areaType: ['Capital/Metrópole', 'Urbana/Interior', 'Rural', 'Litoral'],
    socialClass: ['A', 'B1', 'B2', 'C1', 'C2', 'D', 'E'],
    educationLevel: ['Fundamental', 'Médio', 'Superior Incompleto', 'Superior Completo', 'Pós-Graduação/MBA', 'Mestrado/Doutorado'],
    civilStatus: ['Solteiro', 'Casado', 'União Estável', 'Divorciado', 'Viúvo'],
    nomeGrupo: [
      'Base Social', 'Trabalhista', 'Progressista Urbano', 'Regulador Técnico',
      'Desenvolvimentista', 'Centro-Esquerda Moderada',
      'Centro Econômico', 'Centro Conservador', 'Institucional', 'Gestor Pragmático',
      'Volátil Econômico', 'Empreendedor Urbano', 'Classe Média Sensível', 'Cético Político',
      'Liberal de Mercado', 'Conservador Religioso', 'Nacionalista', 'Linha Dura Segurança',
      'Antissistema', 'Pequeno Empresário', 'Direita Digital', 'Conservador Tradicional',
      'Desengajado', 'Anti-Incumbente',
    ],
    voto2022: ['Lula', 'Bolsonaro', 'Ciro', 'Simone Tebet', 'Nulo/Branco', 'Não votou'],
    aprovacaoLula: ['Aprova', 'Desaprova', 'Neutro'],
    recebeBeneficio: ['Sim', 'Não'],
  };

  // ── Auth guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push('/login');
    }
  }, [authLoading, session, router]);

  // ── Fetch lista paginada ao montar ─────────────────────────────────────
  useEffect(() => {
    if (authLoading || !session) return;
    fetchPage(0, filters);
  }, [authLoading, session]);

  // ── Fetch mapa quando troca para view=map ──────────────────────────────
  useEffect(() => {
    if (view === 'map' && !mapLoaded && session) {
      fetchMapData(filters);
    }
  }, [view, mapLoaded, session]);

  // ── Fetch paginado para a lista ────────────────────────────────────────
  async function fetchPage(page: number, f: Filters) {
    setLoading(true);
    setError(null);
    try {
      // Count total
      let countQ = supabase.from('personas').select('*', { count: 'exact', head: true });
      countQ = applyFilters(countQ, f);
      const { count, error: countErr } = await countQ;

      if (countErr) {
        console.error('Count error:', countErr);
        setError(countErr.message);
        return;
      }

      setTotalCount(count || 0);

      // Fetch page
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQ = supabase.from('personas').select(LIST_FIELDS);
      dataQ = applyFilters(dataQ, f);
      const { data, error: dataErr } = await dataQ
        .order('name', { ascending: true })
        .range(from, to);

      if (dataErr) {
        console.error('Data error:', dataErr);
        setError(dataErr.message);
        return;
      }

      setPersonas(data || []);
      setCurrentPage(page);

      // Scroll to top on page change
      if (page > 0) {
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar personas');
    } finally {
      setLoading(false);
    }
  }

  // ── Fetch otimizado para o mapa ────────────────────────────────────────
  async function fetchMapData(f: Filters) {
    setMapLoading(true);
    try {
      let allData: any[] = [];
      const batchSize = 1000;

      for (let i = 0; i < 5; i++) {
        let q = supabase.from('personas').select(MAP_FIELDS);
        q = applyFilters(q, f);
        const { data, error: err } = await q.range(i * batchSize, (i + 1) * batchSize - 1);

        if (err) { console.error('Map batch error:', err); break; }
        if (data && data.length > 0) allData = [...allData, ...data];
        if (!data || data.length < batchSize) break;
      }

      setMapPersonas(allData);
      setMapLoaded(true);
    } catch (err) {
      console.error('Map fetch error:', err);
    } finally {
      setMapLoading(false);
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────
  function handleSearch() {
    setMapLoaded(false);
    fetchPage(0, filters);
    if (view === 'map') {
      fetchMapData(filters);
    }
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS);
    setMapLoaded(false);
    fetchPage(0, EMPTY_FILTERS);
  }

  function goToPage(page: number) {
    fetchPage(page, filters);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-black text-white overflow-x-hidden font-sans">
      <Sidebar view={view} setView={setView} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 p-4 md:p-8 overflow-y-auto lg:pl-64">
        <div className="max-w-7xl mx-auto" ref={topRef}>
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

          {/* ── Search & Filters ──────────────────────────────────────── */}
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

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-8 bg-zinc-950 border border-zinc-900 rounded-[2rem] animate-in fade-in slide-in-from-top-4 duration-300 shadow-2xl">
                {([
                  ['Gênero', 'genderIdentity', enumOptions.genderIdentity, 'Todos'],
                  ['Religião', 'macroReligion', enumOptions.macroReligion, 'Todas'],
                  ['Política', 'politicalLeaning', enumOptions.politicalLeaning, 'Todas'],
                  ['Cluster Ideológico', 'nomeGrupo', enumOptions.nomeGrupo, 'Todos'],
                  ['Classe Social', 'socialClass', enumOptions.socialClass, 'Todas'],
                  ['Estado Civil', 'civilStatus', enumOptions.civilStatus, 'Todos'],
                  ['Escolaridade', 'educationLevel', enumOptions.educationLevel, 'Todas'],
                  ['DISC Dominante', 'discMainFactor', enumOptions.discMainFactor, 'Todos'],
                  ['Arquétipo', 'archetypePrimary', enumOptions.archetypePrimary, 'Todos'],
                  ['Geração', 'generation', enumOptions.generation, 'Todas'],
                  ['Cronotipo', 'cronotype', enumOptions.cronotype, 'Todos'],
                  ['Região', 'regionBr', enumOptions.regionBr, 'Todas'],
                  ['Tipo de Área', 'areaType', enumOptions.areaType, 'Todos'],
                  ['Voto 2022', 'voto2022', enumOptions.voto2022, 'Todos'],
                  ['Aprovação Lula', 'aprovacaoLula', enumOptions.aprovacaoLula, 'Todas'],
                  ['Recebe Benefício', 'recebeBeneficio', enumOptions.recebeBeneficio, 'Todos'],
                ] as [string, keyof Filters, string[], string][]).map(([label, key, options, placeholder]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">{label}</label>
                    <select 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                      value={filters[key]}
                      onChange={(e) => setFilters({...filters, [key]: e.target.value})}
                    >
                      <option value="">{placeholder}</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Etnia</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300 text-sm appearance-none cursor-pointer"
                    value={filters.ethnicity}
                    onChange={(e) => setFilters({...filters, ethnicity: e.target.value})}
                  >
                    <option value="">Todas</option>
                    {['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Faixa Etária</label>
                  <div className="flex items-center gap-3">
                    <input type="number" placeholder="Mín" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm" value={filters.minAge} onChange={(e) => setFilters({...filters, minAge: e.target.value})} />
                    <span className="text-zinc-700 text-xs">até</span>
                    <input type="number" placeholder="Máx" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm" value={filters.maxAge} onChange={(e) => setFilters({...filters, maxAge: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Renda Individual</label>
                  <div className="flex items-center gap-3">
                    <input type="number" placeholder="Mín" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm" value={filters.minIncome} onChange={(e) => setFilters({...filters, minIncome: e.target.value})} />
                    <span className="text-zinc-700 text-xs">até</span>
                    <input type="number" placeholder="Máx" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm" value={filters.maxIncome} onChange={(e) => setFilters({...filters, maxIncome: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Score Econômico</label>
                  <div className="flex items-center gap-3">
                    <input type="number" step="0.1" min="-1" max="1" placeholder="-1" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm" value={filters.minScoreEconomico} onChange={(e) => setFilters({...filters, minScoreEconomico: e.target.value})} />
                    <span className="text-zinc-700 text-xs">até</span>
                    <input type="number" step="0.1" min="-1" max="1" placeholder="+1" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm" value={filters.maxScoreEconomico} onChange={(e) => setFilters({...filters, maxScoreEconomico: e.target.value})} />
                  </div>
                  <p className="text-[9px] text-zinc-600 px-2">-1 = Estado forte | +1 = Mercado livre</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 px-2">Score Costumes</label>
                  <div className="flex items-center gap-3">
                    <input type="number" step="0.1" min="-1" max="1" placeholder="-1" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm" value={filters.minScoreCostumes} onChange={(e) => setFilters({...filters, minScoreCostumes: e.target.value})} />
                    <span className="text-zinc-700 text-xs">até</span>
                    <input type="number" step="0.1" min="-1" max="1" placeholder="+1" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-sm" value={filters.maxScoreCostumes} onChange={(e) => setFilters({...filters, maxScoreCostumes: e.target.value})} />
                  </div>
                  <p className="text-[9px] text-zinc-600 px-2">-1 = Progressista | +1 = Conservador</p>
                </div>

                <div className="flex items-end lg:col-span-2">
                  <button
                    onClick={handleClearFilters}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-3"
                  >
                    Limpar todos os filtros
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Counter Badge ──────────────────────────────────────────── */}
          {!loading && !error && (
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-sm">
                <Users size={14} className="text-zinc-500" />
                <span className="text-xs font-bold text-zinc-300 tabular-nums">
                  {totalCount.toLocaleString('pt-BR')} personas
                </span>
              </div>
              {view === 'grid' && totalPages > 1 && (
                <span className="text-[11px] text-zinc-500 font-medium">
                  Mostrando {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} de {totalCount.toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          )}

          {/* ── Content ───────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
              <p className="text-xs text-zinc-500">Carregando personas...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-red-500/30 rounded-3xl bg-red-500/5">
              <p className="text-red-400 text-sm mb-4">Erro ao carregar personas: {error}</p>
              <button
                onClick={() => fetchPage(currentPage, filters)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] rounded-xl font-medium text-sm active:scale-[0.97] transition-all duration-200"
              >
                Tentar novamente
              </button>
            </div>
          ) : view === 'grid' ? (
            <>
              {/* Lista de personas */}
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

              {/* ── Paginação ─────────────────────────────────────────── */}
              {totalPages > 1 && (
                <nav className="flex items-center justify-center gap-2 mt-10 mb-6">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-zinc-900 border border-zinc-800/50 rounded-xl text-sm font-bold text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>

                  <div className="flex items-center gap-1.5">
                    {generatePageNumbers(currentPage, totalPages).map((pageNum, i) => 
                      pageNum === -1 ? (
                        <span key={`ellipsis-${i}`} className="w-10 h-10 flex items-center justify-center text-zinc-600 text-sm">...</span>
                      ) : (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 ${
                            pageNum === currentPage
                              ? 'bg-white text-black shadow-lg shadow-white/10'
                              : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800/50 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      )
                    )}
                  </div>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-zinc-900 border border-zinc-800/50 rounded-xl text-sm font-bold text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Próxima
                    <ChevronRight size={16} />
                  </button>
                </nav>
              )}
            </>
          ) : (
            /* ── Mapa Interativo ──────────────────────────────────────── */
            <div className="h-[700px]">
              {mapLoading ? (
                <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                  <p className="text-xs text-zinc-500">Carregando mapa...</p>
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

// ── Pagination helper ────────────────────────────────────────────────────
function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }

  const pages: number[] = [];

  // Always show first page
  pages.push(0);

  if (current > 2) {
    pages.push(-1); // ellipsis
  }

  // Pages around current
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 3) {
    pages.push(-1); // ellipsis
  }

  // Always show last page
  pages.push(total - 1);

  return pages;
}
