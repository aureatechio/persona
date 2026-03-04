'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Instagram, Users } from 'lucide-react';
import type { InstagramAccount } from '@/lib/instagram-mapping/types';

interface AccountCardProps {
  account: InstagramAccount;
  onClick: () => void;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  const [imgError, setImgError] = useState(false);
  const handleImgError = useCallback(() => setImgError(true), []);
  const initials = (account.display_name || account.username).slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full text-left',
        'bg-white/[0.03] hover:bg-white/[0.06]',
        'border border-white/[0.06] hover:border-pink-500/30',
        'rounded-2xl p-5 md:p-6',
        'shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-pink-500/10',
        'hover:-translate-y-1',
        'transition-all duration-300 ease-out',
        'overflow-hidden cursor-pointer',
      )}
    >
      {/* Instagram gradient glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/[0.06] via-purple-500/[0.04] to-orange-500/[0.06] opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />

      {/* Glow orb */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-pink-500/[0.08] rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative">
        {/* Avatar + Instagram icon */}
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            {account.avatar_url && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/image-proxy?url=${encodeURIComponent(account.avatar_url)}`}
                alt={account.username}
                referrerPolicy="no-referrer"
                onError={handleImgError}
                className="w-14 h-14 rounded-full object-cover border-2 border-pink-500/30 group-hover:border-pink-500/50 transition-all duration-300"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-orange-500/20 border-2 border-pink-500/30 group-hover:border-pink-500/50 grid place-content-center text-lg font-bold text-pink-300 transition-all duration-300">
                {initials}
              </div>
            )}
            {/* Active indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-black flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
            </span>
          </div>

          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] group-hover:bg-pink-500/10 group-hover:border-pink-500/20 transition-all duration-300">
            <Instagram size={18} className="text-zinc-500 group-hover:text-pink-400 transition-colors duration-300" />
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1 mb-4">
          <h3 className="text-base font-semibold text-white tracking-tight truncate">
            {account.display_name || account.username}
          </h3>
          <p className="text-sm text-zinc-500">@{account.username}</p>
        </div>

        {/* Bio */}
        {account.bio && (
          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 mb-4">
            {account.bio}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-zinc-500" />
            <span className="text-xs text-zinc-400 font-medium">
              {account.follower_count} seguidores mapeados
            </span>
          </div>
          <div className="w-6 h-6 rounded-lg bg-white/[0.04] group-hover:bg-emerald-500/10 grid place-content-center transition-all duration-200">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-zinc-600 group-hover:text-emerald-400 transition-colors duration-200">
              <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}
