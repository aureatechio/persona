'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, Users, ChevronDown, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { profile, signOut } = useAuth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200',
          'hover:bg-white/[0.06] active:scale-[0.97]',
          open && 'bg-white/[0.06]'
        )}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-white/[0.1] flex items-center justify-center">
          <span className="text-xs font-bold text-white">{initials}</span>
        </div>
        <ChevronDown
          size={14}
          className={cn('text-zinc-500 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-950/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden animate-fade-in-up">
          {/* User info */}
          <div className="px-4 py-4 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-white truncate">{profile?.name || 'Usuario'}</p>
            <p className="text-xs text-zinc-500 truncate">{profile?.email}</p>
          </div>

          <div className="py-1.5">
            {profile?.user_type === 'admin' && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/[0.06] transition-colors duration-200"
              >
                <ShieldCheck size={16} />
                Painel Admin
              </Link>
            )}

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors duration-200"
            >
              <Settings size={16} />
              Configuracoes
            </Link>

            {profile?.user_type === 'admin' && (
              <Link
                href="/users"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors duration-200"
              >
                <Users size={16} />
                Usuarios
              </Link>
            )}

            <div className="h-px bg-white/[0.06] my-1" />

            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors duration-200"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
