from __future__ import annotations

import uuid as _uuid

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET, SIGNED_URL_EXPIRY

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Unique ID for this worker instance — used for distributed locking
WORKER_ID = str(_uuid.uuid4())


def claim_queued():
    """Atomically claim the oldest queued selfie (set status to 'transcribing').
    Now also sets locked_by and locked_at atomically.
    Returns dict or None. Uses RPC for atomic UPDATE ... RETURNING."""
    try:
        res = client.rpc("claim_next_selfie", {"worker_id": WORKER_ID}).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass
    return None


def fetch_resumable():
    """Atomically claim a selfie stuck in an intermediate state (crash recovery).
    Only picks up items whose lock expired (>10 min) via RPC with FOR UPDATE SKIP LOCKED."""
    try:
        res = client.rpc("claim_stuck_selfie", {"worker_id": WORKER_ID}).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass
    return None


def run_watchdog() -> int:
    """Auto-fail selfies stuck for >30 minutes. Returns count of affected rows."""
    try:
        res = client.rpc("watchdog_stuck_selfies", {}).execute()
        return int(res.data) if res.data else 0
    except Exception:
        return 0


def run_auto_confirm_uploads() -> dict:
    """Recupera selfies presas em 'uploading' devido a rede instável do eleitor.

    Promove pra 'queued' quando o arquivo já chegou ao Storage há > 2min
    (eleitor terminou o PUT mas nunca chamou /confirm-upload). Marca como
    'failed' quando NÃO chegou ao Storage há > 10min (rede do eleitor caiu
    durante o PUT). Retorna {"confirmed": N, "failed": M}.
    """
    try:
        res = client.rpc("auto_confirm_uploads", {}).execute()
        return res.data if isinstance(res.data, dict) else {"confirmed": 0, "failed": 0}
    except Exception as e:
        import logging
        logging.getLogger("worker.db").warning("auto_confirm_uploads failed: %s", e)
        return {"confirmed": 0, "failed": 0}


def update_status(selfie_id: str, status: str, **extra):
    """Update selfie status, renew lock, and set optional extra fields."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    data = {"status": status, "updated_at": now, "locked_at": now, **extra}
    client.table("video_selfies").update(data).eq("id", selfie_id).execute()


def get_selfie(selfie_id: str):
    """Fetch a single selfie by ID. Returns dict or None."""
    res = (
        client.table("video_selfies")
        .select("*")
        .eq("id", selfie_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def heartbeat(selfie_id: str):
    """Renew locked_at to prevent claim_stuck_selfie from reclaiming this item.
    Called during long-running steps like lip-sync polling."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    try:
        client.table("video_selfies").update(
            {"locked_at": now, "updated_at": now}
        ).eq("id", selfie_id).execute()
    except Exception:
        pass  # Non-critical — worst case the lock expires and gets reclaimed


def claim_whatsapp_send(selfie_id: str) -> bool:
    """Atomically claim the WhatsApp send for a selfie.
    Uses PostgreSQL RPC — only succeeds if whatsapp_sent is not already true.
    Returns True if this caller should send, False if already sent.
    NO FALLBACK: if the RPC fails, we refuse to send (safe default)."""
    import logging
    logger = logging.getLogger("worker.db")

    try:
        res = client.rpc("claim_whatsapp_send", {"selfie_id": selfie_id}).execute()
        result = bool(res.data)
        logger.info("claim_whatsapp_send RPC for %s returned: %s", selfie_id, result)
        return result
    except Exception as e:
        logger.error("claim_whatsapp_send RPC failed for %s: %s — refusing to send (safe default)", selfie_id, e)
        return False


def reset_whatsapp_claim(selfie_id: str):
    """Reset whatsapp_sent to false so the send can be retried."""
    import logging
    logger = logging.getLogger("worker.db")
    try:
        client.table("video_selfies").update({
            "whatsapp_sent": False,
            "whatsapp_sent_at": None,
        }).eq("id", selfie_id).execute()
        logger.info("Reset whatsapp_sent for %s", selfie_id)
    except Exception as e:
        logger.error("Failed to reset whatsapp_sent for %s: %s", selfie_id, e)


def claim_kling_slot(selfie_id: str) -> str | None:
    """Atomically claim a Kling slot (least-loaded key).
    Returns kling_key_id (UUID string) or None if all keys are full."""
    import logging
    logger = logging.getLogger("worker.db")
    try:
        res = client.rpc("claim_kling_slot", {"p_selfie_id": selfie_id}).execute()
        key_id = res.data if res.data else None
        if key_id:
            logger.info("Kling slot claimed for %s on key %s", selfie_id, str(key_id)[:8])
        return key_id
    except Exception as e:
        logger.error("claim_kling_slot failed for %s: %s", selfie_id, e)
        return None


def release_kling_slot(selfie_id: str):
    """Release the Kling slot (called in finally block)."""
    import logging
    logger = logging.getLogger("worker.db")
    try:
        client.rpc("release_kling_slot", {"p_selfie_id": selfie_id}).execute()
        logger.info("Kling slot released for %s", selfie_id)
    except Exception as e:
        logger.warning("release_kling_slot failed for %s: %s (will auto-expire in 40min)", selfie_id, e)


def get_kling_key(key_id: str) -> dict | None:
    """Fetch access_key and secret_key for a Kling key."""
    try:
        res = client.rpc("get_kling_key", {"p_key_id": key_id}).execute()
        return res.data[0] if res.data else None
    except Exception:
        return None


def block_kling_key(key_id: str, minutes: int = 15) -> None:
    """Temporarily remove a key from the pool after a 401/402 from Sync Labs.
    The next claim_kling_slot won't see this key until blocked_until elapses."""
    import logging
    logger = logging.getLogger("worker.db")
    try:
        client.rpc("block_kling_key", {"p_key_id": key_id, "p_minutes": minutes}).execute()
        logger.warning("Sync Labs key %s blocked for %d min", str(key_id)[:8], minutes)
    except Exception as e:
        logger.error("block_kling_key failed for %s: %s", key_id, e)


def count_tts_in_progress() -> int:
    """Count how many selfies are currently in 'generating_tts' status.
    Used to limit concurrent ElevenLabs API calls."""
    import logging
    logger = logging.getLogger("worker.db")
    try:
        res = (
            client.table("video_selfies")
            .select("id", count="exact")
            .eq("status", "generating_tts")
            .execute()
        )
        return res.count or 0
    except Exception as e:
        logger.warning("count_tts_in_progress failed: %s — assuming 0", e)
        return 0


def get_active_base_model():
    """DEPRECATED fallback — prefer get_base_model(id).

    Kept temporarily so selfies without base_model_id (legacy rows) still
    resolve to the single is_active model. Remove after F3 (base_model_id
    NOT NULL) is applied and confirmed in production.
    """
    res = (
        client.table("video_base_models")
        .select("*, voice_models(*)")
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def get_base_model(base_model_id: str):
    """Get a specific base model by id, with voice_models joined.

    This is the primary lookup after multi-politician rollout: the worker
    uses selfie['base_model_id'] (set at upload time via the per-politician
    URL) to pick the correct video/voice/prompt/closing.
    """
    res = (
        client.table("video_base_models")
        .select("*, voice_models(*)")
        .eq("id", base_model_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


# ─── Novos helpers do fluxo por tema (AM) ─────────────────────

_themes_cache: list[dict] | None = None


def get_themes_template(force_refresh: bool = False) -> list[dict]:
    """
    Carrega os 31 temas (30 latentes do AM + ``padrao``) da tabela
    ``themes_template``. Cache em memória: a tabela é praticamente
    estática e é lida a cada selfie no classifier.
    """
    global _themes_cache
    if _themes_cache is not None and not force_refresh:
        return _themes_cache
    try:
        res = (
            client.table("themes_template")
            .select("slug, label, category, priority, description, is_default, display_order")
            .order("display_order")
            .execute()
        )
        _themes_cache = res.data or []
    except Exception as e:
        import logging
        logging.getLogger("worker.db").error("get_themes_template failed: %s", e)
        _themes_cache = []
    return _themes_cache


def get_theme_model(base_model_id: str, theme_slug: str) -> dict | None:
    """
    Retorna a row de ``video_theme_models`` para (base_model_id, theme_slug)
    com video_storage_path e is_uploaded. Decide se vamos pelo fluxo NOVO
    (is_uploaded=true) ou fallback (legacy).
    """
    if not (base_model_id and theme_slug):
        return None
    try:
        res = (
            client.table("video_theme_models")
            .select("id, theme_slug, video_storage_path, is_uploaded")
            .eq("base_model_id", base_model_id)
            .eq("theme_slug", theme_slug)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as e:
        import logging
        logging.getLogger("worker.db").warning(
            "get_theme_model failed for (%s, %s): %s", base_model_id, theme_slug, e,
        )
        return None


def find_cached_name_sync(
    base_model_id: str, first_name: str, theme_slug: str
) -> dict | None:
    """
    Cache do sync do nome (~3s lipsync "{Nome}, obrigado pelo seu vídeo!").
    Agora indexado por (base_model_id, first_name, theme_slug) porque o
    lipsync usa o vídeo do tema como input visual — então o name_sync
    "joão+educacao" tem visual diferente do "joão+saude" e não pode ser
    reusado entre temas.
    """
    if not (base_model_id and first_name and theme_slug):
        return None
    try:
        res = (
            client.table("video_selfies")
            .select("id, name_sync_cached_path, first_name, theme_slug")
            .eq("base_model_id", base_model_id)
            .eq("first_name", first_name)
            .eq("theme_slug", theme_slug)
            .eq("status", "completed")
            .is_("cached_from", "null")
            .not_.is_("name_sync_cached_path", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as e:
        import logging
        logging.getLogger("worker.db").warning(
            "find_cached_name_sync failed for (%s, %s, %s): %s",
            base_model_id, first_name, theme_slug, e,
        )
        return None


def find_cached_video(
    base_model_id: str, first_name: str, theme_slug: str, strategy: str | None = None
) -> dict | None:
    """
    Cache de lipsync longo (full_video ou legacy). Discriminado por
    video_strategy porque os dois fluxos geram visuais diferentes:
    full_video usa o video do tema como visual; legacy usa o base
    "neutro" do candidato. Mesma (first_name, theme_slug) com strategy
    diferente NÃO bate cache.

    Filtra rows originais (cached_from IS NULL), completadas e com
    lipsync persistido (lipsync_cached_path NOT NULL).
    """
    if not (base_model_id and first_name and theme_slug):
        return None
    try:
        query = (
            client.table("video_selfies")
            .select("id, lipsync_cached_path, generated_text, theme_slug, first_name, video_strategy")
            .eq("base_model_id", base_model_id)
            .eq("first_name", first_name)
            .eq("theme_slug", theme_slug)
            .eq("status", "completed")
            .is_("cached_from", "null")
            .not_.is_("lipsync_cached_path", "null")
        )
        if strategy:
            query = query.eq("video_strategy", strategy)
        res = query.order("created_at", desc=True).limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        import logging
        logging.getLogger("worker.db").warning(
            "find_cached_video failed for (%s, %s, %s, %s): %s",
            base_model_id, first_name, theme_slug, strategy, e,
        )
        return None


def download_file(path: str) -> bytes:
    """Download a file from Supabase Storage."""
    return client.storage.from_(STORAGE_BUCKET).download(path)


def upload_file(path: str, data: bytes, content_type: str = "video/mp4"):
    """Upload a file to Supabase Storage (upsert)."""
    client.storage.from_(STORAGE_BUCKET).upload(
        path, data, file_options={"content-type": content_type, "upsert": "true"}
    )


def create_signed_url(path: str) -> str:
    """Create a signed URL for a Storage file."""
    res = client.storage.from_(STORAGE_BUCKET).create_signed_url(path, SIGNED_URL_EXPIRY)
    # supabase-py returns both "signedURL" and "signedUrl"
    return res.get("signedUrl") or res.get("signedURL") or ""
