'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PersonaCard } from '@/components/PersonaCard';
import { Search, Filter, Map as MapIcon, List } from 'lucide-react';
import dynamic from 'next/dynamic';

const PersonaMap = dynamic(() => import('@/components/PersonaMap'), { 
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center bg-zinc-900 animate-pulse">Carregando mapa...</div>
});

export default function Home() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [filters, setFilters] = useState({
    search: '',
    gender: '',
    state: '',
  });

  useEffect(() => {
    fetchPersonas();
  }, []);

  async function fetchPersonas() {
    setLoading(true);
    let query = supabase.from('personas').select('*');

    if (filters.gender) query = query.eq('gender', filters.gender);
    if (filters.state) query = query.eq('state', filters.state);
    if (filters.search) query = query.ilike('name', `%${filters.search}%`);

    const { data, error } = await query;

    if (!error && data) {
      setPersonas(data);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-bold mb-2 tracking-tight">Persona</h1>
            <p className="text-zinc-400">Gerencie e interaja com suas personas sintéticas.</p>
          </div>

          <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button 
              onClick={() => setView('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${view === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <List size={18} />
              Lista
            </button>
            <button 
              onClick={() => setView('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${view === 'map' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <MapIcon size={18} />
              Mapa
            </button>
          </div>
        </header>

        <section className="mb-8 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar persona pelo nome..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:border-zinc-600 transition-colors"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              onKeyDown={(e) => e.key === 'Enter' && fetchPersonas()}
            />
          </div>
          
          <select 
            className="bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-4 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300"
            value={filters.gender}
            onChange={(e) => setFilters({...filters, gender: e.target.value})}
          >
            <option value="">Gênero: Todos</option>
            <option value="Masculino">Masculino</option>
            <option value="Feminino">Feminino</option>
            <option value="Outro">Outro</option>
          </select>

          <button 
            onClick={fetchPersonas}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <Filter size={18} />
            Filtrar
          </button>
        </section>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {personas.map(persona => (
              <PersonaCard key={persona.id} persona={persona} />
            ))}
            {personas.length === 0 && (
              <div className="col-span-full text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                Nenhuma persona encontrada com esses filtros.
              </div>
            )}
          </div>
        ) : (
          <div className="h-[600px]">
            <PersonaMap personas={personas} />
          </div>
        )}
      </div>
    </main>
  );
}
