// Arena PWA — Bottom tab bar (mobile-style)

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, BarChart3, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

const TABS = [
  { href: '/arena', label: 'Voto', icon: MessageCircle },
  { href: '/arena/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/arena/mapa', label: 'Mapa', icon: MapPin },
] as const;

export function ArenaNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-2xl border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = tab.href === '/arena'
            ? pathname === '/arena'
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:scale-95 transition-transform duration-150"
            >
              <Icon
                size={20}
                className={isActive ? 'text-emerald-400' : 'text-zinc-600'}
              />
              <span className={`text-[10px] font-bold tracking-wide ${
                isActive ? 'text-emerald-400' : 'text-zinc-600'
              }`}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="arena-tab-indicator"
                  className="absolute bottom-0 left-[20%] right-[20%] h-0.5 rounded-full bg-emerald-400"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
