"""
Supia Video Pipeline Worker

Polls Supabase for queued supermarket videos and processes them through:
1. ElevenLabs TTS — fixed phrase with supermarket name interpolated
2. Sync Labs — lip-sync over a fixed AURORA base video
3. Re-host the result in Supabase Storage so it persists for the gallery

No transcription, no GPT, no compose, no WhatsApp.
"""

import logging
import signal
import sys
import time
import traceback

import requests

import db
from config import (
    POLL_INTERVAL,
    MAX_RETRIES,
    PHRASE_TEMPLATE,
    BASE_VIDEO_PATH,
)
from steps.tts import generate_tts
from steps.lipsync import run_lipsync, SyncLabsJobFailed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker")

_shutdown = False


def _handle_signal(signum, _frame):
    global _shutdown
    logger.info("Received signal %d, shutting down gracefully...", signum)
    _shutdown = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


# Pipeline state machine.
# Items in any non-terminal state past TTS are resumable on crash.
STEP_ORDER = ["queued", "generating_tts", "generating_lipsync", "finalizing"]


def _should_run(current_status: str, step_status: str) -> bool:
    try:
        return STEP_ORDER.index(current_status) <= STEP_ORDER.index(step_status)
    except ValueError:
        return False


def process_supia(item: dict):
    sid = item["id"]
    name = item["supermarket_name"]
    status = item["status"]
    logger.info("═══ Processing supia %s (status=%s, name=%s) ═══", sid, status, name)

    phrase = PHRASE_TEMPLATE.format(name=name)
    tts_path = item.get("tts_audio_path") or f"supia/tts/{sid}.mp3"

    # Step 1: TTS
    if _should_run(status, "generating_tts"):
        db.update_status(sid, "generating_tts")
        logger.info("Step 1/3: TTS — '%s'", phrase)
        audio = generate_tts(phrase)
        db.upload_file(tts_path, audio, "audio/mpeg")
        db.update_status(sid, "generating_lipsync", tts_audio_path=tts_path)
        item["tts_audio_path"] = tts_path

    # Step 2: Lip-sync
    if _should_run(status, "generating_lipsync"):
        existing_url = item.get("lipsync_video_url")
        if existing_url:
            logger.info("Step 2/3: lip-sync already complete, reusing url")
            lipsync_url = existing_url
        else:
            db.update_status(sid, "generating_lipsync")
            logger.info("Step 2/3: lip-sync (base=%s, audio=%s)", BASE_VIDEO_PATH, tts_path)
            video_signed = db.create_signed_url(BASE_VIDEO_PATH)
            audio_signed = db.create_signed_url(tts_path)

            try:
                job_id, lipsync_url = run_lipsync(
                    video_signed,
                    audio_signed,
                    heartbeat_fn=lambda: db.heartbeat(sid),
                )
                db.update_status(
                    sid,
                    "finalizing",
                    lipsync_job_id=job_id,
                    lipsync_video_url=lipsync_url,
                )
                item["lipsync_video_url"] = lipsync_url
            except SyncLabsJobFailed:
                # Clear stale lipsync state so retry can attempt cleanly
                db.update_status(sid, "generating_lipsync", lipsync_video_url=None)
                raise

    # Step 3: Finalize — pull the Sync Labs output and persist it in our Storage
    if _should_run(status, "finalizing"):
        if item.get("final_video_path"):
            logger.info("Step 3/3: already finalized, marking completed")
        else:
            db.update_status(sid, "finalizing")
            logger.info("Step 3/3: downloading lip-sync output and uploading to Storage")
            lipsync_url = item.get("lipsync_video_url") or db.get_supia(sid)["lipsync_video_url"]
            r = requests.get(lipsync_url, timeout=120)
            r.raise_for_status()
            final_bytes = r.content
            logger.info("Final video: %d bytes", len(final_bytes))

            final_path = f"supia/final/{sid}.mp4"
            db.upload_file(final_path, final_bytes, "video/mp4")
            db.update_status(sid, "completed", final_video_path=final_path)
            item["final_video_path"] = final_path

    logger.info("═══ Supia %s completed ═══", sid)


def main():
    logger.info("╔══════════════════════════════════════════╗")
    logger.info("║   Supia Video Worker — Starting...       ║")
    logger.info("╚══════════════════════════════════════════╝")

    from config import SUPABASE_URL, ELEVENLABS_API_KEY, SYNC_API_KEY
    missing = [k for k, v in {
        "SUPABASE_URL": SUPABASE_URL,
        "ELEVENLABS_API_KEY": ELEVENLABS_API_KEY,
        "SYNC_API_KEY": SYNC_API_KEY,
    }.items() if not v]
    if missing:
        logger.error("Missing env vars: %s", ", ".join(missing))
        sys.exit(1)

    logger.info("Worker ID: %s", db.WORKER_ID)
    logger.info("Polling every %ds. Max retries: %d", POLL_INTERVAL, MAX_RETRIES)

    consecutive_errors = 0
    watchdog_counter = 0

    while not _shutdown:
        try:
            watchdog_counter += 1
            if watchdog_counter >= 60:
                watchdog_counter = 0
                failed = db.run_watchdog()
                if failed:
                    logger.warning("Watchdog: marked %d stuck supias as failed", failed)

            item = db.claim_queued() or db.fetch_resumable()
            if not item:
                time.sleep(POLL_INTERVAL)
                continue

            consecutive_errors = 0
            retry_count = int(item.get("retry_count") or 0)
            sid = item["id"]

            if retry_count >= MAX_RETRIES:
                logger.warning("Supia %s already at retry %d — failing", sid, retry_count)
                db.update_status(sid, "failed", error_message=f"Max retries ({MAX_RETRIES}) exceeded")
                continue

            try:
                process_supia(item)
            except Exception as e:
                error_msg = str(e)
                logger.error("Pipeline error for %s: %s", sid, error_msg)
                logger.error(traceback.format_exc())

                current = db.get_supia(sid) or item
                current_status = current.get("status", "failed")
                new_retry = retry_count + 1

                if new_retry < MAX_RETRIES:
                    db.update_status(
                        sid,
                        current_status,
                        error_message=error_msg,
                        retry_count=new_retry,
                    )
                    logger.info("Retry %s from '%s' (attempt %d/%d)", sid, current_status, new_retry + 1, MAX_RETRIES)
                else:
                    db.update_status(
                        sid,
                        "failed",
                        error_message=f"Max retries exceeded: {error_msg}",
                        retry_count=new_retry,
                    )
                    logger.error("Supia %s failed permanently after %d retries", sid, MAX_RETRIES)

        except Exception as e:
            consecutive_errors += 1
            logger.error("Worker loop error: %s", e)
            logger.error(traceback.format_exc())
            wait = min(consecutive_errors * 5, 60)
            logger.info("Backing off %ds...", wait)
            time.sleep(wait)

    logger.info("Worker shut down.")


if __name__ == "__main__":
    main()
