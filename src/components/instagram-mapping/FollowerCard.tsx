'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Brain, ChevronDown, ChevronUp, ExternalLink, Crosshair, Trash2 } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
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

  const hasPost = showPost && post;

  return (
    <div
      className="animate-card-reveal"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <a
        href={`https://instagram.com/${follower.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'group relative block cursor-pointer',
          'bg-white/[0.03] hover:bg-white/[0.06]',
          'border border-white/[0.06] hover:border-white/[0.12]',
          'rounded-2xl overflow-hidden',
          'transition-all duration-300 ease-out',
          'hover:-translate-y-0.5',
        )}
      >
        {/* ── Post image + targeting header (inside same card) ── */}
        {hasPost && (
          <div
            className="animate-post-slide-down"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            {/* Targeting header */}
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <Crosshair size={12} className="text-emerald-400 shrink-0" />
              <p className="text-[10px] uppercase tracking-widest text-emerald-500/70 font-medium">
                Para o seu perfil, essa postagem ira atingi-lo
              </p>
            </div>

            {/* Post image area */}
            <div className="relative mx-4 rounded-xl overflow-hidden">
              {post.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.image_url}
                  alt={post.title || 'Post'}
                  className="w-full h-44 object-cover"
                />
              ) : (
                /* Static placeholder image */
                <div className="w-full h-44 bg-gradient-to-br from-emerald-500/[0.12] via-violet-500/[0.08] to-cyan-500/[0.12] relative">
                  {/* Decorative grid */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.06)_1px,_transparent_0)] bg-[size:20px_20px]" />
                  {/* Center logo/icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] grid place-content-center">
                      <Crosshair size={24} className="text-emerald-400/60" />
                    </div>
                  </div>
                  {/* Bottom gradient overlay for text readability */}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
                  {/* Post title overlay on image */}
                  {post.title && (
                    <div className="absolute bottom-0 inset-x-0 px-4 pb-3">
                      <p className="text-sm font-bold text-white tracking-tight drop-shadow-lg">
                        {post.title}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Title overlay for real images too */}
              {post.image_url && post.title && (
                <>
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 px-4 pb-3">
                    <p className="text-sm font-bold text-white tracking-tight drop-shadow-lg">
                      {post.title}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Post description + tags */}
            <div className="px-4 pt-3 pb-4">
              {post.description && (
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-2">
                  {post.description}
                </p>
              )}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] text-emerald-400/60 bg-emerald-500/[0.08] px-2 py-0.5 rounded-md"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Subtle divider between post and follower info */}
            <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
        )}

        {/* ── Follower info section ── */}
        <div className="relative p-4 md:p-5">
          {/* Delete button (admin only) */}
          {isAdmin && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
              disabled={deleting}
              className={cn(
                'absolute top-3 right-3 p-1.5 rounded-lg z-10',
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
                  <p className={cn(
                    'text-xs text-zinc-400 leading-relaxed whitespace-pre-line',
                    !expanded && 'line-clamp-3',
                  )}>
                    {follower.ai_summary}
                  </p>
                  {/* Expand / Collapse + AI badge */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-violet-400 animate-ai-dot-1" />
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ai-dot-2" />
                      <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ai-dot-3" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Analisado por IA</span>
                    {follower.ai_summary.length > 150 && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(!expanded); }}
                        className="ml-auto inline-flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors duration-200"
                      >
                        {expanded ? (
                          <>Recolher <ChevronUp size={10} /></>
                        ) : (
                          <>Ver analise completa <ChevronDown size={10} /></>
                        )}
                      </button>
                    )}
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
        </div>
      </a>
    </div>
  );
}
