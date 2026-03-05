"""Step 4: Submit and poll lip-sync job via Kling AI."""

import time
import logging
import jwt
import math
import requests

from config import KLING_ACCESS_KEY, KLING_SECRET_KEY, KLING_API_BASE

logger = logging.getLogger("worker.lipsync")

POLL_INTERVAL = 5  # seconds
MAX_POLL_TIME = 1800  # 30 minutes max wait


def _generate_token() -> str:
    """Generate a JWT token for Kling AI API authentication."""
    now = math.floor(time.time())
    payload = {
        "iss": KLING_ACCESS_KEY,
        "exp": now + 1800,  # 30 min
        "nbf": now - 5,
        "iat": now,
    }
    return jwt.encode(payload, KLING_SECRET_KEY, algorithm="HS256")


def submit_lipsync(video_url: str, audio_url: str) -> str:
    """
    Submit a lip-sync job to Kling AI.
    Returns the task ID. Retries on 429 with exponential backoff.
    """
    if not KLING_ACCESS_KEY or not KLING_SECRET_KEY:
        raise RuntimeError("KLING_ACCESS_KEY ou KLING_SECRET_KEY nao configurados")

    max_attempts = 5
    for attempt in range(max_attempts):
        token = _generate_token()
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
            wait = min(30 * (2 ** attempt), 300)  # 30s, 60s, 120s, 240s, 300s
            logger.warning("Kling 429 rate limit — waiting %ds before retry...", wait)
            time.sleep(wait)
            continue

        response.raise_for_status()
        break
    else:
        raise RuntimeError("Kling AI rate limit (429) after 5 attempts (~12 min of waiting)")

    data = response.json()

    if data.get("code") != 0:
        raise RuntimeError(f"Kling submit error: {data.get('message', data)}")

    task_id = data.get("data", {}).get("task_id")
    if not task_id:
        raise RuntimeError(f"Kling submit: no task_id in response: {data}")

    logger.info("Kling lip-sync job submitted: %s", task_id)
    return task_id


def poll_lipsync(job_id: str) -> str:
    """
    Poll Kling AI until the job is complete.
    Returns the output video URL.
    Raises RuntimeError on failure or timeout.
    """
    logger.info("Polling Kling lip-sync job '%s'...", job_id)
    start = time.time()

    while True:
        elapsed = time.time() - start
        if elapsed > MAX_POLL_TIME:
            raise RuntimeError(f"Kling lip-sync job {job_id} timed out after {MAX_POLL_TIME}s")

        token = _generate_token()
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

        # submitted, processing, etc.
        time.sleep(POLL_INTERVAL)


def run_lipsync(video_url: str, audio_url: str) -> str:
    """Submit and poll Kling lip-sync. Returns output video URL."""
    job_id = submit_lipsync(video_url, audio_url)
    return poll_lipsync(job_id)
