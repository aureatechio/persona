"""V2 Database layer — operates ONLY on v2_* tables."""

from __future__ import annotations

import uuid as _uuid
import logging

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET, SIGNED_URL_EXPIRY

logger = logging.getLogger("v2-worker.db")

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

WORKER_ID = str(_uuid.uuid4())


# ─── Claim / Lock ─────────────────────────────────────────────

def claim_queued():
    """Atomically claim the oldest queued v2 selfie."""
    try:
        res = client.rpc("v2_claim_next_selfie", {"worker_id": WORKER_ID}).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass
    return None


def fetch_resumable():
    """Claim a v2 selfie stuck in an intermediate state (crash recovery)."""
    try:
        res = client.rpc("v2_claim_stuck_selfie", {"worker_id": WORKER_ID}).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass
    return None


def run_watchdog() -> int:
    """Auto-fail v2 selfies stuck for >30 minutes."""
    try:
        res = client.rpc("v2_watchdog_stuck_selfies", {}).execute()
        return int(res.data) if res.data else 0
    except Exception:
        return 0


# ─── Status / Heartbeat ──────────────────────────────────────

def update_status(selfie_id: str, status: str, **extra):
    """Update v2 selfie status, renew lock, and set optional extra fields."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    data = {"status": status, "updated_at": now, "locked_at": now, **extra}
    client.table("v2_video_selfies").update(data).eq("id", selfie_id).execute()


def get_selfie(selfie_id: str):
    """Fetch a single v2 selfie by ID."""
    res = (
        client.table("v2_video_selfies")
        .select("*")
        .eq("id", selfie_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def heartbeat(selfie_id: str):
    """Renew locked_at to prevent reclaim during long-running steps."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    try:
        client.table("v2_video_selfies").update(
            {"locked_at": now, "updated_at": now}
        ).eq("id", selfie_id).execute()
    except Exception:
        pass


# ─── WhatsApp claim ──────────────────────────────────────────

def claim_whatsapp_send(selfie_id: str) -> bool:
    """Atomically claim the WhatsApp send for a v2 selfie."""
    try:
        res = client.rpc("v2_claim_whatsapp_send", {"selfie_id": selfie_id}).execute()
        result = bool(res.data)
        logger.info("v2_claim_whatsapp_send for %s returned: %s", selfie_id, result)
        return result
    except Exception as e:
        logger.error("v2_claim_whatsapp_send failed for %s: %s — refusing to send", selfie_id, e)
        return False


def reset_whatsapp_claim(selfie_id: str):
    """Reset whatsapp_sent so the send can be retried."""
    try:
        client.table("v2_video_selfies").update({
            "whatsapp_sent": False,
            "whatsapp_sent_at": None,
        }).eq("id", selfie_id).execute()
    except Exception as e:
        logger.error("Failed to reset whatsapp_sent for %s: %s", selfie_id, e)


# ─── Base model / Themes ─────────────────────────────────────

def get_base_model(base_model_id: str):
    """Get a v2 base model by id."""
    res = (
        client.table("v2_base_models")
        .select("*")
        .eq("id", base_model_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


_themes_cache: list[dict] | None = None


def get_themes_template(force_refresh: bool = False) -> list[dict]:
    """Load themes from v2_themes_template (cached in memory)."""
    global _themes_cache
    if _themes_cache is not None and not force_refresh:
        return _themes_cache
    try:
        res = (
            client.table("v2_themes_template")
            .select("slug, label, category, priority, description, is_default, display_order")
            .order("display_order")
            .execute()
        )
        _themes_cache = res.data or []
    except Exception as e:
        logger.error("get_themes_template failed: %s", e)
        _themes_cache = []
    return _themes_cache


def get_theme_model(base_model_id: str, theme_slug: str) -> dict | None:
    """Get v2_theme_models row for (base_model_id, theme_slug)."""
    if not (base_model_id and theme_slug):
        return None
    try:
        res = (
            client.table("v2_theme_models")
            .select("id, theme_slug, video_storage_path, is_uploaded")
            .eq("base_model_id", base_model_id)
            .eq("theme_slug", theme_slug)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as e:
        logger.warning("get_theme_model failed for (%s, %s): %s", base_model_id, theme_slug, e)
        return None


# ─── Cache ────────────────────────────────────────────────────

def find_cached_name_sync(base_model_id: str, first_name: str, theme_slug: str) -> dict | None:
    """Cache do name_sync (~3s lipsync) por (base_model_id, first_name, theme_slug)."""
    if not (base_model_id and first_name and theme_slug):
        return None
    try:
        res = (
            client.table("v2_video_selfies")
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
        logger.warning("find_cached_name_sync failed: %s", e)
        return None


def find_cached_video(base_model_id: str, first_name: str, theme_slug: str, strategy: str | None = None) -> dict | None:
    """Cache de lipsync longo (full_video ou legacy)."""
    if not (base_model_id and first_name and theme_slug):
        return None
    try:
        query = (
            client.table("v2_video_selfies")
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
        logger.warning("find_cached_video failed: %s", e)
        return None


# ─── TTS concurrency ─────────────────────────────────────────

def count_tts_in_progress() -> int:
    """Count v2 selfies currently in 'generating_tts' status."""
    try:
        res = (
            client.table("v2_video_selfies")
            .select("id", count="exact")
            .eq("status", "generating_tts")
            .execute()
        )
        return res.count or 0
    except Exception:
        return 0


# ─── Sync Labs key pool (shared with V1 — same API keys) ─────

def claim_sync_slot(selfie_id: str) -> str | None:
    """Claim a Sync Labs key slot (least-loaded)."""
    try:
        res = client.rpc("claim_kling_slot", {"p_selfie_id": selfie_id}).execute()
        key_id = res.data if res.data else None
        if key_id:
            logger.info("Sync slot claimed for %s on key %s", selfie_id, str(key_id)[:8])
        return key_id
    except Exception as e:
        logger.error("claim_sync_slot failed for %s: %s", selfie_id, e)
        return None


def release_sync_slot(selfie_id: str):
    """Release the Sync Labs slot."""
    try:
        client.rpc("release_kling_slot", {"p_selfie_id": selfie_id}).execute()
    except Exception as e:
        logger.warning("release_sync_slot failed for %s: %s", selfie_id, e)


def get_sync_key(key_id: str) -> dict | None:
    """Fetch access_key and secret_key for a Sync Labs key."""
    try:
        res = client.rpc("get_kling_key", {"p_key_id": key_id}).execute()
        return res.data[0] if res.data else None
    except Exception:
        return None


def block_sync_key(key_id: str, minutes: int = 15):
    """Temporarily block a Sync Labs key after 401/402."""
    try:
        client.rpc("block_kling_key", {"p_key_id": key_id, "p_minutes": minutes}).execute()
        logger.warning("Sync key %s blocked for %d min", str(key_id)[:8], minutes)
    except Exception as e:
        logger.error("block_sync_key failed: %s", e)


# ─── Storage ─────────────────────────────────────────────────

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
    return res.get("signedUrl") or res.get("signedURL") or ""
