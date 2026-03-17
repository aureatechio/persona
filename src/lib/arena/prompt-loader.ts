/**
 * Loads AI prompts from Supabase `arena_prompts` table.
 * Falls back to hardcoded defaults if Supabase is unreachable.
 * In-memory cache with 5-minute TTL to avoid per-request DB hits.
 */

import { supabaseAdmin } from '../supabase-admin';

interface CacheEntry {
  content: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Load a prompt by ID from Supabase (cached).
 * Returns the prompt content string, or null if not found.
 */
export async function loadPrompt(id: string): Promise<string | null> {
  // Check cache
  const cached = cache.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.content;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('arena_prompts')
      .select('content')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data?.content) {
      console.warn(`[prompt-loader] No active prompt for "${id}":`, error?.message);
      return null;
    }

    cache.set(id, { content: data.content, fetchedAt: Date.now() });
    return data.content;
  } catch (err) {
    console.error(`[prompt-loader] Failed to load prompt "${id}":`, err);
    return null;
  }
}

/** Invalidate a specific cached prompt (useful after edits). */
export function invalidatePromptCache(id?: string) {
  if (id) {
    cache.delete(id);
  } else {
    cache.clear();
  }
}
