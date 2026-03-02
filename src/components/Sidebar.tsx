'use client';

import { List, Map as MapIcon, Settings, LogOut, Users, Activity, Swords, Brain } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { ComponentType } from 'react';

interface SidebarProps {
  view?: 'grid' | 'map';
  setView?: (view: 'grid' | 'map') => void;
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  active: boolean;
  href: string;
}

export function Sidebar({ view, setView, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const isPersonas = pathname === '/personas';

  const menuItems: MenuItem[] = [
    { id: 'arena', label: 'Pulse Arena', icon: Activity, active: pathname === '/', href: '/' },
    { id: 'eleitoral', label: 'Arena Eleitoral', icon: Swords, active: pathname === '/arena-eleitoral', href: '/arena-eleitoral' },
    { id: 'analise-redes', label: 'Análise de Redes', icon: Brain, active: pathname === '/analise-redes', href: '/analise-redes' },
    { id: 'grid', label: 'Lista de Personas', icon: List, active: view === 'grid' && isPersonas, href: '/personas?view=grid' },
    { id: 'map', label: 'Mapa Interativo', icon: MapIcon, active: view === 'map' && isPersonas, href: '/personas?view=map' },
  ];

  const handleNavigation = (item: { id: string; href: string }) => {
    const isHomeView = item.id === 'grid' || item.id === 'map';
    if (isPersonas && setView && isHomeView) {
      setView(item.id as 'grid' | 'map');
      onClose();
    } else {
      router.push(item.href);
      onClose();
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col h-screen transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-10">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
                <div className="w-4 h-4 bg-black rounded-sm rotate-45" />
              </div>
              <span className="text-xl font-bold tracking-tight">Persona</span>
            </Link>
          </div>

          <nav className="space-y-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4 mb-4">Navegação</p>
            
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigation(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  item.active 
                    ? 'bg-white text-black font-semibold shadow-lg shadow-white/5' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <item.icon size={20} />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}

            {profile?.user_type === 'admin' && (
              <button
                onClick={() => handleNavigation({ id: 'users', href: '/users' })}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  pathname === '/users'
                    ? 'bg-white text-black font-semibold shadow-lg shadow-white/5'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Users size={20} />
                <span className="text-sm">Usuários</span>
              </button>
            )}
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-2 border-t border-zinc-900">
          <div className="px-4 py-3 mb-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Logado como</p>
            <p className="text-sm font-semibold text-white truncate">{profile?.name || 'Usuário'}</p>
            <p className="text-[10px] text-zinc-500 truncate">{profile?.email}</p>
          </div>

          <Link 
            href="/settings"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
              pathname === '/settings'
                ? 'bg-white text-black font-semibold shadow-lg shadow-white/5'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Settings size={20} />
            <span className="text-sm">Configurações</span>
          </Link>
          
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={20} />
            <span className="text-sm">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
