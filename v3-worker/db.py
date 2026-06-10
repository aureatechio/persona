"""V3 Database layer — operates ONLY on v3_* tables."""

from __future__ import annotations

import uuid as _uuid
import logging

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET, SIGNED_URL_EXPIRY

logger = logging.getLogger("v3-worker.db")

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

WORKER_ID = str(_uuid.uuid4())


def claim_queued():
    try:
        res = client.rpc("v3_claim_next_selfie", {"worker_id": WORKER_ID}).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass
    return None


def fetch_resumable():
    try:
        res = client.rpc("v3_claim_stuck_selfie", {"worker_id": WORKER_ID}).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass
    return None


def run_watchdog() -> int:
    try:
        res = client.rpc("v3_watchdog_stuck_selfies", {}).execute()
        return int(res.data) if res.data else 0
    except Exception:
        return 0


def update_status(selfie_id: str, status: str, **extra):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    data = {"status": status, "updated_at": now, "locked_at": now, **extra}
    client.table("v3_video_selfies").update(data).eq("id", selfie_id).execute()


def get_selfie(selfie_id: str):
    res = client.table("v3_video_selfies").select("*").eq("id", selfie_id).limit(1).execute()
    return res.data[0] if res.data else None


def heartbeat(selfie_id: str):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    try:
        client.table("v3_video_selfies").update({"locked_at": now, "updated_at": now}).eq("id", selfie_id).execute()
    except Exception:
        pass


def claim_whatsapp_send(selfie_id: str) -> bool:
    try:
        res = client.rpc("v3_claim_whatsapp_send", {"selfie_id": selfie_id}).execute()
        return bool(res.data)
    except Exception:
        return False


def reset_whatsapp_claim(selfie_id: str):
    try:
        client.table("v3_video_selfies").update({"whatsapp_sent": False, "whatsapp_sent_at": None}).eq("id", selfie_id).execute()
    except Exception:
        pass


def get_base_model(base_model_id: str):
    res = client.table("v3_base_models").select("*").eq("id", base_model_id).limit(1).execute()
    return res.data[0] if res.data else None


_themes_cache: list[dict] | None = None


def get_themes_template(force_refresh: bool = False) -> list[dict]:
    global _themes_cache
    if _themes_cache is not None and not force_refresh:
        return _themes_cache
    try:
        res = client.table("v2_themes_template").select("slug, label, category, priority, description, is_default, display_order").order("display_order").execute()
        _themes_cache = res.data or []
    except Exception:
        _themes_cache = []
    return _themes_cache


def get_theme_script(base_model_id: str, theme_slug: str) -> str | None:
    if not (base_model_id and theme_slug):
        return None
    try:
        res = client.table("v3_theme_scripts").select("script_text").eq("base_model_id", base_model_id).eq("theme_slug", theme_slug).limit(1).execute()
        return res.data[0]["script_text"] if res.data else None
    except Exception:
        return None


def find_cached_lipsync(base_model_id: str, first_name: str, theme_slug: str) -> dict | None:
    if not (base_model_id and first_name and theme_slug):
        return None
    try:
        res = (
            client.table("v3_video_selfies")
            .select("id, lipsync_cached_path, generated_text, theme_slug, first_name")
            .eq("base_model_id", base_model_id)
            .eq("first_name", first_name)
            .eq("theme_slug", theme_slug)
            .eq("status", "completed")
            .is_("cached_from", "null")
            .not_.is_("lipsync_cached_path", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception:
        return None


def count_tts_in_progress() -> int:
    try:
        res = client.table("v3_video_selfies").select("id", count="exact").eq("status", "generating_tts").execute()
        return res.count or 0
    except Exception:
        return 0


def claim_sync_slot(selfie_id: str) -> str | None:
    try:
        res = client.rpc("claim_kling_slot", {"p_selfie_id": selfie_id}).execute()
        key_id = res.data if res.data else None
        if key_id:
            logger.info("Sync slot claimed for %s on key %s", selfie_id, str(key_id)[:8])
        return key_id
    except Exception:
        return None


def release_sync_slot(selfie_id: str):
    try:
        client.rpc("release_kling_slot", {"p_selfie_id": selfie_id}).execute()
    except Exception:
        pass


def get_sync_key(key_id: str) -> dict | None:
    try:
        res = client.rpc("get_kling_key", {"p_key_id": key_id}).execute()
        return res.data[0] if res.data else None
    except Exception:
        return None


def block_sync_key(key_id: str, minutes: int = 15):
    try:
        client.rpc("block_kling_key", {"p_key_id": key_id, "p_minutes": minutes}).execute()
    except Exception:
        pass


def download_file(path: str) -> bytes:
    return client.storage.from_(STORAGE_BUCKET).download(path)


def upload_file(path: str, data: bytes, content_type: str = "video/mp4"):
    client.storage.from_(STORAGE_BUCKET).upload(path, data, file_options={"content-type": content_type, "upsert": "true"})


def create_signed_url(path: str) -> str:
    res = client.storage.from_(STORAGE_BUCKET).create_signed_url(path, SIGNED_URL_EXPIRY)
    return res.get("signedUrl") or res.get("signedURL") or ""
