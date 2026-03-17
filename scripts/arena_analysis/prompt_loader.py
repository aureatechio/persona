"""
Loads AI prompts from Supabase `arena_prompts` table.
Falls back to hardcoded defaults if Supabase is unreachable.
In-memory cache with 5-minute TTL.
"""
from __future__ import annotations

import time
import logging

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[str, float]] = {}
_CACHE_TTL = 300  # 5 minutes


async def load_prompt(prompt_id: str, fallback: str | None = None) -> str | None:
    """
    Load a prompt by ID from Supabase (cached).
    Returns the prompt content string, or the fallback if not found.
    """
    # Check cache
    cached = _cache.get(prompt_id)
    if cached and (time.time() - cached[1]) < _CACHE_TTL:
        return cached[0]

    try:
        from arena_analysis.config import settings
        from supabase import create_client

        client = create_client(settings.supabase_url, settings.supabase_key)
        result = (
            client.table("arena_prompts")
            .select("content")
            .eq("id", prompt_id)
            .eq("is_active", True)
            .single()
            .execute()
        )

        if result.data and result.data.get("content"):
            content = result.data["content"]
            _cache[prompt_id] = (content, time.time())
            print(f"[PromptLoader] ✓ Loaded '{prompt_id}' from Supabase ({len(content)} chars)", flush=True)
            return content

        print(f"[PromptLoader] ✗ No active prompt for '{prompt_id}', using fallback", flush=True)
        return fallback
    except Exception as exc:
        print(f"[PromptLoader] ✗ Failed to load '{prompt_id}': {exc} — using fallback", flush=True)
        return fallback


def invalidate_prompt_cache(prompt_id: str | None = None) -> None:
    """Invalidate a specific cached prompt or the entire cache."""
    if prompt_id:
        _cache.pop(prompt_id, None)
    else:
        _cache.clear()
