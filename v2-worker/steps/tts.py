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
BG_MUSIC_STORAGE_PATH = "assets/background_music.mp3"
BG_MUSIC_VOLUME = 0.35
TAIL_SILENCE_S = 0.05
VOICE_VOLUME = 2.0

_bg_music_cache: bytes | None = None


def _get_background_music() -> bytes | None:
    """Download background music from Supabase Storage (cached)."""
    global _bg_music_cache
    if _bg_music_cache is not None:
        return _bg_music_cache
    try:
        url = f"{SUPABASE_URL}/storage/v1/object/voice-models/{BG_MUSIC_STORAGE_PATH}"
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"},
            timeout=15,
        )
        resp.raise_for_status()
        _bg_music_cache = resp.content
        logger.info("Background music downloaded: %d bytes", len(_bg_music_cache))
        return _bg_music_cache
    except Exception as e:
        logger.warning("Failed to download background music: %s", e)
        return None


def _mix_background_music(voice_audio: bytes) -> bytes:
    """Mix voice audio with background music track."""
    bg_music = _get_background_music()
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


def generate_tts(text: str, voice_id: str) -> tuple[bytes, str]:
    """Generate TTS audio using ElevenLabs (full_video/legacy flow — with music)."""
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
    final_audio = _mix_background_music(padded_audio)

    return final_audio, processed_text


def _pad_to_duration(audio: bytes, target_seconds: float) -> bytes:
    """Pad audio with silence to reach exactly target_seconds duration."""
    tmpdir = tempfile.mkdtemp(prefix="v2_tts_target_")
    input_path = os.path.join(tmpdir, "input.mp3")
    output_path = os.path.join(tmpdir, "padded.mp3")

    try:
        with open(input_path, "wb") as f:
            f.write(audio)

        # Get current duration
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", input_path],
            capture_output=True, timeout=10,
        )
        current_dur = float(probe.stdout.decode().strip())
        pad_needed = target_seconds - current_dur

        if pad_needed <= 0.05:
            logger.info("Audio already %.2fs (target %.2fs), no padding needed", current_dur, target_seconds)
            return audio

        logger.info("Padding audio from %.2fs to %.2fs (+%.2fs silence)", current_dur, target_seconds, pad_needed)

        result = subprocess.run(
            [
                "ffmpeg", "-i", input_path,
                "-af", f"apad=pad_dur={pad_needed}",
                "-c:a", "libmp3lame", "-b:a", "192k",
                "-y", output_path,
            ],
            capture_output=True, timeout=10,
        )

        if result.returncode != 0:
            logger.warning("Pad to duration failed, returning original")
            return audio

        with open(output_path, "rb") as f:
            padded = f.read()

        logger.info("Padded to target: %d -> %d bytes (%.2fs)", len(audio), len(padded), target_seconds)
        return padded

    except Exception as e:
        logger.warning("Pad to duration failed: %s", e)
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


def generate_tts_name_sync(
    text: str, voice_id: str, tts_settings: dict | None = None, target_duration: float = 0,
) -> bytes:
    """TTS for name_sync flow (short greeting, no background music).

    If target_duration > 0, pads the audio with silence to match the
    theme video intro length so the lipsync replaces the intro exactly.
    """
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

    logger.info("Generating NAME_SYNC TTS for voice '%s': '%s' (custom=%s, target=%.1fs)", voice_id, text, bool(tts_settings), target_duration)

    response = requests.post(
        url + "?output_format=mp3_44100_128",
        headers={
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
        },
        json={
            "text": text,
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

    if target_duration > 0:
        return _pad_to_duration(audio, target_duration)

    padded = _add_tail_silence(audio, seconds=0.2) if TAIL_SILENCE_S > 0 else audio
    return padded
