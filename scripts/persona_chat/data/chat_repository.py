"""
Repositorio de mensagens do chat.
Busca historico recente para contexto de conversa.
"""
from __future__ import annotations

from typing import Any

from persona_chat.config import settings
from persona_chat.data.supabase_client import get_supabase


def get_recent_messages(chat_id: str, limit: int | None = None) -> list[dict[str, Any]]:
    """Busca as ultimas N mensagens do chat, ordenadas cronologicamente."""
    if limit is None:
        limit = settings.chat_memory_size

    sb = get_supabase()
    result = (
        sb.table("messages")
        .select("message, bot_message, created_at")
        .eq("chat_id", chat_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    if not result.data:
        return []

    # Retorna em ordem cronologica (mais antiga primeiro)
    return list(reversed(result.data))
