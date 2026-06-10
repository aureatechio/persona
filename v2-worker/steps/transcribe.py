"""V2 Step 1: Transcribe selfie video audio using OpenAI Whisper API."""

import subprocess
import tempfile
import os
import time
import logging
import requests

from config import OPENAI_API_KEY

logger = logging.getLogger("v2-worker.transcribe")

WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions"
FFMPEG_TIMEOUT = 8


def _extract_audio(video_bytes: bytes, file_ext: str = "mp4") -> bytes:
    """Extract audio from video using FFmpeg."""
    tmpdir = tempfile.mkdtemp(prefix="v2_transcribe_")
    video_path = os.path.join(tmpdir, f"input.{file_ext}")
    audio_path = os.path.join(tmpdir, "audio.mp3")

    try:
        with open(video_path, "wb") as f:
            f.write(video_bytes)

        result = subprocess.run(
            [
                "ffmpeg", "-i", video_path,
                "-vn", "-acodec", "libmp3lame", "-b:a", "128k",
                "-y", audio_path,
            ],
            capture_output=True,
            timeout=FFMPEG_TIMEOUT,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"FFmpeg audio extraction failed (rc={result.returncode}): "
                f"{result.stderr.decode(errors='replace')[:300]}"
            )

        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        logger.info("Audio extracted: %d -> %d bytes", len(video_bytes), len(audio_bytes))
        return audio_bytes

    finally:
        for fname in (video_path, audio_path):
            try:
                os.unlink(fname)
            except OSError:
                pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass


def transcribe(video_bytes: bytes, file_ext: str = "mp4") -> str:
    """Transcribe audio from video bytes using OpenAI Whisper API."""
    t0 = time.time()
    logger.info("Extracting audio from %d bytes (%s)...", len(video_bytes), file_ext)
    audio_bytes = _extract_audio(video_bytes, file_ext)

    logger.info("Sending %d bytes to Whisper API...", len(audio_bytes))
    response = requests.post(
        WHISPER_API_URL,
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
        files={"file": ("audio.mp3", audio_bytes, "audio/mpeg")},
        data={"model": "whisper-1", "language": "pt"},
        timeout=15,
    )

    response.raise_for_status()
    text = response.json().get("text", "").strip()
    logger.info("Whisper took %.1fs — transcription: '%s'", time.time() - t0, text[:100])
    return text
