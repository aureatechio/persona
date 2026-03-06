"""Step 3: Generate TTS audio using ElevenLabs cloned voice + outdoor audio FX."""

import re
import subprocess
import tempfile
import os
import logging
import requests

from config import ELEVENLABS_API_KEY

logger = logging.getLogger("worker.tts")

TTS_TIMEOUT = 30  # seconds
FFMPEG_TIMEOUT = 30  # seconds


def _apply_outdoor_fx(raw_audio: bytes) -> bytes:
    """
    Apply outdoor environment audio effect using FFmpeg:
    - Subtle reverb (echo)
    - Pink noise (road hum) + brown noise (engine rumble)
    - Bandpass filter at 800Hz + tremolo (simulates distant traffic)
    Returns processed audio bytes. Falls back to raw on failure.
    """
    tmpdir = tempfile.mkdtemp(prefix="tts_fx_")
    raw_path = os.path.join(tmpdir, "raw.mp3")
    out_path = os.path.join(tmpdir, "outdoor.mp3")

    try:
        with open(raw_path, "wb") as f:
            f.write(raw_audio)

        # Reverb (aecho) + pink noise low-passed to simulate traffic hum
        # Uses only basic filters guaranteed in Debian/Ubuntu FFmpeg
        filter_complex = (
            "[0:a]aecho=0.8:0.7:60|80:0.15|0.1[reverbed];"
            "anoisesrc=c=pink:a=0.006[noise];"
            "[noise]lowpass=f=900[traffic];"
            "[reverbed][traffic]amix=inputs=2:duration=first:weights=1 0.08[out]"
        )

        result = subprocess.run(
            [
                "ffmpeg", "-i", raw_path,
                "-filter_complex", filter_complex,
                "-map", "[out]",
                "-c:a", "libmp3lame", "-b:a", "192k",
                "-y", out_path,
            ],
            capture_output=True,
            timeout=FFMPEG_TIMEOUT,
        )

        if result.returncode != 0:
            logger.warning(
                "Audio FX ffmpeg failed (rc=%d): %s",
                result.returncode,
                result.stderr.decode(errors="replace")[:500],
            )
            return raw_audio

        with open(out_path, "rb") as f:
            processed = f.read()

        logger.info("Outdoor audio FX applied: %d → %d bytes", len(raw_audio), len(processed))
        return processed

    except Exception as e:
        logger.warning("Audio FX failed, using raw TTS: %s", e)
        return raw_audio

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
    """
    Pre-process text to improve TTS pronunciation of Brazilian city/neighborhood names.
    Expands hyphenated syllables (Cu-ba-tão → Cubatão) and adds commas around
    city names to force the TTS to pause and pronounce them as complete words.
    """
    # Remove syllable hyphens the GPT may have inserted (e.g. "Cu-ba-tão" → "Cubatão")
    # Pattern: sequences of 2-4 letter groups separated by hyphens, at least 3 groups
    def _join_syllables(m: re.Match) -> str:
        return m.group(0).replace("-", "")

    text = re.sub(
        r'\b[A-ZÀ-Ú][a-zà-ú]{1,4}(?:-[A-Za-zà-ú]{1,4}){2,}\b',
        _join_syllables,
        text,
    )

    # Add slight pause (comma) before city names ending in common Brazilian suffixes
    # This prevents the TTS from merging the city name with surrounding words
    suffixes = r'(?:tão|ções|lhos|íba|uba|uba|anga|inga|ema|uma|aba|aia|eira|ópolis|ândia|lândia)'
    text = re.sub(
        rf'(\s)([A-ZÀ-Ú][a-zà-ú]*{suffixes})\b',
        r'\1\2,',
        text,
    )

    return text


def generate_tts(text: str, voice_id: str) -> bytes:
    """
    Generate TTS audio using ElevenLabs + apply outdoor environment FX.
    Returns processed audio bytes (MP3).
    """
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    # Fix pronunciation of city names before sending to TTS
    processed_text = _fix_pronunciation(text)
    if processed_text != text:
        logger.info("Pronunciation fix applied: '%s' → '%s'", text[:80], processed_text[:80])

    logger.info("Generating TTS for voice '%s' (%d chars)...", voice_id, len(processed_text))

    response = requests.post(
        url,
        headers={
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
        },
        json={
            "text": processed_text,
            "model_id": "eleven_v3",
            "language_code": "pt",
            "apply_text_normalization": "on",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.85,
                "style": 0.5,
                "use_speaker_boost": True,
                "speed": 1.0,
            },
        },
        timeout=TTS_TIMEOUT,
    )

    response.raise_for_status()
    raw_audio = response.content
    logger.info("TTS raw audio: %d bytes", len(raw_audio))

    # Apply outdoor environment effect
    audio_bytes = _apply_outdoor_fx(raw_audio)
    return audio_bytes
