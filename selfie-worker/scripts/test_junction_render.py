"""
Render de teste end-to-end do fluxo name_sync com o compose NOVO
(crossfade + trilha contínua + loudnorm) — valida a correção da junção
name_sync → theme_video sem passar pela fila de produção.

Roda o pipeline real (ElevenLabs TTS limpo → Sync Labs lipsync →
compose_videos) com os assets da candidata e envia o resultado por
WhatsApp pro número de teste.

Uso:
    .venv/bin/python scripts/test_junction_render.py

Custos por execução: 1 job Sync Labs (~$0.10) + ~80 chars ElevenLabs.
"""

import os
import sys
import time
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("test_junction")

WORKER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(WORKER_DIR)
sys.path.insert(0, WORKER_DIR)

# ─── Env: carrega o .env.local do Next.js ANTES de importar config ───
ENV_MAP = {
    "SUPABASE_URL": "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY": "SUPABASE_SERVICE_ROLE_KEY",
    "ELEVENLABS_API_KEY": "ELEVENLABS_API_KEY",
    "SYNC_API_KEY": "SYNC_API_KEY",
    "UAZAPI_URL": "UAZAPI_URL",
    "UAZAPI_TOKEN": "UAZAPI_TOKEN",
}


def _load_env():
    env_path = os.path.join(REPO_ROOT, ".env.local")
    values = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                values[k.strip()] = v.strip().strip('"').strip("'")
    for dest, src in ENV_MAP.items():
        if values.get(src):
            os.environ.setdefault(dest, values[src])


_load_env()

import db  # noqa: E402
from steps.tts import generate_tts_name_sync  # noqa: E402
from steps.lipsync import run_lipsync  # noqa: E402
from steps.compose import compose_videos  # noqa: E402
from steps.whatsapp import send_whatsapp  # noqa: E402

BASE_MODEL_ID = "0740b568-9724-430c-b4ed-9156b616e17c"  # mariadocarmo
TEST_NAME = "Arthur"
TEST_PHONE = "27997642961"
TEST_TAG = "test_junction_arthur"
SELFIE_SAMPLE = "/Users/arthurcavallini/Downloads/WhatsApp Video 2026-06-12 at 11.26.34.mp4"

# O assets/background_music.mp3 da candidata NÃO é música — é o áudio de
# um vídeo-resposta produzido (voz dela). O assets/closing_music.mp3 é
# instrumental limpo (verificado com Whisper) e serve como trilha
# contínua sob o corpo inteiro (selfie + nome + tema).
OVERRIDE_BG_MUSIC = "assets/closing_music.mp3"

# O theme_video tem cortes de ângulo em 1.08s, 4.92s e 17.14s. A região
# de saudação (0–4.92s) tem um corte no meio (1.08s). Estrutura v5 (a
# aprovada) corrigida: base da saudação = 1.08–4.92s (UM ângulo só,
# dentro da intro placeholder) e o tema retoma em 4.92s — o ponto de
# corte natural da edição original. Nenhuma frase do conteúdo é perdida.
NAME_BASE_START = 1.08
THEME_CONTENT_START = 4.92  # onde o conteúdo do tema começa no original
NAME_BASE_DURATION = THEME_CONTENT_START - NAME_BASE_START  # 3.84s


def _trim_local_video(src: str, start: float, duration: float) -> str:
    """Recorta [start : start+duration] de um vídeo local, re-encodando
    do frame exato. Retorna o path do recorte (base contínua do lipsync
    do nome)."""
    import subprocess
    import tempfile

    out = os.path.join(tempfile.mkdtemp(prefix="test_trim_"), "base.mp4")
    # -ss depois do -i = corte preciso (re-encode); evita o "freeze"
    # inicial do fast-seek por keyframe.
    subprocess.run(
        [
            "ffmpeg", "-i", src, "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k",
            "-y", out,
        ],
        capture_output=True, timeout=120, check=True,
    )
    return out


def _ffprobe_dur(path: str) -> float:
    import json
    import subprocess
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path],
        capture_output=True, timeout=15,
    )
    return float(json.loads(r.stdout)["format"]["duration"])


def _ffprobe_dur_bytes(data: bytes) -> float:
    import tempfile
    f = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    f.write(data)
    f.close()
    try:
        return _ffprobe_dur(f.name)
    finally:
        try:
            os.unlink(f.name)
        except OSError:
            pass


def _find_resume_offset(video_path: str, after_seconds: float) -> float:
    """Acha a primeira pausa de fala (silencedetect) DEPOIS de
    ``after_seconds`` e retorna um ponto dentro dela — retomar o tema
    numa pausa entre frases evita cortar palavra no meio. Fallback:
    o próprio after_seconds se nenhuma pausa for encontrada."""
    import re
    import subprocess

    r = subprocess.run(
        ["ffmpeg", "-i", video_path, "-af", "silencedetect=noise=-25dB:d=0.15",
         "-f", "null", "-"],
        capture_output=True, timeout=120,
    )
    out = r.stderr.decode(errors="replace")
    starts = [float(m) for m in re.findall(r"silence_start: ([0-9.]+)", out)]
    ends = [float(m) for m in re.findall(r"silence_end: ([0-9.]+)", out)]
    for s, e in zip(starts, ends):
        if s >= after_seconds - 0.1:
            resume = s + min(0.1, (e - s) / 2)
            logger.info(
                "Pausa de fala encontrada: %.2f–%.2fs → tema retoma em %.2fs",
                s, e, resume,
            )
            return resume
    logger.warning("Nenhuma pausa após %.2fs — retomando direto", after_seconds)
    return after_seconds


def _mux_tts_over_theme_intro(theme_video_path: str, tts_path: str) -> bytes:
    """Substitui o áudio da INTRO do theme_video (os primeiros segundos
    onde a candidata fala o placeholder de saudação) pelo TTS do nome.

    Visual muito superior ao greeting video de 1.1s (frame parado): aqui
    ela aparece de fato falando na câmera, com cadência parecida com a
    do TTS. É o mesmo visual que o worker usa no name_sync sem greeting
    (lipsync sobre o início do theme_video)."""
    import subprocess
    import tempfile

    tmpdir = tempfile.mkdtemp(prefix="test_mux_")
    video_in = os.path.join(tmpdir, "theme.mp4")
    audio_in = os.path.join(tmpdir, "tts.mp3")
    out = os.path.join(tmpdir, "name_sync.mp4")

    with open(video_in, "wb") as f:
        f.write(db.download_file(theme_video_path))
    with open(audio_in, "wb") as f:
        f.write(db.download_file(tts_path))

    # -shortest corta a intro na duração do TTS (TTS ~4.7s < intro 4.9s)
    subprocess.run(
        [
            "ffmpeg", "-i", video_in, "-i", audio_in,
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "256k",
            "-shortest", "-y", out,
        ],
        capture_output=True, timeout=120, check=True,
    )
    with open(out, "rb") as f:
        return f.read()


def main():
    base_model = db.get_base_model(BASE_MODEL_ID)
    if not base_model:
        sys.exit(f"base_model {BASE_MODEL_ID} não encontrado")

    lip_cfg = base_model.get("lipsync_config") or {}
    voice_id = base_model["voice_models"]["elevenlabs_voice_id"]
    greeting_path = base_model.get("greeting_video_path")
    if not greeting_path:
        sys.exit("base_model sem greeting_video_path — teste requer fluxo novo")

    theme = (
        db.client.table("video_theme_models")
        .select("theme_slug, video_storage_path")
        .eq("base_model_id", BASE_MODEL_ID)
        .eq("is_uploaded", True)
        .limit(1)
        .execute()
    ).data
    if not theme:
        sys.exit("nenhum theme_video uploaded pra esse base_model")
    theme = theme[0]
    logger.info("Tema do teste: %s", theme["theme_slug"])

    # ─── 1. TTS limpo (sem música — ela agora entra no compose) ───
    # Template afirmativo: nome no FINAL com exclamação fecha a frase
    # com entonação descendente (a versão anterior, "...e pela sua
    # contribuição.", terminava como quem ia continuar falando).
    # Em produção: atualizar lipsync_config.greeting_template no banco.
    # Frase curta (janela de ângulo único = 3.84s), fecho afirmativo.
    # SEM padding — o silêncio do fim é aparado e fica só 0.1s de
    # respiro técnico; a fala emenda direto no conteúdo do tema.
    # O <break> no final faz o modelo FECHAR a entonação da frase
    # (sem ele, termina "aberta", como quem vai continuar); o silêncio
    # que o break gera é aparado depois.
    # stability 1.0 da config dela achata a prosódia — baixamos pra 0.5
    # com style 0.55 pra entonação descendente de afirmação.
    # O <break> de fechamento agora é adicionado pelo próprio
    # generate_tts_name_sync (comportamento padrão de produção).
    greeting_tpl = "Muito obrigada pela sua mensagem, {nome}!"
    text = greeting_tpl.replace("{nome}", TEST_NAME)
    tts_settings = dict(lip_cfg.get("tts") or {})
    tts_settings.update({"stability": 0.5, "style": 0.55})
    logger.info("TTS: '%s' (sem padding, settings=%s)", text, tts_settings)
    audio_bytes = generate_tts_name_sync(
        text, voice_id,
        tts_settings=tts_settings,
    )

    tts_path = f"tts/{TEST_TAG}.mp3"
    db.upload_file(tts_path, audio_bytes, "audio/mpeg")

    # ─── 2. Lipsync sobre o TAKE CONTÍNUO do theme_video ───
    # Base = recorte do take contínuo a partir de NAME_BASE_START (sem o
    # corte de ângulo de 1.08s). O lipsync re-sincroniza a boca dela pro
    # nome sobre esse take; o tema depois retoma EXATO de onde o nome
    # parou → um único take fluindo, sem troca de ângulo na saudação.
    # Chaves: pool de produção (kling_keys, autorizado), com fallback mux.
    import requests
    from steps.lipsync import SyncLabsJobFailed

    theme_local = "/tmp/theme_src.mp4"
    with open(theme_local, "wb") as f:
        f.write(db.download_file(theme["video_storage_path"]))

    name_dur = _ffprobe_dur_bytes(audio_bytes)
    if name_dur > NAME_BASE_DURATION + 0.05:
        logger.warning(
            "TTS (%.2fs) maior que a janela de ângulo único (%.2fs) — "
            "a base vai estourar o corte; considere encurtar a frase",
            name_dur, NAME_BASE_DURATION,
        )
    # Base = só a duração da fala (cut_off corta ali) — sem preencher
    # até o fim da janela; o tema entra logo que ela termina o nome.
    base_clip = _trim_local_video(
        theme_local, NAME_BASE_START, min(name_dur + 0.2, NAME_BASE_DURATION)
    )
    base_clip_path = f"name_base/{TEST_TAG}.mp4"
    with open(base_clip, "rb") as f:
        db.upload_file(base_clip_path, f.read(), "video/mp4")

    pool_keys = (
        db.client.table("kling_keys")
        .select("id, access_key")
        .eq("is_active", True)
        .execute()
    ).data or []
    logger.info("Pool Sync Labs: %d chaves ativas", len(pool_keys))

    name_sync_bytes = None
    for key_row in pool_keys:
        try:
            logger.info(
                "Lipsync via Sync Labs (model=%s, key=%s...)",
                lip_cfg.get("model", "lipsync-2-pro"), str(key_row["id"])[:8],
            )
            lipsync_url = run_lipsync(
                db.create_signed_url(base_clip_path),
                db.create_signed_url(tts_path),
                api_key=key_row["access_key"],
                model=lip_cfg.get("model", "lipsync-2-pro"),
                sync_mode="cut_off",  # corta a base na duração do TTS
                temperature=float(lip_cfg.get("temperature", 0.3)),
            )
            name_sync_bytes = requests.get(lipsync_url, timeout=120).content
            break
        except SyncLabsJobFailed as e:
            logger.warning("Chave %s falhou: %s", str(key_row["id"])[:8], e)

    if name_sync_bytes is None:
        logger.warning("Nenhuma chave do pool funcionou — mux TTS sobre a base")
        name_sync_bytes = _mux_tts_over_theme_intro(base_clip_path, tts_path)
    name_sync_path = f"name_sync_cached/{TEST_TAG}.mp4"
    db.upload_file(name_sync_path, name_sync_bytes, "video/mp4")

    # Tema retoma em THEME_CONTENT_START (4.92s) — o início real do
    # conteúdo, no corte natural da edição original. TODO o conteúdo
    # do tema é preservado (estrutura v5).
    with open("/tmp/_ns.mp4", "wb") as f:
        f.write(name_sync_bytes)
    actual_name_dur = _ffprobe_dur("/tmp/_ns.mp4")
    theme_resume_offset = THEME_CONTENT_START
    logger.info(
        "name_sync %.2fs (base %.2f–%.2fs) | tema retoma em %.2fs (conteúdo completo)",
        actual_name_dur, NAME_BASE_START,
        NAME_BASE_START + actual_name_dur, theme_resume_offset,
    )

    # ─── 3. Compose: crossfade + trilha contínua sob o corpo + loudnorm ───
    with open(SELFIE_SAMPLE, "rb") as f:
        selfie_bytes = f.read()
    final_bytes = compose_videos(
        selfie_bytes, "mp4",
        [
            db.create_signed_url(name_sync_path),
            db.create_signed_url(theme["video_storage_path"]),
        ],
        closing_video_path=base_model.get("closing_video_path"),
        middle_offsets=[0.0, theme_resume_offset],
        bg_music_path=OVERRIDE_BG_MUSIC,
    )

    local_copy = "/tmp/test_junction_final.mp4"
    with open(local_copy, "wb") as f:
        f.write(final_bytes)
    logger.info("Final salvo em %s (%d bytes)", local_copy, len(final_bytes))

    final_path = f"final/{TEST_TAG}_{int(time.time())}.mp4"
    db.upload_file(final_path, final_bytes, "video/mp4")

    # ─── 4. Envia pro WhatsApp de teste ───
    send_whatsapp(
        TEST_PHONE, TEST_NAME,
        db.create_signed_url(final_path),
        message_template=(
            "🧪 TESTE v9, {name}: zero silêncio após o nome (fala emenda "
            "direto no tema) + entonação de afirmação no fecho da frase."
        ),
    )
    logger.info("✅ Teste enviado pra %s", TEST_PHONE)


if __name__ == "__main__":
    main()
