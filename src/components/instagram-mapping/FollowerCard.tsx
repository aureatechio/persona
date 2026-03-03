'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Brain, ExternalLink, Hash, Trash2 } from 'lucide-react';
import { CATEGORY_MAP } from '@/lib/instagram-mapping/categories';
import type { InstagramFollower, GeneratedPost } from '@/lib/instagram-mapping/types';

interface FollowerCardProps {
  follower: InstagramFollower;
  post?: GeneratedPost | null;
  showPost?: boolean;
  index?: number;
  isAdmin?: boolean;
  onDeleted?: () => void;
}

export function FollowerCard({ follower, post, showPost = false, index = 0, isAdmin = false, onDeleted }: FollowerCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);
  const category = CATEGORY_MAP[follower.category] || CATEGORY_MAP.outro;
  const initials = (follower.display_name || follower.username).slice(0, 2).toUpperCase();
  const handleImgError = useCallback(() => setImgError(true), []);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/instagram-mapping/followers?id=${follower.id}`, { method: 'DELETE' });
      if (res.ok) onDeleted?.();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="animate-card-reveal"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Generated post section (appears above when showPost) */}
      {showPost && post && (
        <div
          className="animate-post-slide-down bg-gradient-to-r from-emerald-500/[0.06] via-white/[0.03] to-violet-500/[0.06] border border-emerald-500/20 rounded-2xl px-4"
          style={{ animationDelay: `${index * 150}ms` }}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 p-2 rounded-xl bg-emerald-500/10 mt-0.5">
              <Hash size={14} className="text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-emerald-500/60 mb-1">
                Postagem gerada
              </p>
              {post.title && (
                <p className="text-sm font-semibold text-white tracking-tight mb-1">
                  {post.title}
                </p>
              )}
              {post.description && (
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                  {post.description}
                </p>
              )}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {post.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] text-emerald-400/60 bg-emerald-500/[0.06] px-1.5 py-0.5 rounded-md"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Follower card */}
      <a
        href={`https://instagram.com/${follower.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'group relative block cursor-pointer',
          'bg-white/[0.03] hover:bg-white/[0.06]',
          'border border-white/[0.06] hover:border-white/[0.12]',
          'rounded-2xl p-4 md:p-5',
          'transition-all duration-300 ease-out',
          'hover:-translate-y-0.5',
          showPost && post && 'rounded-t-none border-t-0',
        )}
      >
        {/* Delete button (admin only) */}
        {isAdmin && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
            disabled={deleting}
            className={cn(
              'absolute top-3 right-3 p-1.5 rounded-lg',
              'text-zinc-600 hover:text-red-400',
              'hover:bg-red-500/10',
              'opacity-0 group-hover:opacity-100',
              'transition-all duration-200',
              'disabled:opacity-50',
              deleting && 'opacity-100',
            )}
          >
            {deleting ? (
              <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        )}

        <div className="flex items-start gap-4">
          {/* Avatar with AI pulse ring */}
          <div className="relative shrink-0">
            <div className="animate-ai-analyze-pulse rounded-full p-[2px]">
              {follower.avatar_url && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={follower.avatar_url}
                  alt={follower.username}
                  referrerPolicy="no-referrer"
                  onError={handleImgError}
                  className="w-11 h-11 rounded-full object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 grid place-content-center text-sm font-bold text-zinc-300 border border-white/[0.06]">
                  {initials}
                </div>
              )}
            </div>
            {/* AI indicator */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zinc-950 border border-white/[0.08] grid place-content-center">
              <Brain size={10} className="text-violet-400 animate-glow-pulse" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-white tracking-tight truncate">
                {follower.display_name || follower.username}
              </p>
              {/* Category badge */}
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5',
                  'border rounded-full text-[10px] font-medium shrink-0',
                  category.bgColor,
                  category.color,
                  category.borderColor,
                )}
              >
                {category.label}
              </span>
            </div>

            <p className="text-xs text-zinc-500 mb-2 inline-flex items-center gap-1">
              @{follower.username}
              <ExternalLink size={10} className="text-zinc-600 group-hover:text-pink-400 transition-colors duration-200" />
            </p>

            {/* AI Summary */}
            {follower.ai_summary ? (
              <div className="relative">
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                  {follower.ai_summary}
                </p>
                {/* AI analyzed badge */}
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-violet-400 animate-ai-dot-1" />
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ai-dot-2" />
                    <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ai-dot-3" />
                  </div>
                  <span className="text-[10px] text-zinc-600">Analisado por IA</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <div className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-ai-dot-1" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-ai-dot-2" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-ai-dot-3" />
                </div>
                <span className="text-[10px] text-zinc-600">Aguardando analise...</span>
              </div>
            )}
          </div>
        </div>
      </a>
    </div>
  );
}
