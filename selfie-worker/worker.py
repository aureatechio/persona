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
import threading
import traceback
import logging

import requests

from config import POLL_INTERVAL, MAX_RETRIES
import db
from steps.transcribe import transcribe
from steps.classify import normalize_first_name
from steps.classify_theme import classify_theme, DEFAULT_THEME_SLUG
from steps.generate import generate_text
from steps.tts import generate_tts, generate_tts_name_sync
from steps.lipsync import run_lipsync, SyncLabsJobFailed, SyncLabsKeyRejected
from steps.compose import compose_videos
from steps.whatsapp import (
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

    # Primeiro nome (capitalização original) usado em todo conteúdo que vai
    # pra IA ou aparece nas mensagens. Mantém a coluna `name` intacta no
    # banco (preserva o full name pra analytics), mas garante que o vídeo
    # gerado, o TTS e o template do WhatsApp só usem "Pedro" mesmo quando
    # o eleitor digita "Pedro Ricardo". Também alinha com o agrupamento
    # de cache, que usa first_name normalizado a partir desse mesmo token.
    _name_parts = (selfie.get("name") or "").strip().split()
    display_first_name = _name_parts[0] if _name_parts else (selfie.get("name") or "")

    # Resolve base_model for this selfie.
    # Primary: selfie['base_model_id'] (set at upload time via per-politician URL).
    # Fallback: legacy rows without base_model_id → first is_active=true model.
    # Fallback will be removed after F3 (base_model_id NOT NULL) is deployed.
    base_model_id = selfie.get("base_model_id")
    if base_model_id:
        base_model = db.get_base_model(base_model_id)
        if not base_model:
            db.update_status(sid, "failed", error_message=f"base_model_id {base_model_id} not found")
            logger.error("base_model_id %s not found", base_model_id)
            return
    else:
        logger.warning("Selfie %s has no base_model_id, falling back to active model", sid)
        base_model = db.get_active_base_model()
        if not base_model:
            db.update_status(sid, "failed", error_message="Nenhum modelo base ativo")
            logger.error("No active base model found (legacy fallback)")
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

        # Wait for browser upload to complete (file might not exist yet)
        video_bytes = None
        for attempt in range(3):
            try:
                t0 = time.time()
                video_bytes = db.download_file(selfie["selfie_video_path"])
                logger.info("Download took %.1fs (%d bytes)", time.time() - t0, len(video_bytes))
                break
            except Exception:
                if attempt < 2:
                    logger.info("File not ready yet, waiting 1s... (attempt %d/3)", attempt + 1)
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
    #
    # Três caminhos possíveis:
    #
    # 1. NAME_SYNC  (theme uploaded + strategy='name_sync'):
    #    Lipsync curto de 3s do nome + concat com video do tema. Barato
    #    (~$0.10/vídeo), pode ter "corte" perceptível na transição.
    #
    # 2. FULL_VIDEO (theme uploaded + strategy='full_video'):
    #    GPT gera resposta completa, TTS longo, lipsync de até 30s SOBRE
    #    o vídeo do tema (puppet). Compose junta selfie + lipsync + closing.
    #    Caro (~$1-2/vídeo), visualmente linear.
    #
    # 3. LEGACY     (theme NÃO uploaded):
    #    Mesmo que full_video, mas lipsync sobre video base "neutro" do
    #    candidato. Fallback quando o candidato não gravou o vídeo do tema.
    if _should_run_step(status, "generating_text"):
        if selfie.get("status") != "generating_text":
            db.update_status(sid, "generating_text")
        logger.info("Step 2/6: Classifying theme + checking strategy...")

        theme_slug = selfie.get("theme_slug")
        first_name = selfie.get("first_name")
        if not (theme_slug and first_name):
            themes = db.get_themes_template()
            theme_slug = classify_theme(transcription, themes) or DEFAULT_THEME_SLUG
            first_name = normalize_first_name(selfie["name"])
            db.update_status(
                sid, "generating_text",
                first_name=first_name, theme_slug=theme_slug,
            )
            selfie["theme_slug"] = theme_slug
            selfie["first_name"] = first_name

        theme_model = db.get_theme_model(base_model["id"], theme_slug)
        theme_available = bool(
            theme_model
            and theme_model.get("is_uploaded")
            and theme_model.get("video_storage_path")
        )

        # Strategy do candidato (default 'name_sync'). Persiste na row
        # da selfie pra retries serem determinísticos.
        configured_strategy = (base_model.get("video_strategy") or "name_sync").lower()
        if not theme_available:
            effective_strategy = "legacy"
        elif configured_strategy == "full_video":
            effective_strategy = "full_video"
        else:
            effective_strategy = "name_sync"

        # Persiste no banco se ainda não tinha (1ª passagem do step 2)
        if not selfie.get("video_strategy"):
            db.update_status(sid, "generating_text", video_strategy=effective_strategy)
            selfie["video_strategy"] = effective_strategy

        if effective_strategy == "name_sync":
            # ── PLANO A: NAME_SYNC ──
            # Se o candidato tem greeting_video gravado, o cache é
            # independente do tema (mesmo visual). Senão, cai no modo
            # legado onde o cache depende de (nome, tema).
            uses_greeting = bool(base_model.get("greeting_video_path"))
            name_sync_cached = db.find_cached_name_sync(
                base_model["id"],
                first_name,
                theme_slug=theme_slug,
                uses_greeting=uses_greeting,
            )

            if name_sync_cached:
                logger.info(
                    "Step 2/6: NAME_SYNC HIT (source=%s, first_name=%s, theme=%s)",
                    name_sync_cached["id"], first_name, theme_slug,
                )
                db.update_status(
                    sid, "composing",
                    name_sync_cached_path=name_sync_cached["name_sync_cached_path"],
                    cached_from=name_sync_cached["id"],
                )
                selfie["name_sync_cached_path"] = name_sync_cached["name_sync_cached_path"]
                generated_text = ""
                status = "composing"
            else:
                logger.info(
                    "Step 2/6: NAME_SYNC MISS (first_name=%s, theme=%s) — gerando sync curto",
                    first_name, theme_slug,
                )
                lip_cfg = base_model.get("lipsync_config") or {}
                greeting_tpl = lip_cfg.get(
                    "greeting_template",
                    "{nome}, obrigado pelo seu vídeo!",
                )
                generated_text = greeting_tpl.replace("{nome}", display_first_name)
                db.update_status(sid, "generating_tts", generated_text=generated_text)
                selfie["generated_text"] = generated_text

        elif effective_strategy == "full_video":
            # ── PLANO B: FULL_VIDEO (lipsync longo sobre video do tema) ──
            cached = db.find_cached_video(
                base_model["id"], first_name, theme_slug, strategy="full_video",
            )
            if cached:
                logger.info(
                    "Step 2/6: FULL_VIDEO CACHE HIT (source=%s, name=%s, theme=%s)",
                    cached["id"], first_name, theme_slug,
                )
                db.update_status(
                    sid, "composing",
                    lipsync_cached_path=cached["lipsync_cached_path"],
                    cached_from=cached["id"],
                    generated_text=cached.get("generated_text"),
                )
                selfie["lipsync_cached_path"] = cached["lipsync_cached_path"]
                selfie["generated_text"] = cached.get("generated_text", "") or ""
                generated_text = selfie["generated_text"]
                status = "composing"
            else:
                logger.info(
                    "Step 2/6: FULL_VIDEO MISS (name=%s, theme=%s) — GPT + TTS longo + lipsync sobre video do tema",
                    first_name, theme_slug,
                )
                prompt_template = base_model.get("prompt_template", "")
                generated_text = generate_text(display_first_name, transcription, prompt_template)
                db.update_status(sid, "generating_tts", generated_text=generated_text)
                selfie["generated_text"] = generated_text

        else:
            # ── LEGACY: tema não tem vídeo gravado ──
            logger.info(
                "Step 2/6: LEGACY (theme=%s sem vídeo do candidato — fallback IA completa)",
                theme_slug,
            )
            cached = db.find_cached_video(
                base_model["id"], first_name, theme_slug, strategy="legacy",
            )
            if cached:
                logger.info(
                    "Step 2/6: LEGACY CACHE HIT (source=%s)", cached["id"],
                )
                db.update_status(
                    sid, "composing",
                    lipsync_cached_path=cached["lipsync_cached_path"],
                    cached_from=cached["id"],
                    generated_text=cached.get("generated_text"),
                )
                selfie["lipsync_cached_path"] = cached["lipsync_cached_path"]
                selfie["generated_text"] = cached.get("generated_text", "") or ""
                generated_text = selfie["generated_text"]
                status = "composing"
            else:
                prompt_template = base_model.get("prompt_template", "")
                generated_text = generate_text(display_first_name, transcription, prompt_template)
                db.update_status(sid, "generating_tts", generated_text=generated_text)
                selfie["generated_text"] = generated_text
    else:
        generated_text = selfie.get("generated_text", "")

    # ─── Step 3: TTS ───
    if _should_run_step(status, "generating_tts"):
        # Wait for ElevenLabs concurrency slot (max 5 simultaneous)
        MAX_TTS_CONCURRENT = 5
        while not _shutdown:
            tts_count = db.count_tts_in_progress()
            if tts_count < MAX_TTS_CONCURRENT:
                break
            logger.info("Step 3/6: ElevenLabs slots full (%d/%d), waiting 5s...", tts_count, MAX_TTS_CONCURRENT)
            time.sleep(5)

        if _shutdown:
            return

        db.update_status(sid, "generating_tts")

        voice_id = voice_model["elevenlabs_voice_id"]

        # Decide TTS por strategy persistida: name_sync (curto, sem música,
        # settings limpos) ou full_video/legacy (longo, com música).
        strategy = (selfie.get("video_strategy") or "name_sync").lower()
        if strategy == "name_sync":
            lip_cfg = base_model.get("lipsync_config") or {}
            tts_settings = lip_cfg.get("tts")
            bg_music = base_model.get("bg_music_path")
            logger.info("Step 3/6: Generating NAME_SYNC TTS (curto, bg_music=%s, custom=%s)...", bg_music, bool(tts_settings))
            audio_bytes = generate_tts_name_sync(generated_text, voice_id, tts_settings=tts_settings, bg_music_path=bg_music)
            tts_processed_text = generated_text
        else:
            logger.info(
                "Step 3/6: Generating TTS (%s, com música + fix_pronunciation)...",
                strategy,
            )
            bg_music = base_model.get("bg_music_path")
            audio_bytes, tts_processed_text = generate_tts(generated_text, voice_id, bg_music_path=bg_music)

        tts_path = f"tts/selfie_{sid}.mp3"
        db.upload_file(tts_path, audio_bytes, "audio/mpeg")

        db.update_status(sid, "generating_lipsync", tts_audio_path=tts_path, tts_processed_text=tts_processed_text)
        selfie["tts_audio_path"] = tts_path
    else:
        tts_path = selfie.get("tts_audio_path", f"tts/selfie_{sid}.mp3")

    # ─── Step 4: Lip-sync (Sync Labs with key pool) ───
    if _should_run_step(status, "generating_lipsync"):
        if selfie.get("lipsync_video_url"):
            logger.info("Step 4/6: Lip-sync already complete, skipping...")
            lipsync_url = selfie["lipsync_video_url"]
        else:
            # Claim a Sync Labs key slot (round-robin, max concurrent per key)
            slot_key_id = None
            while not _shutdown:
                slot_key_id = db.claim_kling_slot(sid)
                if slot_key_id:
                    break
                logger.info("Step 4/6: All Sync Labs slots full, waiting 15s...")
                time.sleep(15)

            if _shutdown:
                return

            try:
                key_data = db.get_kling_key(slot_key_id)
                if not key_data:
                    raise RuntimeError(f"Sync Labs key {slot_key_id} not found in database")

                db.update_status(sid, "generating_lipsync")

                # Decide input visual do lipsync por strategy:
                # - name_sync com greeting_video: usa o vídeo saudação
                #   dedicado (3s placeholder). Mesmo visual pra qualquer
                #   tema, cache compartilhado.
                # - name_sync sem greeting / full_video: usa o início do
                #   theme_video (modo legado, cache por tema).
                # - legacy: vídeo base "neutro" (fallback sem tema).
                strategy = (selfie.get("video_strategy") or "name_sync").lower()
                theme_model_now = db.get_theme_model(
                    base_model["id"], selfie.get("theme_slug")
                )
                greeting_path = base_model.get("greeting_video_path")
                use_greeting = strategy == "name_sync" and bool(greeting_path)

                if use_greeting:
                    lipsync_video_source = greeting_path
                    logger.info(
                        "Step 4/6: NAME_SYNC — lipsync usa video saudação (%s)",
                        lipsync_video_source,
                    )
                elif strategy in ("name_sync", "full_video") and theme_model_now:
                    lipsync_video_source = theme_model_now["video_storage_path"]
                    logger.info(
                        "Step 4/6: %s — lipsync usa video do tema (%s)",
                        strategy.upper(), lipsync_video_source,
                    )
                else:
                    lipsync_video_source = base_model["video_storage_path"]
                    logger.info(
                        "Step 4/6: LEGACY — lipsync usa video base (%s)",
                        lipsync_video_source,
                    )

                # Generate signed URLs AFTER claiming slot (fresh expiry)
                video_signed = db.create_signed_url(lipsync_video_source)
                audio_signed = db.create_signed_url(tts_path)

                # Heartbeat keeps locked_at fresh during long Sync Labs polling
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
                    # name_sync: cache curto de 3s no name_sync_cached_path.
                    # full_video/legacy: cache longo no lipsync_cached_path.
                    if strategy == "name_sync":
                        cached_path = f"name_sync_cached/{sid}.mp4"
                        db.upload_file(cached_path, lipsync_resp.content, "video/mp4")
                        logger.info(
                            "Step 4/6: NAME_SYNC persisted to %s (%d bytes, uses_greeting=%s)",
                            cached_path, len(lipsync_resp.content), use_greeting,
                        )
                        db.update_status(
                            sid, "composing",
                            lipsync_video_url=lipsync_url,
                            name_sync_cached_path=cached_path,
                            name_sync_uses_greeting=use_greeting,
                        )
                        selfie["name_sync_cached_path"] = cached_path
                        selfie["name_sync_uses_greeting"] = use_greeting
                    else:
                        cached_path = f"lipsync_cached/{sid}.mp4"
                        db.upload_file(cached_path, lipsync_resp.content, "video/mp4")
                        logger.info(
                            "Step 4/6: LIPSYNC (%s) persisted to %s (%d bytes)",
                            strategy, cached_path, len(lipsync_resp.content),
                        )
                        db.update_status(
                            sid, "composing",
                            lipsync_video_url=lipsync_url,
                            lipsync_cached_path=cached_path,
                        )
                        selfie["lipsync_cached_path"] = cached_path
                except Exception as e:
                    logger.warning(
                        "Step 4/6: persist lipsync failed (%s) — vídeo não vira fonte de cache",
                        e,
                    )
                    db.update_status(sid, "composing", lipsync_video_url=lipsync_url)

                selfie["lipsync_video_url"] = lipsync_url
            except SyncLabsKeyRejected:
                # 401/402 — esta chave foi revogada/sem cota.
                # Bloqueia ela no pool por 15min para que o retry pegue outra.
                db.block_kling_key(slot_key_id, minutes=15)
                db.update_status(sid, "generating_lipsync", lipsync_video_url=None)
                raise
            except SyncLabsJobFailed:
                # Sync Labs returned FAILED/REJECTED for this key.
                # Clear lipsync state so retry can try a different key.
                db.update_status(sid, "generating_lipsync", lipsync_video_url=None)
                raise
            finally:
                db.release_kling_slot(sid)
    else:
        lipsync_url = selfie.get("lipsync_video_url", "")

    # ─── Step 5: Compose (FFmpeg) ───
    #
    # Monta a lista de "vídeos do meio" que vai entre selfie e closing:
    #
    # FLUXO NOVO  : [name_sync (3s do nome) , theme_video (vídeo do tema)]
    # FLUXO LEGACY: [lipsync (15-20s)]
    #
    # A escolha vem do state persistido em video_selfies — `name_sync_cached_path`
    # presente implica fluxo novo; caso contrário usa lipsync_cached_path
    # ou lipsync_video_url como fallback.
    if _should_run_step(status, "composing"):
        if selfie.get("status") != "composing":
            db.update_status(sid, "composing")
        logger.info("Step 5/6: Composing final video...")

        selfie_bytes = db.download_file(selfie["selfie_video_path"])
        ext = "webm" if selfie["selfie_video_path"].endswith(".webm") else "mp4"

        name_sync_cached_path = selfie.get("name_sync_cached_path")
        theme_slug = selfie.get("theme_slug")

        middle_urls: list[str] = []
        middle_offsets: list[float] = []
        if name_sync_cached_path and theme_slug:
            theme_model_now = db.get_theme_model(base_model["id"], theme_slug)
            theme_video_path = (
                theme_model_now.get("video_storage_path")
                if theme_model_now and theme_model_now.get("is_uploaded")
                else None
            )
            if theme_video_path:
                # A candidata grava os primeiros N segundos do theme_video
                # falando um placeholder; esses segundos são substituídos
                # pelo name_sync. Pra evitar repetição visual, o
                # theme_video começa após esses N segundos no compose.
                lip_cfg_intro = base_model.get("lipsync_config") or {}
                intro_seconds = float(
                    lip_cfg_intro.get("theme_greeting_end")
                    or base_model.get("theme_intro_seconds")
                    or 4
                )
                middle_urls = [
                    db.create_signed_url(name_sync_cached_path),
                    db.create_signed_url(theme_video_path),
                ]
                middle_offsets = [0.0, intro_seconds]
                logger.info(
                    "Step 5/6: NEW FLOW — name_sync (%s) + theme_video (%s, skip %.1fs intro, greeting=%s)",
                    name_sync_cached_path, theme_video_path, intro_seconds,
                    bool(selfie.get("name_sync_uses_greeting")),
                )

        if not middle_urls:
            # Fluxo LEGACY: usa lipsync único
            lipsync_cached_path = selfie.get("lipsync_cached_path")
            if lipsync_cached_path:
                middle_urls = [db.create_signed_url(lipsync_cached_path)]
                logger.info("Step 5/6: LEGACY — lipsync_cached (%s)", lipsync_cached_path)
            elif lipsync_url:
                middle_urls = [lipsync_url]
                logger.info("Step 5/6: LEGACY — lipsync_url direto (sem cache persistido)")
            else:
                raise RuntimeError(
                    f"compose: nenhum middle disponível para {sid} "
                    f"(name_sync=%s, lipsync_cached=%s, lipsync_url=%s)"
                    % (name_sync_cached_path, selfie.get("lipsync_cached_path"), lipsync_url)
                )

        final_bytes = compose_videos(
            selfie_bytes, ext, middle_urls,
            closing_video_path=base_model.get("closing_video_path"),
            middle_offsets=middle_offsets if middle_offsets else None,
        )

        final_path = f"final/{sid}.mp4"
        db.upload_file(final_path, final_bytes, "video/mp4")

        db.update_status(sid, "sending", final_video_path=final_path)
        selfie["final_video_path"] = final_path
    else:
        final_path = selfie.get("final_video_path", f"final/{sid}.mp4")

    # ─── Step 6: WhatsApp ───
    if _should_run_step(status, "sending"):
        # Atomic claim: only one worker instance can send WhatsApp
        claimed = db.claim_whatsapp_send(sid)
        if not claimed:
            logger.info("Step 6/6: WhatsApp already claimed by another instance, skipping...")
            db.update_status(sid, "completed")
            logger.info("═══ Selfie %s marked completed (WhatsApp sent by other worker) ═══", sid)
            return

        db.update_status(sid, "sending")
        logger.info("Step 6/6: Sending via WhatsApp...")

        video_signed = db.create_signed_url(final_path)
        # Distribuição ponderada entre Meta Cloud API e UAZAPI
        # (WHATSAPP_META_WEIGHT × WHATSAPP_UAZAPI_WEIGHT, default 2:1).
        # Falha do canal sorteado faz reset do claim → retry sorteia
        # de novo (pode cair no outro canal na próxima tentativa).
        provider = pick_provider()
        logger.info("Step 6/6: provider sorteado = %s", provider)

        # Resolve label do tema escolhido pelo classifier (pra usar como
        # variável {tema} no template do UAZAPI).
        theme_label = ""
        try:
            themes = db.get_themes_template()
            theme_label = next(
                (t.get("label", "") for t in themes if t.get("slug") == selfie.get("theme_slug")),
                "",
            )
        except Exception:
            theme_label = ""

        try:
            if provider == "meta":
                _msg_id, sender_id = send_video_official(selfie["phone"], video_signed)
                provider_used = "official"
            else:
                send_whatsapp(
                    selfie["phone"], display_first_name, video_signed,
                    message_template=base_model.get("whatsapp_message_template"),
                    theme_label=theme_label,
                    slug=base_model.get("slug") or "",
                )
                provider_used = "uazapi"
        except WhatsAppSendError:
            db.reset_whatsapp_claim(sid)
            raise

        try:
            db.update_status(sid, "sending", whatsapp_provider=provider_used)
        except Exception:
            # Coluna pode não existir ainda em produção (migration pendente).
            # Não é crítico — só perdemos a telemetria deste envio.
            pass

        # Proposta de governo (opcional): se configurada, envia o PDF logo
        # após o vídeo. Falha aqui NÃO faz retry — o vídeo já saiu e o
        # claim não pode ser resetado sem causar duplicata. Apenas registra
        # error_message para o monitor sinalizar a falha parcial.
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
                # Não levanta: o vídeo principal já foi entregue com sucesso.
                logger.error("Proposta send failed for %s (vídeo OK): %s", sid, e)
                try:
                    db.update_status(
                        sid, "sending",
                        error_message=f"proposta_send_failed: {str(e)[:240]}",
                    )
                except Exception:
                    pass

        db.update_status(sid, "completed")

    logger.info("═══ Selfie %s completed successfully ═══", sid)


# ─── Main loop ─────────────────────────────────────────────
def main():
    logger.info("╔══════════════════════════════════════════╗")
    logger.info("║   Selfie Video Worker — Starting...      ║")
    logger.info("╚══════════════════════════════════════════╝")

    # Validate config
    from config import SUPABASE_URL, OPENAI_API_KEY, ELEVENLABS_API_KEY, UAZAPI_TOKEN

    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")
    if not ELEVENLABS_API_KEY:
        missing.append("ELEVENLABS_API_KEY")
    if not UAZAPI_TOKEN:
        missing.append("UAZAPI_TOKEN")

    if missing:
        logger.error("Missing environment variables: %s", ", ".join(missing))
        sys.exit(1)

    logger.info("Worker ID: %s", db.WORKER_ID)
    logger.info("Config OK. Polling every %ds. Max retries: %d", POLL_INTERVAL, MAX_RETRIES)

    # Watchdog em thread separada — antes ele rodava inline a cada ~60 polls,
    # mas se TODAS as instâncias estavam dentro de process_selfie (ex: lipsync
    # poll de 30min), o loop principal nunca tocava e o watchdog não rodava.
    # Resultado: itens travados acumulavam por meses (vimos 9 zumbis de 7–77
    # dias). Daemon thread garante que watchdog roda independentemente.
    def _watchdog_loop():
        while not _shutdown:
            try:
                failed_count = db.run_watchdog()
                if failed_count:
                    logger.warning("Watchdog: cleaned up %d stuck selfies", failed_count)
            except Exception as e:
                logger.error("Watchdog thread error: %s", e)

            # Auto-confirm uploads órfãos (rede do eleitor cai depois do
            # PUT no Storage mas antes do /confirm-upload). Sem isso, a row
            # fica zumbi em 'uploading' pra sempre.
            try:
                result = db.run_auto_confirm_uploads()
                confirmed = result.get("confirmed", 0)
                failed = result.get("failed", 0)
                if confirmed or failed:
                    logger.warning(
                        "Auto-confirm: %d promovidos pra queued, %d marcados failed",
                        confirmed, failed,
                    )
            except Exception as e:
                logger.error("Auto-confirm thread error: %s", e)

            # Roda a cada 60s. Mesmo que uma instância morra com sigkill,
            # outras das 18 continuam rodando watchdog em paralelo.
            for _ in range(60):
                if _shutdown:
                    return
                time.sleep(1)

    watchdog_thread = threading.Thread(target=_watchdog_loop, daemon=True, name="watchdog")
    watchdog_thread.start()
    logger.info("Watchdog thread started (runs every 60s)")

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

                # Guard: if item already exceeded max retries, mark failed immediately
                retry_count = int(selfie.get("retry_count") or 0)
                if retry_count >= MAX_RETRIES:
                    sid = selfie["id"]
                    logger.warning("Selfie %s already has %d retries — marking as failed", sid, retry_count)
                    db.update_status(sid, "failed", error_message=f"Max retries ({MAX_RETRIES}) exceeded")
                    continue

                try:
                    process_selfie(selfie)
                except Exception as e:
                    sid = selfie["id"]
                    error_msg = str(e)
                    logger.error("Pipeline error for %s: %s", sid, error_msg)
                    logger.error(traceback.format_exc())

                    # Fetch current state from DB (not the stale selfie dict)
                    current = db.get_selfie(sid)
                    current_status = (current or selfie).get("status", "failed")
                    new_retry = retry_count + 1

                    if new_retry < MAX_RETRIES:
                        # Keep CURRENT status so retry resumes from where it failed
                        db.update_status(
                            sid,
                            current_status,
                            error_message=error_msg,
                            retry_count=new_retry,
                        )
                        logger.info("Will retry %s from status '%s' (attempt %d/%d)", sid, current_status, new_retry + 1, MAX_RETRIES)
                    else:
                        # Max retries exceeded
                        db.update_status(sid, "failed", error_message=f"Max retries exceeded: {error_msg}", retry_count=new_retry)
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
