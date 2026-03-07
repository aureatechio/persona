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
    """Get the active base model with voice_models joined."""
    res = (
        client.table("video_base_models")
        .select("*, voice_models(*)")
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


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
