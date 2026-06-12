"""V2 Step 3: Generate TTS audio using ElevenLabs cloned voice."""

import re
import subprocess
import tempfile
import os
import logging
import requests

from config import ELEVENLABS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

logger = logging.getLogger("v2-worker.tts")

TTS_TIMEOUT = 30
FFMPEG_TIMEOUT = 30

PRONUNCIATION_DICT_ID = "d9hTg7V9pjOs8aojKFYl"

# Background music config
BG_MUSIC_VOLUME = 0.35
TAIL_SILENCE_S = 0.05
VOICE_VOLUME = 2.0

_bg_music_cache: dict[str, bytes] = {}


def _get_background_music(storage_path: str) -> bytes | None:
    """Download background music from Supabase Storage (cached by path)."""
    if storage_path in _bg_music_cache:
        return _bg_music_cache[storage_path]
    try:
        url = f"{SUPABASE_URL}/storage/v1/object/voice-models/{storage_path}"
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"},
            timeout=15,
        )
        resp.raise_for_status()
        _bg_music_cache[storage_path] = resp.content
        logger.info("Background music downloaded (%s): %d bytes", storage_path, len(resp.content))
        return _bg_music_cache[storage_path]
    except Exception as e:
        logger.warning("Failed to download background music (%s): %s", storage_path, e)
        return None


def _mix_background_music(voice_audio: bytes, bg_music_path: str | None = None) -> bytes:
    """Mix voice audio with background music track."""
    if not bg_music_path:
        return voice_audio
    bg_music = _get_background_music(bg_music_path)
    if bg_music is None:
        return voice_audio

    tmpdir = tempfile.mkdtemp(prefix="v2_tts_mix_")
    voice_path = os.path.join(tmpdir, "voice.mp3")
    music_path = os.path.join(tmpdir, "music.mp3")
    out_path = os.path.join(tmpdir, "mixed.mp3")

    try:
        with open(voice_path, "wb") as f:
            f.write(voice_audio)
        with open(music_path, "wb") as f:
            f.write(bg_music)

        filter_complex = (
            f"[0:a]volume={VOICE_VOLUME}[voice];"
            f"[1:a]volume={BG_MUSIC_VOLUME},afade=t=in:d=0.3,afade=t=out:st=18:d=2[bg];"
            "[voice][bg]amix=inputs=2:duration=first:weights=1 1[out]"
        )

        result = subprocess.run(
            [
                "ffmpeg", "-i", voice_path, "-i", music_path,
                "-filter_complex", filter_complex,
                "-map", "[out]",
                "-c:a", "libmp3lame", "-b:a", "192k",
                "-y", out_path,
            ],
            capture_output=True,
            timeout=FFMPEG_TIMEOUT,
        )

        if result.returncode != 0:
            logger.warning("Music mix failed (rc=%d)", result.returncode)
            return voice_audio

        with open(out_path, "rb") as f:
            mixed = f.read()

        logger.info("Background music mixed: %d -> %d bytes", len(voice_audio), len(mixed))
        return mixed

    except Exception as e:
        logger.warning("Music mix failed: %s", e)
        return voice_audio

    finally:
        for fname in os.listdir(tmpdir):
            try:
                os.unlink(os.path.join(tmpdir, fname))
            except OSError:
                pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass


def _add_tail_silence(audio: bytes, seconds: float = 1.5) -> bytes:
    """Append silence at the end of audio to prevent abrupt cut in lip-sync."""
    tmpdir = tempfile.mkdtemp(prefix="v2_tts_pad_")
    input_path = os.path.join(tmpdir, "input.mp3")
    output_path = os.path.join(tmpdir, "padded.mp3")

    try:
        with open(input_path, "wb") as f:
            f.write(audio)

        result = subprocess.run(
            [
                "ffmpeg", "-i", input_path,
                "-af", f"apad=pad_dur={seconds}",
                "-c:a", "libmp3lame", "-b:a", "192k",
                "-y", output_path,
            ],
            capture_output=True,
            timeout=10,
        )

        if result.returncode != 0:
            return audio

        with open(output_path, "rb") as f:
            padded = f.read()

        logger.info("Tail silence added: %d -> %d bytes (+%.1fs)", len(audio), len(padded), seconds)
        return padded

    except Exception:
        return audio

    finally:
        for fname in os.listdir(tmpdir):
            try:
                os.unlink(os.path.join(tmpdir, fname))
            except OSError:
                pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass


def _fix_pronunciation(text: str) -> str:
    """Generic pronunciation fixes for Brazilian Portuguese TTS."""
    # Hiato
    def _fix_hiatus(m: re.Match) -> str:
        before, after = m.group(1), m.group(2)
        if after.endswith('s'):
            return f"{before}{after}s"
        return m.group(0)

    text = re.sub(r'\b([A-ZÀ-Úa-zà-ú]*[aeiouAEIOU])([íúÍÚ][s]?)\b', _fix_hiatus, text)

    # Cedilha -> SS em nomes próprios
    text = re.sub(r'\b([A-ZÀ-Ú][a-zà-ú]*?)ç([a-zà-ú])', lambda m: m.group(1) + "ss" + m.group(2), text)

    # Siglas
    def _fix_sigla(pattern: str, replacement: str, txt: str) -> str:
        def _repl(m: re.Match) -> str:
            after = m.group(0)
            if after[-1] in '.!?,;:':
                return replacement + after[-1]
            return replacement
        return re.sub(pattern, _repl, txt)

    text = _fix_sigla(r'\bP\.?\s*L\.?[.!?,;:]?', 'Pê Éli', text)
    text = _fix_sigla(r'\bP\.?\s*T\.?[.!?,;:]?(?!\w)', 'Pê Tê', text)
    text = _fix_sigla(r'\bM\.?\s*D\.?\s*B\.?[.!?,;:]?', 'Ême Dê Bê', text)

    # Hífens silábicos do GPT
    text = re.sub(
        r'\b[A-ZÀ-Ú][a-zà-ú]{1,4}(?:-[A-Za-zà-ú]{1,4}){2,}\b',
        lambda m: m.group(0).replace("-", ""),
        text,
    )

    # TH -> T em nomes próprios
    text = re.sub(r'\b([A-ZÀ-Ú][a-zà-ú]*?)th([aeiouáéíóúãõ])', lambda m: m.group(1) + "t" + m.group(2), text)
    text = re.sub(r'\bArthur\b', 'Artur', text)

    # Dedup
    text = re.sub(r'\b(\w+(?:\s+\w+){2,6})\s+\1\b', r'\1', text)

    return text


def generate_tts(text: str, voice_id: str, bg_music_path: str | None = None) -> tuple[bytes, str]:
    """Generate TTS audio using ElevenLabs (full_video/legacy flow)."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    processed_text = _fix_pronunciation(text)
    if processed_text != text:
        logger.info("Pronunciation fix: '%s' -> '%s'", text[:80], processed_text[:80])

    logger.info("Generating TTS for voice '%s' (%d chars)...", voice_id, len(processed_text))

    response = requests.post(
        url + "?output_format=mp3_44100_128",
        headers={
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
        },
        json={
            "text": processed_text,
            "model_id": "eleven_multilingual_v2",
            "language_code": "pt",
            "apply_text_normalization": "on",
            "voice_settings": {
                "stability": 0.35,
                "similarity_boost": 0.85,
                "style": 0.5,
                "use_speaker_boost": True,
                "speed": 0.9,
            },
        },
        timeout=TTS_TIMEOUT,
    )

    response.raise_for_status()
    raw_audio = response.content
    logger.info("TTS raw audio: %d bytes", len(raw_audio))

    padded_audio = _add_tail_silence(raw_audio, seconds=TAIL_SILENCE_S) if TAIL_SILENCE_S > 0 else raw_audio
    final_audio = _mix_background_music(padded_audio, bg_music_path=bg_music_path)

    return final_audio, processed_text


def _trim_tail_silence(audio: bytes, threshold_db: int = -45) -> bytes:
    """Remove o silêncio do FIM do áudio (truque areverse + silenceremove).
    O TTS devolve um rabo de silêncio que, somado ao crossfade, vira
    "ar morto" na junção. Fallback: áudio original em falha."""
    tmpdir = tempfile.mkdtemp(prefix="tts_trim_")
    input_path = os.path.join(tmpdir, "in.mp3")
    output_path = os.path.join(tmpdir, "out.mp3")
    try:
        with open(input_path, "wb") as f:
            f.write(audio)
        result = subprocess.run(
            [
                "ffmpeg", "-i", input_path,
                "-af",
                f"areverse,silenceremove=start_periods=1:"
                f"start_threshold={threshold_db}dB:start_silence=0.03,areverse",
                "-c:a", "libmp3lame", "-b:a", "192k",
                "-y", output_path,
            ],
            capture_output=True, timeout=15,
        )
        if result.returncode != 0:
            return audio
        with open(output_path, "rb") as f:
            trimmed = f.read()
        logger.info("Tail silence trimmed: %d → %d bytes", len(audio), len(trimmed))
        return trimmed
    except Exception:
        return audio
    finally:
        for fname in os.listdir(tmpdir):
            try:
                os.unlink(os.path.join(tmpdir, fname))
            except OSError:
                pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass


def generate_tts_name_sync(text: str, voice_id: str, tts_settings: dict | None = None) -> bytes:
    """TTS for name_sync flow (short greeting).

    Sai LIMPO (sem trilha de fundo): a música entra no compose como
    trilha contínua sob o corpo inteiro — mixada aqui ela morria em
    corte seco na junção. O <break> no fim faz o modelo FECHAR a
    entonação (afirmação) em vez de terminar "aberta", como quem vai
    continuar falando; o silêncio que o break gera é aparado e fica só
    0.1s de respiro — a fala emenda direto no tema."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    voice_settings = {
        "stability": 0.5,
        "similarity_boost": 0.75,
        "style": 0.0,
        "use_speaker_boost": True,
        "speed": 1.0,
    }
    if tts_settings:
        voice_settings.update(tts_settings)

    logger.info("Generating NAME_SYNC TTS for voice '%s': '%s' (custom=%s)", voice_id, text, bool(tts_settings))

    request_text = text.rstrip() + ' <break time="0.5s" />'

    response = requests.post(
        url + "?output_format=mp3_44100_128",
        headers={
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
        },
        json={
            "text": request_text,
            "model_id": "eleven_multilingual_v2",
            "language_code": "pt",
            "apply_text_normalization": "off",
            "voice_settings": voice_settings,
        },
        timeout=TTS_TIMEOUT,
    )

    response.raise_for_status()
    audio = response.content
    logger.info("NAME_SYNC TTS raw audio: %d bytes", len(audio))

    audio = _trim_tail_silence(audio)
    # Respiro >= XFADE_DURATION do compose (0.3s): a sobreposição do
    # crossfade de vídeo cai no silêncio, não em cima da fala do nome.
    return _add_tail_silence(audio, seconds=0.35)
