"""Submit and poll a lip-sync job via Sync Labs."""

import time
import logging
import requests

from config import SYNC_API_KEY

logger = logging.getLogger("worker.lipsync")

POLL_INTERVAL = 5
MAX_POLL_TIME = 1800
SUBMIT_MAX_ATTEMPTS = 5
TRANSIENT_POLL_ERRORS = 3


class SyncLabsJobFailed(RuntimeError):
    """Sync Labs returned FAILED/REJECTED — distinct from transient errors."""
    pass


def _submit(
    video_url: str,
    audio_url: str,
    model: str = "lipsync-2-pro",
    sync_mode: str = "cut_off",
    temperature: float = 0.3,
) -> str:
    if not SYNC_API_KEY:
        raise RuntimeError("SYNC_API_KEY not configured")

    for attempt in range(SUBMIT_MAX_ATTEMPTS):
        logger.info("Submitting lip-sync (attempt %d/%d, model=%s, sync=%s, temp=%.1f)",
                    attempt + 1, SUBMIT_MAX_ATTEMPTS, model, sync_mode, temperature)

        response = requests.post(
            "https://api.sync.so/v2/generate",
            headers={"Content-Type": "application/json", "x-api-key": SYNC_API_KEY},
            json={
                "model": model,
                "input": [
                    {"type": "video", "url": video_url},
                    {"type": "audio", "url": audio_url},
                ],
                "options": {"sync_mode": sync_mode, "temperature": temperature},
            },
            timeout=30,
        )

        if response.status_code == 429:
            wait = min(30 * (2 ** attempt), 300)
            logger.warning("Sync Labs 429 — waiting %ds before retry", wait)
            time.sleep(wait)
            continue

        if response.status_code in (401, 402):
            raise SyncLabsJobFailed(
                f"Sync Labs key rejected ({response.status_code}): {response.text[:200]}"
            )

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


def _poll(job_id: str, heartbeat_fn=None) -> str:
    logger.info("Polling Sync Labs job '%s'...", job_id)
    start = time.time()
    transient = 0
    last_heartbeat = time.time()

    while True:
        elapsed = time.time() - start
        if elapsed > MAX_POLL_TIME:
            raise RuntimeError(f"Sync Labs job {job_id} timed out after {MAX_POLL_TIME}s")

        if heartbeat_fn and (time.time() - last_heartbeat) >= 60:
            try:
                heartbeat_fn()
            except Exception:
                pass
            last_heartbeat = time.time()

        try:
            response = requests.get(
                f"https://api.sync.so/v2/generate/{job_id}",
                headers={"x-api-key": SYNC_API_KEY},
                timeout=15,
            )
            if response.status_code in (500, 502, 503, 504):
                transient += 1
                if transient > TRANSIENT_POLL_ERRORS:
                    raise RuntimeError(
                        f"Sync Labs polling: {transient} server errors (last {response.status_code})"
                    )
                logger.warning("Sync Labs transient %d (%d/%d)", response.status_code, transient, TRANSIENT_POLL_ERRORS)
                time.sleep(POLL_INTERVAL * 2)
                continue
            response.raise_for_status()
            transient = 0
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            transient += 1
            if transient > TRANSIENT_POLL_ERRORS:
                raise RuntimeError(f"Sync Labs polling failed: {e}")
            logger.warning("Sync Labs network error (%d/%d): %s", transient, TRANSIENT_POLL_ERRORS, e)
            time.sleep(POLL_INTERVAL * 2)
            continue

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
            err = data.get("error") or f"Sync Labs job {status}"
            raise SyncLabsJobFailed(f"Sync Labs failed: {err}")

        time.sleep(POLL_INTERVAL)


def run_lipsync(
    video_url: str,
    audio_url: str,
    heartbeat_fn=None,
    model: str = "lipsync-2-pro",
    sync_mode: str = "cut_off",
    temperature: float = 0.3,
) -> tuple[str, str]:
    """Submit + poll. Returns (job_id, output_video_url)."""
    job_id = _submit(video_url, audio_url, model=model, sync_mode=sync_mode, temperature=temperature)
    output_url = _poll(job_id, heartbeat_fn=heartbeat_fn)
    return job_id, output_url
