"""
Loads AI prompts from Supabase `arena_prompts` table.
Falls back to hardcoded defaults if Supabase is unreachable.
No cache — always fetches fresh so prompt changes take effect immediately.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def load_prompt(prompt_id: str, fallback: str | None = None) -> str | None:
    """
    Load a prompt by ID from Supabase (always fresh).
    Returns the prompt content string, or the fallback if not found.
    """
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
            print(f"[PromptLoader] ✓ Loaded '{prompt_id}' from Supabase ({len(content)} chars)", flush=True)
            return content

        print(f"[PromptLoader] ✗ No active prompt for '{prompt_id}', using fallback", flush=True)
        return fallback
    except Exception as exc:
        print(f"[PromptLoader] ✗ Failed to load '{prompt_id}': {exc} — using fallback", flush=True)
        return fallback
