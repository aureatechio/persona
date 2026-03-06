"""Step 4: Submit and poll lip-sync job via Sync Labs."""

import time
import logging
import requests

from config import SYNC_API_KEY

logger = logging.getLogger("worker.lipsync")

POLL_INTERVAL = 5  # seconds
MAX_POLL_TIME = 1800  # 30 minutes max wait
SUBMIT_MAX_ATTEMPTS = 5


def _submit(video_url: str, audio_url: str, api_key: str = "") -> str:
    key = api_key or SYNC_API_KEY
    if not key:
        raise RuntimeError("SYNC_API_KEY not configured")

    for attempt in range(SUBMIT_MAX_ATTEMPTS):
        logger.info("Submitting lip-sync job to Sync Labs... (attempt %d/%d)", attempt + 1, SUBMIT_MAX_ATTEMPTS)

        response = requests.post(
            "https://api.sync.so/v2/generate",
            headers={
                "Content-Type": "application/json",
                "x-api-key": key,
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

        if response.status_code == 429:
            wait = min(30 * (2 ** attempt), 300)
            logger.warning("Sync Labs 429 rate limit — waiting %ds before retry...", wait)
            time.sleep(wait)
            continue

        response.raise_for_status()
        break
    else:
        raise RuntimeError("Sync Labs rate limit (429) after %d attempts" % SUBMIT_MAX_ATTEMPTS)

    data = response.json()
    job_id = data.get("id")
    if not job_id:
        raise RuntimeError(f"Sync Labs submit: no id in response: {data}")

    logger.info("Sync Labs job submitted: %s", job_id)
    return job_id


def _poll(job_id: str, api_key: str = "") -> str:
    key = api_key or SYNC_API_KEY
    logger.info("Polling Sync Labs job '%s'...", job_id)
    start = time.time()

    while True:
        elapsed = time.time() - start
        if elapsed > MAX_POLL_TIME:
            raise RuntimeError(f"Sync Labs job {job_id} timed out after {MAX_POLL_TIME}s")

        response = requests.get(
            f"https://api.sync.so/v2/generate/{job_id}",
            headers={"x-api-key": key},
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


def run_lipsync(video_url: str, audio_url: str, api_key: str = "") -> str:
    """Submit and poll Sync Labs lip-sync. Returns output video URL."""
    job_id = _submit(video_url, audio_url, api_key=api_key)
    return _poll(job_id, api_key=api_key)
