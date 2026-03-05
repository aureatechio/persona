"""Step 4: Submit and poll lip-sync job (Sync Labs or Kling AI)."""

import time
import logging
import requests

from config import LIPSYNC_PROVIDER, SYNC_API_KEY, KLING_API_BASE

logger = logging.getLogger("worker.lipsync")

POLL_INTERVAL = 5  # seconds
MAX_POLL_TIME = 1800  # 30 minutes max wait


# ============ SYNC LABS ============

def _sync_submit(video_url: str, audio_url: str) -> str:
    if not SYNC_API_KEY:
        raise RuntimeError("SYNC_API_KEY not configured")

    logger.info("Submitting lip-sync job to Sync Labs...")

    response = requests.post(
        "https://api.sync.so/v2/generate",
        headers={
            "Content-Type": "application/json",
            "x-api-key": SYNC_API_KEY,
        },
        json={
            "model": "lipsync-2-pro",
            "input": [
                {"type": "video", "url": video_url},
                {"type": "audio", "url": audio_url},
            ],
            "options": {"sync_mode": "cut_off"},
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    job_id = data.get("id")
    if not job_id:
        raise RuntimeError(f"Sync Labs submit: no id in response: {data}")

    logger.info("Sync Labs job submitted: %s", job_id)
    return job_id


def _sync_poll(job_id: str) -> str:
    logger.info("Polling Sync Labs job '%s'...", job_id)
    start = time.time()

    while True:
        elapsed = time.time() - start
        if elapsed > MAX_POLL_TIME:
            raise RuntimeError(f"Sync Labs job {job_id} timed out after {MAX_POLL_TIME}s")

        response = requests.get(
            f"https://api.sync.so/v2/generate/{job_id}",
            headers={"x-api-key": SYNC_API_KEY},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        status = data.get("status", "")
        logger.info("Sync Labs status: %s (%.0fs elapsed)", status, elapsed)

        if status == "COMPLETED":
            video_url = data.get("outputUrl") or data.get("output_url", "")
            if video_url:
                logger.info("Sync Labs complete: %s", video_url[:80])
                return video_url
            raise RuntimeError("Sync Labs completed but no outputUrl in response")

        if status in ("FAILED", "REJECTED"):
            err_msg = data.get("error") or f"Sync Labs job {status}"
            raise RuntimeError(f"Sync Labs failed: {err_msg}")

        time.sleep(POLL_INTERVAL)


# ============ KLING AI ============

def _kling_generate_token(access_key: str, secret_key: str) -> str:
    import jwt
    import math
    now = math.floor(time.time())
    payload = {
        "iss": access_key,
        "exp": now + 1800,
        "nbf": now - 5,
        "iat": now,
    }
    return jwt.encode(payload, secret_key, algorithm="HS256")


def _kling_submit(video_url: str, audio_url: str, access_key: str, secret_key: str) -> str:
    if not access_key or not secret_key:
        raise RuntimeError("Kling credentials not provided")

    max_attempts = 5
    for attempt in range(max_attempts):
        token = _kling_generate_token(access_key, secret_key)
        logger.info("Submitting lip-sync job to Kling AI... (attempt %d/%d)", attempt + 1, max_attempts)

        response = requests.post(
            f"{KLING_API_BASE}/v1/videos/lip-sync",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            json={
                "input": {
                    "mode": "audio2video",
                    "video_url": video_url,
                    "audio_type": "url",
                    "audio_url": audio_url,
                },
            },
            timeout=30,
        )

        if response.status_code == 429:
            wait = min(30 * (2 ** attempt), 300)
            logger.warning("Kling 429 rate limit — waiting %ds before retry...", wait)
            time.sleep(wait)
            continue

        response.raise_for_status()
        break
    else:
        raise RuntimeError("Kling AI rate limit (429) after 5 attempts")

    data = response.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Kling submit error: {data.get('message', data)}")

    task_id = data.get("data", {}).get("task_id")
    if not task_id:
        raise RuntimeError(f"Kling submit: no task_id in response: {data}")

    logger.info("Kling lip-sync job submitted: %s", task_id)
    return task_id


def _kling_poll(job_id: str, access_key: str, secret_key: str) -> str:
    logger.info("Polling Kling lip-sync job '%s'...", job_id)
    start = time.time()

    while True:
        elapsed = time.time() - start
        if elapsed > MAX_POLL_TIME:
            raise RuntimeError(f"Kling lip-sync job {job_id} timed out after {MAX_POLL_TIME}s")

        token = _kling_generate_token(access_key, secret_key)
        response = requests.get(
            f"{KLING_API_BASE}/v1/videos/lip-sync/{job_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        if data.get("code") != 0:
            raise RuntimeError(f"Kling poll error: {data.get('message', data)}")

        task_status = data.get("data", {}).get("task_status", "")
        logger.info("Kling lip-sync status: %s (%.0fs elapsed)", task_status, elapsed)

        if task_status == "succeed":
            video_url = (
                data.get("data", {})
                .get("task_result", {})
                .get("videos", [{}])[0]
                .get("url", "")
            )
            if video_url:
                logger.info("Kling lip-sync complete: %s", video_url[:80])
                return video_url
            raise RuntimeError("Kling completed but no video URL in response")

        if task_status == "failed":
            err_msg = data.get("data", {}).get("task_status_msg", "Kling job failed")
            raise RuntimeError(f"Kling lip-sync failed: {err_msg}")

        time.sleep(POLL_INTERVAL)


# ============ PUBLIC API ============

def run_lipsync(video_url: str, audio_url: str, kling_access_key: str = "", kling_secret_key: str = "") -> str:
    """Submit and poll lip-sync. Returns output video URL.
    For Kling provider, credentials must be passed (from DB key pool)."""
    provider = LIPSYNC_PROVIDER
    logger.info("Lip-sync provider: %s", provider)

    if provider == "sync":
        job_id = _sync_submit(video_url, audio_url)
        return _sync_poll(job_id)

    job_id = _kling_submit(video_url, audio_url, kling_access_key, kling_secret_key)
    return _kling_poll(job_id, kling_access_key, kling_secret_key)
