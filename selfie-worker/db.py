from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET, SIGNED_URL_EXPIRY

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_queued():
    """Fetch the oldest queued selfie. Returns dict or None."""
    res = (
        client.table("video_selfies")
        .select("*")
        .eq("status", "queued")
        .order("created_at")
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def fetch_resumable():
    """Fetch selfies stuck in intermediate states (crash recovery)."""
    stuck_statuses = [
        "transcribing",
        "generating_text",
        "generating_tts",
        "generating_lipsync",
        "composing",
        "sending",
    ]
    res = (
        client.table("video_selfies")
        .select("*")
        .in_("status", stuck_statuses)
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
