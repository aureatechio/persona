from __future__ import annotations

import logging
import uuid as _uuid
from datetime import datetime, timezone

from supabase import create_client

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET, SIGNED_URL_EXPIRY

logger = logging.getLogger("worker.db")

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
WORKER_ID = str(_uuid.uuid4())


def claim_queued() -> dict | None:
    """Atomically claim the oldest queued supia (set status to 'generating_tts')."""
    try:
        res = client.rpc("claim_next_supia", {"worker_id": WORKER_ID}).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        logger.warning("claim_next_supia failed: %s", e)
    return None


def fetch_resumable() -> dict | None:
    """Reclaim items abandoned by a dead worker (lock >5min)."""
    try:
        res = client.rpc("claim_stuck_supia", {"worker_id": WORKER_ID}).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        logger.warning("claim_stuck_supia failed: %s", e)
    return None


def run_watchdog() -> int:
    try:
        res = client.rpc("watchdog_stuck_supia", {}).execute()
        return int(res.data) if res.data else 0
    except Exception:
        return 0


def update_status(supia_id: str, status: str, **extra):
    now = datetime.now(timezone.utc).isoformat()
    data = {"status": status, "updated_at": now, "locked_at": now, **extra}
    client.table("supia_videos").update(data).eq("id", supia_id).execute()


def get_supia(supia_id: str) -> dict | None:
    res = (
        client.table("supia_videos")
        .select("*")
        .eq("id", supia_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def heartbeat(supia_id: str):
    """Renew locked_at to prevent claim_stuck_supia from reclaiming this row."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        client.table("supia_videos").update(
            {"locked_at": now, "updated_at": now}
        ).eq("id", supia_id).execute()
    except Exception:
        pass


def mark_webhook_delivered(supia_id: str):
    """Stamp webhook_delivered_at after a successful callback POST."""
    now = datetime.now(timezone.utc).isoformat()
    client.table("supia_videos").update(
        {"webhook_delivered_at": now}
    ).eq("id", supia_id).execute()


def download_file(path: str) -> bytes:
    return client.storage.from_(STORAGE_BUCKET).download(path)


def upload_file(path: str, data: bytes, content_type: str = "video/mp4"):
    client.storage.from_(STORAGE_BUCKET).upload(
        path, data, file_options={"content-type": content_type, "upsert": "true"}
    )


def create_signed_url(path: str) -> str:
    res = client.storage.from_(STORAGE_BUCKET).create_signed_url(path, SIGNED_URL_EXPIRY)
    return res.get("signedUrl") or res.get("signedURL") or ""
