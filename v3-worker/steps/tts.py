"""V3 Step: Generate full TTS audio using ElevenLabs cloned voice (with background music)."""

from __future__ import annotations

import re
import subprocess
import tempfile
import os
import logging
import requests

from config import ELEVENLABS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

logger = logging.getLogger("v3-worker.tts")

TTS_TIMEOUT = 60
FFMPEG_TIMEOUT = 30

BG_MUSIC_VOLUME = 0.35
TAIL_SILENCE_S = 0.5
VOICE_VOLUME = 2.0

_bg_music_cache: dict[str, bytes] = {}


def _get_background_music(storage_path: str) -> bytes | None:
    if storage_path in _bg_music_cache:
        return _bg_music_cache[storage_path]
    try:
        url = f"{SUPABASE_URL}/storage/v1/object/voice-models/{storage_path}"
        resp = requests.get(url, headers={"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"}, timeout=15)
        resp.raise_for_status()
        _bg_music_cache[storage_path] = resp.content
        logger.info("Background music downloaded (%s): %d bytes", storage_path, len(resp.content))
        return _bg_music_cache[storage_path]
    except Exception as e:
        logger.warning("Failed to download background music (%s): %s", storage_path, e)
        return None


def _mix_background_music(voice_audio: bytes, bg_music_path: str | None = None) -> bytes:
    if not bg_music_path:
        return voice_audio
    bg_music = _get_background_music(bg_music_path)
    if bg_music is None:
        return voice_audio

    tmpdir = tempfile.mkdtemp(prefix="v3_tts_mix_")
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
            f"[1:a]volume={BG_MUSIC_VOLUME},afade=t=in:d=0.3,afade=t=out:st=25:d=3[bg];"
            "[voice][bg]amix=inputs=2:duration=first:weights=1 1[out]"
        )

        result = subprocess.run(
            ["ffmpeg", "-i", voice_path, "-i", music_path,
             "-filter_complex", filter_complex,
             "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k",
             "-y", out_path],
            capture_output=True, timeout=FFMPEG_TIMEOUT,
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
            try: os.unlink(os.path.join(tmpdir, fname))
            except OSError: pass
        try: os.rmdir(tmpdir)
        except OSError: pass


def _add_tail_silence(audio: bytes, seconds: float = 0.5) -> bytes:
    tmpdir = tempfile.mkdtemp(prefix="v3_tts_pad_")
    input_path = os.path.join(tmpdir, "input.mp3")
    output_path = os.path.join(tmpdir, "padded.mp3")
    try:
        with open(input_path, "wb") as f:
            f.write(audio)
        result = subprocess.run(
            ["ffmpeg", "-i", input_path, "-af", f"apad=pad_dur={seconds}",
             "-c:a", "libmp3lame", "-b:a", "192k", "-y", output_path],
            capture_output=True, timeout=10,
        )
        if result.returncode != 0:
            return audio
        with open(output_path, "rb") as f:
            return f.read()
    except Exception:
        return audio
    finally:
        for fname in os.listdir(tmpdir):
            try: os.unlink(os.path.join(tmpdir, fname))
            except OSError: pass
        try: os.rmdir(tmpdir)
        except OSError: pass


def generate_tts_full(text: str, voice_id: str, tts_config: dict | None = None, bg_music_path: str | None = None) -> tuple[bytes, str]:
    """Generate full TTS with optional background music for V3 pipeline."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    voice_settings = {
        "stability": 0.5,
        "similarity_boost": 0.75,
        "style": 0.0,
        "use_speaker_boost": True,
        "speed": 1.0,
    }
    if tts_config:
        voice_settings.update(tts_config)

    logger.info("Generating V3 TTS for voice '%s' (%d chars)...", voice_id, len(text))

    response = requests.post(
        url + "?output_format=mp3_44100_128",
        headers={"Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY},
        json={
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "language_code": "pt",
            "apply_text_normalization": "on",
            "voice_settings": voice_settings,
        },
        timeout=TTS_TIMEOUT,
    )

    response.raise_for_status()
    raw_audio = response.content
    logger.info("V3 TTS raw audio: %d bytes", len(raw_audio))

    padded = _add_tail_silence(raw_audio, seconds=TAIL_SILENCE_S)
    final_audio = _mix_background_music(padded, bg_music_path=bg_music_path)

    return final_audio, text
