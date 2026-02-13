"""
Tracking de uso de tokens. Atualiza contadores no Supabase.
"""
from __future__ import annotations

from persona_chat.data.supabase_client import get_supabase


def update_chat_usage(chat_id: str, prompt_tokens: int, output_tokens: int) -> None:
    """Incrementa contadores de tokens no chat."""
    sb = get_supabase()

    # Busca valores atuais
    result = sb.table("chats").select("total_prompt_tokens, total_output_tokens").eq("id", chat_id).execute()
    if not result.data:
        return

    current = result.data[0]
    current_prompt = current.get("total_prompt_tokens") or 0
    current_output = current.get("total_output_tokens") or 0

    sb.table("chats").update({
        "total_prompt_tokens": current_prompt + prompt_tokens,
        "total_output_tokens": current_output + output_tokens,
    }).eq("id", chat_id).execute()


def update_user_usage(user_id: str, prompt_tokens: int, output_tokens: int) -> None:
    """Incrementa contadores de tokens no usuario."""
    sb = get_supabase()

    result = sb.table("users").select("total_prompt_tokens, total_output_tokens").eq("id", user_id).execute()
    if not result.data:
        return

    current = result.data[0]
    current_prompt = current.get("total_prompt_tokens") or 0
    current_output = current.get("total_output_tokens") or 0

    sb.table("users").update({
        "total_prompt_tokens": current_prompt + prompt_tokens,
        "total_output_tokens": current_output + output_tokens,
    }).eq("id", user_id).execute()
