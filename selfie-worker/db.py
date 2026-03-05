from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET, SIGNED_URL_EXPIRY

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def claim_queued():
    """Atomically claim the oldest queued selfie (set status to 'transcribing').
    Returns dict or None. Uses RPC for atomic UPDATE ... RETURNING."""
    try:
        res = client.rpc("claim_next_selfie", {}).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        # Fallback: non-atomic fetch (for when RPC doesn't exist yet)
        res = (
            client.table("video_selfies")
            .select("*")
            .eq("status", "queued")
            .order("created_at")
            .limit(1)
            .execute()
        )
        if res.data:
            item = res.data[0]
            # Try to claim it by updating status
            client.table("video_selfies").update(
                {"status": "transcribing"}
            ).eq("id", item["id"]).eq("status", "queued").execute()
            item["status"] = "transcribing"
            return item
    return None


def fetch_resumable():
    """Fetch selfies stuck in intermediate states (crash recovery).
    Only picks up items older than 5 minutes to avoid race conditions."""
    stuck_statuses = [
        "transcribing",
        "generating_text",
        "generating_tts",
        "generating_lipsync",
        "composing",
        "sending",
    ]
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()

    res = (
        client.table("video_selfies")
        .select("*")
        .in_("status", stuck_statuses)
        .lt("updated_at", cutoff)
        .order("created_at")
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def update_status(selfie_id: str, status: str, **extra):
    """Update selfie status and optional extra fields."""
    from datetime import datetime, timezone

    data = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat(), **extra}
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
