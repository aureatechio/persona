"""Supabase helpers — load all personas in batches."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

_client = None


def get_client():
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client


def load_personas_count() -> int:
    """Get total persona count (fast, head-only)."""
    res = get_client().table("personas").select("id", count="exact").limit(0).execute()
    return res.count or 0


def load_personas_batch(offset: int, limit: int = 1000) -> list[dict]:
    """Load a page of personas."""
    res = (
        get_client()
        .table("personas")
        .select("*")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return res.data or []


def load_all_personas(on_batch=None) -> list[dict]:
    """Load every persona, calling on_batch(loaded, total, batch) per page."""
    total = load_personas_count()
    all_data: list[dict] = []
    batch_size = 1000

    for start in range(0, total, batch_size):
        batch = load_personas_batch(start, batch_size)
        if not batch:
            break
        all_data.extend(batch)
        if on_batch:
            on_batch(len(all_data), total, batch)

    return all_data
