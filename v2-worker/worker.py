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

import os
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


def _prepare_name_window(sid: str, theme_model: dict | None, tts_path: str, lip_cfg: dict) -> str | None:
    """
    Prepara a base visual do lipsync do nome: a JANELA DE ÂNGULO ÚNICO
    da intro do theme_video original.

    O V2 usa themes "_trimmed" (sem a intro placeholder). O vídeo
    original (com intro) vive na mesma pasta, sem o sufixo. A intro =
    dur(original) - dur(trimmed). Dentro dela, escolhe o trecho do
    último corte de cena até o fim — um take só, terminando exatamente
    onde o conteúdo (trimmed) começa: a transição vira o corte natural
    da edição original.

    Retorna o storage path da base recortada, ou None pra fallback
    (sem original, intro curta demais, ou TTS que não cabe na janela).
    """
    from steps.compose import (
        media_duration_bytes,
        scene_cut_times,
        speech_silences,
        trim_video_bytes,
    )
    import tempfile

    if not (theme_model and theme_model.get("video_storage_path")):
        return None
    trimmed_path = theme_model["video_storage_path"]
    if "_trimmed" not in trimmed_path:
        return None
    original_path = trimmed_path.replace("_trimmed", "")

    try:
        original_bytes = db.download_file(original_path)
        trimmed_bytes = db.download_file(trimmed_path)
        tts_bytes = db.download_file(tts_path)
    except Exception as e:
        logger.warning("name_window: download falhou (%s) — fallback base video", e)
        return None

    dur_original = media_duration_bytes(original_bytes)
    dur_trimmed = media_duration_bytes(trimmed_bytes)
    tts_dur = media_duration_bytes(tts_bytes, ".mp3")
    intro_end = dur_original - dur_trimmed
    if intro_end < 1.5 or tts_dur <= 0:
        logger.info(
            "name_window: intro %.2fs / tts %.2fs — inviável, fallback",
            intro_end, tts_dur,
        )
        return None

    # Análise da intro no vídeo local temporário
    tmpdir = tempfile.mkdtemp(prefix="name_window_")
    src = os.path.join(tmpdir, "original.mp4")
    try:
        with open(src, "wb") as f:
            f.write(original_bytes)

        # Fim REAL da fala placeholder: o trim do editor (intro_end) pode
        # cair antes da fala acabar — ancorar o clipe no fim da fala
        # evita terminar no meio de gesto/palavra. Procura a primeira
        # pausa de fala que começa perto/depois de intro_end.
        silences = speech_silences(src, max_seconds=intro_end + 2.0)
        placeholder_end = intro_end
        for s_start, _s_end in silences:
            if s_start >= intro_end - 0.4:
                placeholder_end = max(intro_end, s_start)
                break

        # Takes da intro: segmentos entre cortes de cena (limiar 0.12
        # pega cortes suaves), limitados ao fim da fala placeholder.
        cuts = scene_cut_times(src, max_seconds=placeholder_end + 1.0)
        boundaries = (
            [0.0]
            + sorted(c for c in cuts if 0.3 < c < placeholder_end - 0.3)
            + [placeholder_end]
        )
        takes = [
            (boundaries[i], boundaries[i + 1])
            for i in range(len(boundaries) - 1)
        ]

        clip_len = tts_dur + 0.2
        # Escolhe o ÚLTIMO take em que a fala cabe (tolerância: o
        # cut_off pode comer ~0.15s do tail de 0.35s sem tocar na fala).
        # O fim do clipe ancora no fim do take — sempre um ponto de
        # corte natural da edição original. Antes o seletor pegava
        # cegamente o último take, mesmo com 0.7s (bounce frenético).
        fitting = [
            (start, end) for start, end in takes
            if clip_len <= (end - start) + 0.15
        ]
        if fitting:
            take_start, take_end = fitting[-1]
            clip_start = max(take_start, take_end - clip_len)
            sync_mode = "cut_off"
            base_bytes = trim_video_bytes(
                original_bytes, clip_start, take_end - clip_start
            )
        else:
            # Nenhum take comporta a fala: usa o MAIOR take em bounce
            # (vai-e-volta dentro do mesmo take — sem corte de cena).
            take_start, take_end = max(takes, key=lambda t: t[1] - t[0])
            clip_start = take_start
            sync_mode = "bounce"
            base_bytes = trim_video_bytes(
                original_bytes, take_start, take_end - take_start
            )
            logger.warning(
                "name_window: TTS %.2fs não cabe em nenhum take (maior=%.2fs) — bounce",
                tts_dur, take_end - take_start,
            )

        base_path = f"v2/name_base/{sid}.mp4"
        db.upload_file(base_path, base_bytes, "video/mp4")
        logger.info(
            "name_window: clipe %.2f–%.2fs (fala_end=%.2fs, intro_end=%.2fs, "
            "cortes=%s, tts=%.2fs, mode=%s) → %s",
            clip_start, take_end, placeholder_end, intro_end,
            ["%.2f" % c for c in cuts], tts_dur, sync_mode, base_path,
        )
        return {"path": base_path, "sync_mode": sync_mode}
    except Exception as e:
        logger.warning("name_window: preparo falhou (%s) — fallback base video", e)
        return None
    finally:
        try:
            os.unlink(src)
            os.rmdir(tmpdir)
        except OSError:
            pass


def _theme_start_offset(theme_storage_path: str) -> float:
    """
    Detecta sobras no INÍCIO do theme_video trimmed: se o editor cortou
    cedo demais, o trimmed começa com o rabo da fala placeholder e/ou
    termina num corte de cena logo adiante (visto no
    seguranca_crime_organizado: 0.46s de fala + corte em 0.65s).

    Retorna quantos segundos pular (0.0 se o trim está limpo). Capado
    em 2s — offset maior que isso indica outro problema e é mais seguro
    não cortar conteúdo.
    """
    from steps.compose import scene_cut_times, speech_silences
    import tempfile

    try:
        data = db.download_file(theme_storage_path)
        tmpdir = tempfile.mkdtemp(prefix="theme_offset_")
        src = os.path.join(tmpdir, "theme.mp4")
        with open(src, "wb") as f:
            f.write(data)
        try:
            offset = 0.0
            # Sobra de fala: se o vídeo NÃO começa em silêncio, há fala
            # residual do placeholder até a primeira pausa.
            silences = speech_silences(src, max_seconds=2.5)
            if silences:
                first_start, _first_end = silences[0]
                if 0.05 < first_start < 2.0:
                    offset = first_start + 0.05
                    # Se logo após a sobra existe um corte de cena
                    # (resíduo do take antigo), estende até ele.
                    cuts = [
                        c for c in scene_cut_times(src, max_seconds=2.5)
                        if c < offset + 0.5
                    ]
                    if cuts:
                        offset = max(offset, cuts[-1])
            # Sem fala residual: NÃO pular nada — corte de cena no início
            # do conteúdo é edição legítima, não sobra.
            return min(offset, 2.0)
        finally:
            try:
                os.unlink(src)
                os.rmdir(tmpdir)
            except OSError:
                pass
    except Exception as e:
        logger.warning("_theme_start_offset falhou (%s) — sem offset", e)
        return 0.0


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
            # Sem bg_music aqui: a música entra no compose como trilha
            # contínua sob o corpo inteiro (não morre na junção).
            logger.info("Step 3/6: NAME_SYNC TTS (curto, limpo)...")
            audio_bytes = generate_tts_name_sync(generated_text, voice_id, tts_settings=tts_settings)
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
                lip_cfg = base_model.get("lipsync_config") or {}
                force_sync_mode = None

                if strategy == "name_sync":
                    # Base preferencial: JANELA DE ÂNGULO ÚNICO da intro do
                    # theme_video ORIGINAL (sem "_trimmed"). A intro tem a
                    # candidata falando o placeholder de verdade — visual
                    # muito melhor que o base video neutro, e a transição
                    # pro conteúdo vira o corte natural da edição original.
                    # Calculado automaticamente por tema:
                    #   intro = dur(original) - dur(trimmed)
                    #   janela = [último corte de cena antes do fim da intro, fim da intro]
                    # Fallback: base video (comportamento anterior).
                    lipsync_video_source = None
                    name_base = _prepare_name_window(
                        sid, theme_model_now, tts_path, lip_cfg
                    )
                    if name_base:
                        lipsync_video_source = name_base["path"]
                        force_sync_mode = name_base["sync_mode"]
                        logger.info("Step 4/6: NAME_SYNC — janela de ângulo único da intro do tema")
                    else:
                        lipsync_video_source = base_model["video_storage_path"]
                        logger.info("Step 4/6: NAME_SYNC — lipsync on base video (fallback)")
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

                lipsync_url = run_lipsync(
                    video_signed, audio_signed,
                    api_key=key_data["access_key"],
                    heartbeat_fn=_heartbeat,
                    model=lip_cfg.get("model", "lipsync-2-pro"),
                    sync_mode=force_sync_mode or lip_cfg.get("sync_mode", "loop"),
                    temperature=float(lip_cfg.get("temperature", 0.3)),
                )

                try:
                    lipsync_resp = requests.get(lipsync_url, timeout=120)
                    lipsync_resp.raise_for_status()

                    # Upload com retry: um 503 transitório do Storage aqui
                    # NÃO pode degradar — sem name_sync_cached_path o
                    # compose perde o theme_video (vídeo sai sem o tema).
                    def _upload_with_retry(path: str, data: bytes, attempts: int = 3):
                        for attempt in range(attempts):
                            try:
                                db.upload_file(path, data, "video/mp4")
                                return
                            except Exception as e:
                                if attempt < attempts - 1:
                                    logger.warning(
                                        "Step 4/6: upload %s falhou (%s) — retry %d/%d em 3s",
                                        path, e, attempt + 2, attempts,
                                    )
                                    time.sleep(3)
                                else:
                                    raise

                    if strategy == "name_sync":
                        cached_path = f"v2/name_sync_cached/{sid}.mp4"
                        _upload_with_retry(cached_path, lipsync_resp.content)
                        logger.info("Step 4/6: NAME_SYNC persisted (%d bytes)", len(lipsync_resp.content))
                        db.update_status(sid, "composing", lipsync_video_url=lipsync_url, name_sync_cached_path=cached_path)
                        selfie["name_sync_cached_path"] = cached_path
                    else:
                        cached_path = f"v2/lipsync_cached/{sid}.mp4"
                        _upload_with_retry(cached_path, lipsync_resp.content)
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

        # Defesa contra o persist do Step 4 ter falhado (ex: 503 do
        # Storage): sem name_sync_cached_path o compose perderia o
        # theme_video. Reconstrói o cache a partir do lipsync_video_url.
        if (
            not name_sync_cached_path
            and theme_slug
            and (selfie.get("video_strategy") or "").lower() == "name_sync"
            and selfie.get("lipsync_video_url")
        ):
            try:
                logger.info("Step 5/6: reconstruindo name_sync_cached (persist falhou no Step 4)...")
                resp = requests.get(selfie["lipsync_video_url"], timeout=120)
                resp.raise_for_status()
                name_sync_cached_path = f"v2/name_sync_cached/{sid}.mp4"
                db.upload_file(name_sync_cached_path, resp.content, "video/mp4")
                db.update_status(sid, "composing", name_sync_cached_path=name_sync_cached_path)
                selfie["name_sync_cached_path"] = name_sync_cached_path
            except Exception as e:
                # URL do Sync Labs pode ter expirado — sem o clipe do nome
                # não dá pra montar o vídeo certo; falha pro retry refazer
                # o lipsync em vez de enviar um vídeo sem o tema.
                raise RuntimeError(
                    f"compose: name_sync sem cache e lipsync_url inacessível ({e})"
                )

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
                middle_urls = [
                    db.create_signed_url(name_sync_cached_path),
                    db.create_signed_url(theme_video_path),
                ]
                # Pula sobra de placeholder / corte residual no início
                # do trimmed (trim do editor pode ter cortado cedo).
                theme_offset = _theme_start_offset(theme_video_path)
                middle_offsets = [0.0, theme_offset]
                logger.info(
                    "Step 5/6: name_sync + theme_video (offset=%.2fs)", theme_offset
                )

        compose_bg_music = base_model.get("bg_music_path") if len(middle_urls) >= 2 else None

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
            middle_offsets=middle_offsets if middle_offsets else None,
            bg_music_path=compose_bg_music,
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
