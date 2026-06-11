"""
V2 Selfie Video Pipeline Worker — mariadocarmo-new

Isolated pipeline. Polls v2_video_selfies and processes through:
1. Whisper API — transcription
2. GPT-4o-mini — theme classification + name extraction
3. ElevenLabs — TTS with cloned voice
4. Sync Labs — lip-sync video
5. FFmpeg — normalize + concatenate
6. WhatsApp — send final video

Zero shared code with selfie-worker/.
"""

import signal
import sys
import time
import threading
import traceback
import logging

import requests

from config import POLL_INTERVAL, MAX_RETRIES
import db
from steps.transcribe import transcribe
from steps.classify_theme import classify_theme, normalize_first_name, DEFAULT_THEME_SLUG
from steps.generate import generate_text
from steps.tts import generate_tts, generate_tts_name_sync
from steps.lipsync import run_lipsync, SyncLabsJobFailed, SyncLabsKeyRejected
from steps.compose import compose_videos
from steps.send import (
    send_whatsapp,
    send_whatsapp_document,
    send_video_official,
    pick_provider,
    WhatsAppSendError,
)

# ─── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("v2-worker")

# ─── Graceful shutdown ─────────────────────────────────────
_shutdown = False


def _handle_signal(signum, _frame):
    global _shutdown
    logger.info("Received signal %d, shutting down...", signum)
    _shutdown = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)

# ─── Pipeline steps ────────────────────────────────────────
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
    try:
        return STEP_ORDER.index(current_status) <= STEP_ORDER.index(step_status)
    except ValueError:
        return False


# ─── Main pipeline ─────────────────────────────────────────
def process_selfie(selfie: dict):
    """Run the full V2 pipeline for a single selfie record."""
    sid = selfie["id"]
    status = selfie["status"]
    logger.info("=== V2 Processing %s (status: %s, name: %s) ===", sid, status, selfie["name"])

    _name_parts = (selfie.get("name") or "").strip().split()
    display_first_name = _name_parts[0] if _name_parts else (selfie.get("name") or "")

    # Resolve base model
    base_model_id = selfie.get("base_model_id")
    if not base_model_id:
        db.update_status(sid, "failed", error_message="No base_model_id")
        return

    base_model = db.get_base_model(base_model_id)
    if not base_model:
        db.update_status(sid, "failed", error_message=f"base_model_id {base_model_id} not found")
        return

    voice_id = base_model.get("elevenlabs_voice_id")
    if not voice_id:
        db.update_status(sid, "failed", error_message="No elevenlabs_voice_id")
        return

    # ─── Step 1: Transcription ───
    if _should_run_step(status, "transcribing"):
        db.update_status(sid, "transcribing")
        logger.info("Step 1/6: Transcribing...")

        video_bytes = None
        for attempt in range(3):
            try:
                video_bytes = db.download_file(selfie["selfie_video_path"])
                break
            except Exception:
                if attempt < 2:
                    time.sleep(1)
                else:
                    raise

        if not video_bytes:
            raise RuntimeError("Failed to download selfie video after 3 attempts")

        ext = "webm" if selfie["selfie_video_path"].endswith(".webm") else "mp4"
        transcription = transcribe(video_bytes, ext)

        db.update_status(sid, "generating_text", transcription=transcription)
        selfie["transcription"] = transcription
    else:
        transcription = selfie.get("transcription", "")

    # ─── Step 2: Classify theme + decide strategy ───
    if _should_run_step(status, "generating_text"):
        if selfie.get("status") != "generating_text":
            db.update_status(sid, "generating_text")
        logger.info("Step 2/6: Classifying theme...")

        theme_slug = selfie.get("theme_slug")
        first_name = selfie.get("first_name")
        if not (theme_slug and first_name):
            themes = db.get_themes_template()
            theme_slug = classify_theme(transcription, themes) or DEFAULT_THEME_SLUG
            first_name = normalize_first_name(selfie["name"])
            db.update_status(sid, "generating_text", first_name=first_name, theme_slug=theme_slug)
            selfie["theme_slug"] = theme_slug
            selfie["first_name"] = first_name

        theme_model = db.get_theme_model(base_model["id"], theme_slug)
        theme_available = bool(
            theme_model
            and theme_model.get("is_uploaded")
            and theme_model.get("video_storage_path")
        )

        configured_strategy = (base_model.get("video_strategy") or "name_sync").lower()
        if not theme_available:
            effective_strategy = "legacy"
        elif configured_strategy == "full_video":
            effective_strategy = "full_video"
        else:
            effective_strategy = "name_sync"

        if not selfie.get("video_strategy"):
            db.update_status(sid, "generating_text", video_strategy=effective_strategy)
            selfie["video_strategy"] = effective_strategy

        if effective_strategy == "name_sync":
            # NAME_SYNC: lipsync curto do nome + video do tema
            name_sync_cached = db.find_cached_name_sync(base_model["id"], first_name, theme_slug)

            if name_sync_cached:
                logger.info("Step 2/6: NAME_SYNC HIT (source=%s)", name_sync_cached["id"])
                db.update_status(
                    sid, "composing",
                    name_sync_cached_path=name_sync_cached["name_sync_cached_path"],
                    cached_from=name_sync_cached["id"],
                )
                selfie["name_sync_cached_path"] = name_sync_cached["name_sync_cached_path"]
                generated_text = ""
                status = "composing"
            else:
                logger.info("Step 2/6: NAME_SYNC MISS (name=%s, theme=%s)", first_name, theme_slug)
                lip_cfg = base_model.get("lipsync_config") or {}
                greeting_tpl = lip_cfg.get("greeting_template") or base_model.get("greeting_template") or "{nome}, obrigado pelo seu vídeo!"
                generated_text = greeting_tpl.replace("{nome}", display_first_name)
                db.update_status(sid, "generating_tts", generated_text=generated_text)
                selfie["generated_text"] = generated_text

        elif effective_strategy == "full_video":
            # FULL_VIDEO: GPT response + long lipsync
            cached = db.find_cached_video(base_model["id"], first_name, theme_slug, strategy="full_video")
            if cached:
                logger.info("Step 2/6: FULL_VIDEO CACHE HIT (source=%s)", cached["id"])
                db.update_status(
                    sid, "composing",
                    lipsync_cached_path=cached["lipsync_cached_path"],
                    cached_from=cached["id"],
                    generated_text=cached.get("generated_text"),
                )
                selfie["lipsync_cached_path"] = cached["lipsync_cached_path"]
                generated_text = cached.get("generated_text", "") or ""
                status = "composing"
            else:
                logger.info("Step 2/6: FULL_VIDEO MISS")
                prompt_template = base_model.get("prompt_template", "")
                generated_text = generate_text(display_first_name, transcription, prompt_template)
                db.update_status(sid, "generating_tts", generated_text=generated_text)
                selfie["generated_text"] = generated_text

        else:
            # LEGACY: no theme video
            cached = db.find_cached_video(base_model["id"], first_name, theme_slug, strategy="legacy")
            if cached:
                logger.info("Step 2/6: LEGACY CACHE HIT (source=%s)", cached["id"])
                db.update_status(
                    sid, "composing",
                    lipsync_cached_path=cached["lipsync_cached_path"],
                    cached_from=cached["id"],
                    generated_text=cached.get("generated_text"),
                )
                selfie["lipsync_cached_path"] = cached["lipsync_cached_path"]
                generated_text = cached.get("generated_text", "") or ""
                status = "composing"
            else:
                logger.info("Step 2/6: LEGACY MISS")
                prompt_template = base_model.get("prompt_template", "")
                generated_text = generate_text(display_first_name, transcription, prompt_template)
                db.update_status(sid, "generating_tts", generated_text=generated_text)
                selfie["generated_text"] = generated_text
    else:
        generated_text = selfie.get("generated_text", "")

    # ─── Step 3: TTS ───
    if _should_run_step(status, "generating_tts"):
        MAX_TTS_CONCURRENT = 5
        while not _shutdown:
            tts_count = db.count_tts_in_progress()
            if tts_count < MAX_TTS_CONCURRENT:
                break
            logger.info("Step 3/6: ElevenLabs slots full (%d/%d), waiting...", tts_count, MAX_TTS_CONCURRENT)
            time.sleep(5)

        if _shutdown:
            return

        db.update_status(sid, "generating_tts")

        strategy = (selfie.get("video_strategy") or "name_sync").lower()
        if strategy == "name_sync":
            lip_cfg = base_model.get("lipsync_config") or {}
            tts_settings = lip_cfg.get("tts")
            bg_music = base_model.get("bg_music_path")
            logger.info("Step 3/6: NAME_SYNC TTS (curto, bg_music=%s)...", bg_music)
            audio_bytes = generate_tts_name_sync(generated_text, voice_id, tts_settings=tts_settings, bg_music_path=bg_music)
            tts_processed_text = generated_text
        else:
            bg_music = base_model.get("bg_music_path")
            logger.info("Step 3/6: TTS (%s, bg_music=%s)...", strategy, bg_music)
            audio_bytes, tts_processed_text = generate_tts(generated_text, voice_id, bg_music_path=bg_music)

        tts_path = f"v2/tts/selfie_{sid}.mp3"
        db.upload_file(tts_path, audio_bytes, "audio/mpeg")

        db.update_status(sid, "generating_lipsync", tts_audio_path=tts_path, tts_processed_text=tts_processed_text)
        selfie["tts_audio_path"] = tts_path
    else:
        tts_path = selfie.get("tts_audio_path", f"v2/tts/selfie_{sid}.mp3")

    # ─── Step 4: Lip-sync ───
    if _should_run_step(status, "generating_lipsync"):
        if selfie.get("lipsync_video_url"):
            logger.info("Step 4/6: Lip-sync already done, skipping...")
            lipsync_url = selfie["lipsync_video_url"]
        else:
            slot_key_id = None
            while not _shutdown:
                slot_key_id = db.claim_sync_slot(sid)
                if slot_key_id:
                    break
                logger.info("Step 4/6: All Sync slots full, waiting 15s...")
                time.sleep(15)

            if _shutdown:
                return

            try:
                key_data = db.get_sync_key(slot_key_id)
                if not key_data:
                    raise RuntimeError(f"Sync key {slot_key_id} not found")

                db.update_status(sid, "generating_lipsync")

                strategy = (selfie.get("video_strategy") or "name_sync").lower()
                theme_model_now = db.get_theme_model(base_model["id"], selfie.get("theme_slug"))

                if strategy == "name_sync":
                    lipsync_video_source = base_model["video_storage_path"]
                    logger.info("Step 4/6: NAME_SYNC — lipsync on base video (theme stays intact)")
                elif strategy == "full_video" and theme_model_now:
                    lipsync_video_source = theme_model_now["video_storage_path"]
                    logger.info("Step 4/6: FULL_VIDEO — lipsync on theme video (%s)", lipsync_video_source)
                else:
                    lipsync_video_source = base_model["video_storage_path"]
                    logger.info("Step 4/6: LEGACY — lipsync on base video")

                video_signed = db.create_signed_url(lipsync_video_source)
                audio_signed = db.create_signed_url(tts_path)

                def _heartbeat():
                    db.heartbeat(sid)

                lip_cfg = base_model.get("lipsync_config") or {}
                lipsync_url = run_lipsync(
                    video_signed, audio_signed,
                    api_key=key_data["access_key"],
                    heartbeat_fn=_heartbeat,
                    model=lip_cfg.get("model", "lipsync-2-pro"),
                    sync_mode=lip_cfg.get("sync_mode", "loop"),
                    temperature=float(lip_cfg.get("temperature", 0.3)),
                )

                try:
                    lipsync_resp = requests.get(lipsync_url, timeout=120)
                    lipsync_resp.raise_for_status()

                    if strategy == "name_sync":
                        cached_path = f"v2/name_sync_cached/{sid}.mp4"
                        db.upload_file(cached_path, lipsync_resp.content, "video/mp4")
                        logger.info("Step 4/6: NAME_SYNC persisted (%d bytes)", len(lipsync_resp.content))
                        db.update_status(sid, "composing", lipsync_video_url=lipsync_url, name_sync_cached_path=cached_path)
                        selfie["name_sync_cached_path"] = cached_path
                    else:
                        cached_path = f"v2/lipsync_cached/{sid}.mp4"
                        db.upload_file(cached_path, lipsync_resp.content, "video/mp4")
                        logger.info("Step 4/6: LIPSYNC persisted (%d bytes)", len(lipsync_resp.content))
                        db.update_status(sid, "composing", lipsync_video_url=lipsync_url, lipsync_cached_path=cached_path)
                        selfie["lipsync_cached_path"] = cached_path
                except Exception as e:
                    logger.warning("Step 4/6: persist failed (%s)", e)
                    db.update_status(sid, "composing", lipsync_video_url=lipsync_url)

                selfie["lipsync_video_url"] = lipsync_url
            except SyncLabsKeyRejected:
                db.block_sync_key(slot_key_id, minutes=15)
                db.update_status(sid, "generating_lipsync", lipsync_video_url=None)
                raise
            except SyncLabsJobFailed:
                db.update_status(sid, "generating_lipsync", lipsync_video_url=None)
                raise
            finally:
                db.release_sync_slot(sid)
    else:
        lipsync_url = selfie.get("lipsync_video_url", "")

    # ─── Step 5: Compose ───
    if _should_run_step(status, "composing"):
        if selfie.get("status") != "composing":
            db.update_status(sid, "composing")
        logger.info("Step 5/6: Composing...")

        selfie_bytes = db.download_file(selfie["selfie_video_path"])
        ext = "webm" if selfie["selfie_video_path"].endswith(".webm") else "mp4"

        name_sync_cached_path = selfie.get("name_sync_cached_path")
        theme_slug = selfie.get("theme_slug")

        middle_urls: list[str] = []
        if name_sync_cached_path and theme_slug:
            theme_model_now = db.get_theme_model(base_model["id"], theme_slug)
            theme_video_path = (
                theme_model_now.get("video_storage_path")
                if theme_model_now and theme_model_now.get("is_uploaded")
                else None
            )
            if theme_video_path:
                middle_urls = [
                    db.create_signed_url(name_sync_cached_path),
                    db.create_signed_url(theme_video_path),
                ]
                logger.info("Step 5/6: name_sync + theme_video (trimmed)")

        if not middle_urls:
            lipsync_cached_path = selfie.get("lipsync_cached_path")
            if lipsync_cached_path:
                middle_urls = [db.create_signed_url(lipsync_cached_path)]
            elif lipsync_url:
                middle_urls = [lipsync_url]
            else:
                raise RuntimeError(f"compose: no middle for {sid}")

        final_bytes = compose_videos(
            selfie_bytes, ext, middle_urls,
            closing_video_path=base_model.get("closing_video_path"),
            closing_music_path=base_model.get("closing_music_path"),
        )

        final_path = f"v2/final/{sid}.mp4"
        db.upload_file(final_path, final_bytes, "video/mp4")

        db.update_status(sid, "sending", final_video_path=final_path)
        selfie["final_video_path"] = final_path
    else:
        final_path = selfie.get("final_video_path", f"v2/final/{sid}.mp4")

    # ─── Step 6: WhatsApp ───
    if _should_run_step(status, "sending"):
        claimed = db.claim_whatsapp_send(sid)
        if not claimed:
            logger.info("Step 6/6: WhatsApp already claimed, skipping...")
            db.update_status(sid, "completed")
            return

        db.update_status(sid, "sending")
        logger.info("Step 6/6: Sending via WhatsApp...")

        video_signed = db.create_signed_url(final_path)
        provider = pick_provider()
        logger.info("Step 6/6: provider = %s", provider)

        try:
            if provider == "meta":
                _msg_id, _sender_id = send_video_official(selfie["phone"], video_signed)
                provider_used = "official"
            else:
                send_whatsapp(
                    selfie["phone"], display_first_name, video_signed,
                    message_template=base_model.get("whatsapp_message_template"),
                )
                provider_used = "uazapi"
        except WhatsAppSendError:
            db.reset_whatsapp_claim(sid)
            raise

        try:
            db.update_status(sid, "sending", whatsapp_provider=provider_used)
        except Exception:
            pass

        # Proposta PDF (optional)
        proposta_pdf_path = base_model.get("proposta_pdf_path")
        if proposta_pdf_path:
            try:
                logger.info("Step 6/6 (extra): Sending proposta PDF...")
                proposta_signed = db.create_signed_url(proposta_pdf_path)
                send_whatsapp_document(
                    selfie["phone"], display_first_name, proposta_signed,
                    message_template=base_model.get("proposta_message_template"),
                )
            except Exception as e:
                logger.error("Proposta send failed (video OK): %s", e)

        db.update_status(sid, "completed")

    logger.info("=== V2 Selfie %s completed ===", sid)


# ─── Main loop ─────────────────────────────────────────────
def main():
    logger.info("╔═══════════════════════════════════════════╗")
    logger.info("║  V2 Selfie Video Worker — Starting...     ║")
    logger.info("╚═══════════════════════════════════════════╝")

    from config import SUPABASE_URL, OPENAI_API_KEY, ELEVENLABS_API_KEY

    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")
    if not ELEVENLABS_API_KEY:
        missing.append("ELEVENLABS_API_KEY")

    if missing:
        logger.error("Missing env vars: %s", ", ".join(missing))
        sys.exit(1)

    logger.info("Worker ID: %s", db.WORKER_ID)
    logger.info("Polling every %ds. Max retries: %d", POLL_INTERVAL, MAX_RETRIES)

    # Watchdog thread
    def _watchdog_loop():
        while not _shutdown:
            try:
                failed_count = db.run_watchdog()
                if failed_count:
                    logger.warning("Watchdog: cleaned %d stuck selfies", failed_count)
            except Exception as e:
                logger.error("Watchdog error: %s", e)
            for _ in range(60):
                if _shutdown:
                    return
                time.sleep(1)

    watchdog_thread = threading.Thread(target=_watchdog_loop, daemon=True, name="v2-watchdog")
    watchdog_thread.start()
    logger.info("Watchdog thread started")

    consecutive_errors = 0

    while not _shutdown:
        try:
            selfie = db.claim_queued()

            if not selfie:
                selfie = db.fetch_resumable()

            if selfie:
                consecutive_errors = 0

                retry_count = int(selfie.get("retry_count") or 0)
                if retry_count >= MAX_RETRIES:
                    sid = selfie["id"]
                    logger.warning("%s has %d retries — marking failed", sid, retry_count)
                    db.update_status(sid, "failed", error_message=f"Max retries ({MAX_RETRIES}) exceeded")
                    continue

                try:
                    process_selfie(selfie)
                except Exception as e:
                    sid = selfie["id"]
                    error_msg = str(e)
                    logger.error("Pipeline error for %s: %s", sid, error_msg)
                    logger.error(traceback.format_exc())

                    current = db.get_selfie(sid)
                    current_status = (current or selfie).get("status", "failed")
                    new_retry = retry_count + 1

                    if new_retry < MAX_RETRIES:
                        db.update_status(sid, current_status, error_message=error_msg, retry_count=new_retry)
                        logger.info("Will retry %s from '%s' (attempt %d/%d)", sid, current_status, new_retry + 1, MAX_RETRIES)
                    else:
                        db.update_status(sid, "failed", error_message=f"Max retries: {error_msg}", retry_count=new_retry)
                        logger.error("%s failed permanently after %d retries", sid, MAX_RETRIES)
            else:
                time.sleep(POLL_INTERVAL)

        except Exception as e:
            consecutive_errors += 1
            logger.error("Worker loop error: %s", e)
            logger.error(traceback.format_exc())
            wait = min(consecutive_errors * 5, 60)
            time.sleep(wait)

    logger.info("V2 Worker shut down.")


if __name__ == "__main__":
    main()
