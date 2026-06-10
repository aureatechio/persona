"""V2 Step 4: Submit and poll lip-sync job via Sync Labs."""

import time
import logging
import requests

from config import SYNC_API_KEY

logger = logging.getLogger("v2-worker.lipsync")

POLL_INTERVAL = 5
MAX_POLL_TIME = 1800
SUBMIT_MAX_ATTEMPTS = 5
TRANSIENT_POLL_ERRORS = 3


class SyncLabsJobFailed(RuntimeError):
    """Sync Labs job failed/rejected."""
    pass


class SyncLabsKeyRejected(SyncLabsJobFailed):
    """Sync Labs key was rejected (401/402)."""
    pass


def _submit(
    video_url: str,
    audio_url: str,
    api_key: str = "",
    model: str = "lipsync-2-pro",
    sync_mode: str = "loop",
    temperature: float = 0.3,
) -> str:
    key = api_key or SYNC_API_KEY
    if not key:
        raise RuntimeError("SYNC_API_KEY not configured")

    for attempt in range(SUBMIT_MAX_ATTEMPTS):
        logger.info(
            "Submitting lip-sync job (attempt %d/%d, model=%s, sync=%s, temp=%.1f)",
            attempt + 1, SUBMIT_MAX_ATTEMPTS, model, sync_mode, temperature,
        )

        response = requests.post(
            "https://api.sync.so/v2/generate",
            headers={
                "Content-Type": "application/json",
                "x-api-key": key,
            },
            json={
                "model": model,
                "input": [
                    {"type": "video", "url": video_url},
                    {"type": "audio", "url": audio_url},
                ],
                "options": {
                    "sync_mode": sync_mode,
                    "temperature": temperature,
                },
            },
            timeout=30,
        )

        if response.status_code == 429:
            wait = min(30 * (2 ** attempt), 300)
            logger.warning("Sync Labs 429 — waiting %ds...", wait)
            time.sleep(wait)
            continue

        if response.status_code in (401, 402):
            body = response.text
            raise SyncLabsKeyRejected(f"Sync Labs key rejected ({response.status_code}): {body[:200]}")

        response.raise_for_status()
        break
    else:
        raise RuntimeError("Sync Labs rate limit (429) after %d attempts" % SUBMIT_MAX_ATTEMPTS)

    data = response.json()
    job_id = data.get("id")
    if not job_id:
        raise RuntimeError(f"Sync Labs: no id in response: {data}")

    logger.info("Sync Labs job submitted: %s", job_id)
    return job_id


def _poll(job_id: str, api_key: str = "", heartbeat_fn=None) -> str:
    """Poll Sync Labs job until completion."""
    key = api_key or SYNC_API_KEY
    logger.info("Polling Sync Labs job '%s'...", job_id)
    start = time.time()
    transient_errors = 0
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
                headers={"x-api-key": key},
                timeout=15,
            )

            if response.status_code in (500, 502, 503, 504):
                transient_errors += 1
                if transient_errors > TRANSIENT_POLL_ERRORS:
                    raise RuntimeError(f"Sync Labs: {transient_errors} consecutive server errors")
                time.sleep(POLL_INTERVAL * 2)
                continue

            response.raise_for_status()
            transient_errors = 0

        except requests.exceptions.ConnectionError as e:
            transient_errors += 1
            if transient_errors > TRANSIENT_POLL_ERRORS:
                raise RuntimeError(f"Sync Labs: {transient_errors} connection errors: {e}")
            time.sleep(POLL_INTERVAL * 2)
            continue
        except requests.exceptions.Timeout:
            transient_errors += 1
            if transient_errors > TRANSIENT_POLL_ERRORS:
                raise RuntimeError(f"Sync Labs: {transient_errors} timeouts")
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
            raise RuntimeError("Sync Labs completed but no outputUrl")

        if status in ("FAILED", "REJECTED"):
            err_msg = data.get("error") or f"Sync Labs job {status}"
            raise SyncLabsJobFailed(f"Sync Labs failed: {err_msg}")

        time.sleep(POLL_INTERVAL)


def run_lipsync(
    video_url: str,
    audio_url: str,
    api_key: str = "",
    heartbeat_fn=None,
    model: str = "lipsync-2-pro",
    sync_mode: str = "loop",
    temperature: float = 0.3,
) -> str:
    """Submit and poll Sync Labs lip-sync. Returns output video URL."""
    job_id = _submit(video_url, audio_url, api_key=api_key, model=model, sync_mode=sync_mode, temperature=temperature)
    return _poll(job_id, api_key=api_key, heartbeat_fn=heartbeat_fn)
