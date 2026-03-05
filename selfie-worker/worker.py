"""
Selfie Video Pipeline Worker

Polls Supabase for queued selfie videos and processes them through:
1. Whisper (local) — transcription
2. GPT-4o — text generation
3. ElevenLabs — TTS with cloned voice
4. Sync Labs — lip-sync video
5. FFmpeg — normalize + concatenate
6. UAZAPI — send via WhatsApp

Runs as a long-lived daemon process. Handles retries and crash recovery.
"""

import signal
import sys
import time
import traceback
import logging

from config import POLL_INTERVAL, MAX_RETRIES
import db
from steps.transcribe import transcribe
from steps.generate import generate_text
from steps.tts import generate_tts
from steps.lipsync import run_lipsync
from steps.compose import compose_videos
from steps.whatsapp import send_whatsapp

# ─── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker")

# ─── Graceful shutdown ─────────────────────────────────────
_shutdown = False


def _handle_signal(signum, _frame):
    global _shutdown
    logger.info("Received signal %d, shutting down gracefully...", signum)
    _shutdown = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


# ─── Pipeline steps mapping ────────────────────────────────
# Each step knows which statuses mean "I need to run (or re-run) this step"
STEP_ORDER = [
    "queued",
    "transcribing",
    "generating_text",
    "generating_tts",
    "generating_lipsync",
    "composing",
    "sending",
]


def _should_run_step(current_status: str, step_status: str) -> bool:
    """Returns True if current_status means this step hasn't completed yet."""
    try:
        current_idx = STEP_ORDER.index(current_status)
        step_idx = STEP_ORDER.index(step_status)
        return current_idx <= step_idx
    except ValueError:
        return False


# ─── Main pipeline ─────────────────────────────────────────
def process_selfie(selfie: dict):
    """Run the full pipeline for a single selfie record."""
    sid = selfie["id"]
    status = selfie["status"]
    logger.info("═══ Processing selfie %s (status: %s, name: %s) ═══", sid, status, selfie["name"])

    # Fetch active base model
    base_model = db.get_active_base_model()
    if not base_model:
        db.update_status(sid, "failed", error_message="Nenhum modelo base ativo")
        logger.error("No active base model found")
        return

    voice_model = base_model.get("voice_models")
    if not voice_model or not voice_model.get("elevenlabs_voice_id"):
        db.update_status(sid, "failed", error_message="Modelo de voz sem voice_id")
        logger.error("Voice model not configured")
        return

    # ─── Step 1: Transcription ───
    if _should_run_step(status, "transcribing"):
        db.update_status(sid, "transcribing")
        logger.info("Step 1/6: Transcribing...")

        video_bytes = db.download_file(selfie["selfie_video_path"])
        ext = "webm" if selfie["selfie_video_path"].endswith(".webm") else "mp4"
        transcription = transcribe(video_bytes, ext)

        db.update_status(sid, "generating_text", transcription=transcription)
        selfie["transcription"] = transcription
    else:
        transcription = selfie.get("transcription", "")

    # ─── Step 2: Generate text ───
    if _should_run_step(status, "generating_text"):
        if selfie.get("status") != "generating_text":
            db.update_status(sid, "generating_text")
        logger.info("Step 2/6: Generating text...")

        prompt_template = base_model.get("prompt_template", "")
        generated_text = generate_text(selfie["name"], transcription, prompt_template)

        db.update_status(sid, "generating_tts", generated_text=generated_text)
        selfie["generated_text"] = generated_text
    else:
        generated_text = selfie.get("generated_text", "")

    # ─── Step 3: TTS ───
    if _should_run_step(status, "generating_tts"):
        if selfie.get("status") != "generating_tts":
            db.update_status(sid, "generating_tts")
        logger.info("Step 3/6: Generating TTS...")

        voice_id = voice_model["elevenlabs_voice_id"]
        audio_bytes = generate_tts(generated_text, voice_id)

        tts_path = f"tts/selfie_{sid}.mp3"
        db.upload_file(tts_path, audio_bytes, "audio/mpeg")

        db.update_status(sid, "generating_lipsync", tts_audio_path=tts_path)
        selfie["tts_audio_path"] = tts_path
    else:
        tts_path = selfie.get("tts_audio_path", f"tts/selfie_{sid}.mp3")

    # ─── Step 4: Lip-sync ───
    if _should_run_step(status, "generating_lipsync"):
        # Check if we already have a lipsync URL (from a previous partial run)
        if selfie.get("lipsync_video_url"):
            logger.info("Step 4/6: Lip-sync already complete, skipping...")
            lipsync_url = selfie["lipsync_video_url"]
        else:
            if selfie.get("status") != "generating_lipsync":
                db.update_status(sid, "generating_lipsync")
            logger.info("Step 4/6: Generating lip-sync...")

            # Create signed URLs for Sync Labs
            video_signed = db.create_signed_url(base_model["video_storage_path"])
            audio_signed = db.create_signed_url(tts_path)

            lipsync_url = run_lipsync(video_signed, audio_signed)
            db.update_status(sid, "composing", lipsync_video_url=lipsync_url)
            selfie["lipsync_video_url"] = lipsync_url
    else:
        lipsync_url = selfie.get("lipsync_video_url", "")

    # ─── Step 5: Compose (FFmpeg) ───
    if _should_run_step(status, "composing"):
        if selfie.get("status") != "composing":
            db.update_status(sid, "composing")
        logger.info("Step 5/6: Composing final video...")

        selfie_bytes = db.download_file(selfie["selfie_video_path"])
        ext = "webm" if selfie["selfie_video_path"].endswith(".webm") else "mp4"

        final_bytes = compose_videos(selfie_bytes, ext, lipsync_url)

        final_path = f"final/{sid}.mp4"
        db.upload_file(final_path, final_bytes, "video/mp4")

        db.update_status(sid, "sending", final_video_path=final_path)
        selfie["final_video_path"] = final_path
    else:
        final_path = selfie.get("final_video_path", f"final/{sid}.mp4")

    # ─── Step 6: WhatsApp ───
    if _should_run_step(status, "sending"):
        # Re-fetch from DB to check if another instance already sent
        fresh = db.get_selfie(sid)
        if fresh and fresh.get("whatsapp_sent"):
            logger.info("Step 6/6: WhatsApp already sent (confirmed from DB), skipping...")
        else:
            if selfie.get("status") != "sending":
                db.update_status(sid, "sending")
            logger.info("Step 6/6: Sending via WhatsApp...")

            video_signed = db.create_signed_url(final_path)
            send_whatsapp(selfie["phone"], selfie["name"], video_signed)

        from datetime import datetime, timezone

        db.update_status(
            sid,
            "completed",
            whatsapp_sent=True,
            whatsapp_sent_at=datetime.now(timezone.utc).isoformat(),
        )

    logger.info("═══ Selfie %s completed successfully ═══", sid)


# ─── Main loop ─────────────────────────────────────────────
def main():
    logger.info("╔══════════════════════════════════════════╗")
    logger.info("║   Selfie Video Worker — Starting...      ║")
    logger.info("╚══════════════════════════════════════════╝")

    # Validate config
    from config import SUPABASE_URL, OPENAI_API_KEY, ELEVENLABS_API_KEY, KLING_ACCESS_KEY, KLING_SECRET_KEY, UAZAPI_TOKEN

    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")
    if not ELEVENLABS_API_KEY:
        missing.append("ELEVENLABS_API_KEY")
    if not KLING_ACCESS_KEY:
        missing.append("KLING_ACCESS_KEY")
    if not KLING_SECRET_KEY:
        missing.append("KLING_SECRET_KEY")
    if not UAZAPI_TOKEN:
        missing.append("UAZAPI_TOKEN")

    if missing:
        logger.error("Missing environment variables: %s", ", ".join(missing))
        sys.exit(1)

    logger.info("Config OK. Polling every %ds. Max retries: %d", POLL_INTERVAL, MAX_RETRIES)

    consecutive_errors = 0

    while not _shutdown:
        try:
            # Priority 1: atomically claim queued items
            selfie = db.claim_queued()

            # Priority 2: stuck/resumable items (crash recovery, 5min grace)
            if not selfie:
                selfie = db.fetch_resumable()

            if selfie:
                consecutive_errors = 0
                try:
                    process_selfie(selfie)
                except Exception as e:
                    sid = selfie["id"]
                    error_msg = str(e)
                    logger.error("Pipeline error for %s: %s", sid, error_msg)
                    logger.error(traceback.format_exc())

                    # Count retries via error_message prefix
                    current_error = selfie.get("error_message") or ""
                    retry_count = current_error.count("[RETRY]")

                    if retry_count < MAX_RETRIES - 1:
                        # Mark for retry — keep current status so worker picks it up again
                        db.update_status(
                            sid,
                            selfie["status"],
                            error_message=f"[RETRY] {error_msg}",
                        )
                        logger.info("Will retry %s (attempt %d/%d)", sid, retry_count + 2, MAX_RETRIES)
                    else:
                        # Max retries exceeded
                        db.update_status(sid, "failed", error_message=f"Max retries exceeded: {error_msg}")
                        logger.error("Selfie %s failed permanently after %d retries", sid, MAX_RETRIES)
            else:
                # Nothing to process
                time.sleep(POLL_INTERVAL)

        except Exception as e:
            consecutive_errors += 1
            logger.error("Worker loop error: %s", e)
            logger.error(traceback.format_exc())

            # Backoff on consecutive errors (max 60s)
            wait = min(consecutive_errors * 5, 60)
            logger.info("Backing off %ds...", wait)
            time.sleep(wait)

    logger.info("Worker shut down.")


if __name__ == "__main__":
    main()
