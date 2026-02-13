"""
Repositorio de personas com cache in-memory (TTL configuravel).
"""
from __future__ import annotations

import time
from typing import Any

from persona_chat.config import settings
from persona_chat.data.supabase_client import get_supabase

_cache: dict[str, tuple[dict[str, Any], float]] = {}


def get_persona(persona_id: str) -> dict[str, Any] | None:
    """Busca persona por ID com cache."""
    now = time.time()
    cached = _cache.get(persona_id)
    if cached and (now - cached[1]) < settings.persona_cache_ttl:
        return cached[0]

    sb = get_supabase()
    result = sb.table("personas").select("*").eq("id", persona_id).execute()

    if not result.data:
        return None

    persona = result.data[0]
    _cache[persona_id] = (persona, now)
    return persona
