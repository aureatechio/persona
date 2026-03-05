import uuid as _uuid

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET, SIGNED_URL_EXPIRY

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Unique ID for this worker instance — used for distributed locking
WORKER_ID = str(_uuid.uuid4())


def claim_queued():
    """Atomically claim the oldest queued selfie (set status to 'transcribing').
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
