"""Step 1: Transcribe selfie video audio using OpenAI Whisper API."""

import subprocess
import tempfile
import os
import logging
import requests

from config import OPENAI_API_KEY

logger = logging.getLogger("worker.transcribe")

WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions"
FFMPEG_TIMEOUT = 15  # seconds


def _extract_audio(video_bytes: bytes, file_ext: str = "mp4") -> tuple[bytes, str]:
    """Extract audio from video using FFmpeg. Returns (audio_bytes, tmp_path)."""
    tmpdir = tempfile.mkdtemp(prefix="transcribe_")
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

        logger.info("Audio extracted: %d → %d bytes (%.0f%% reduction)",
                     len(video_bytes), len(audio_bytes),
                     (1 - len(audio_bytes) / len(video_bytes)) * 100)

        return audio_bytes, audio_path

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
    """
    Transcribe audio from video bytes using OpenAI Whisper API.
    Always extracts audio first to keep file size small.
    Returns the transcription text.
    """
    logger.info("Extracting audio from %d bytes (%s)...", len(video_bytes), file_ext)
    audio_bytes, _ = _extract_audio(video_bytes, file_ext)

    logger.info("Sending %d bytes to OpenAI Whisper API...", len(audio_bytes))

    response = requests.post(
        WHISPER_API_URL,
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
        files={"file": ("audio.mp3", audio_bytes, "audio/mpeg")},
        data={"model": "whisper-1", "language": "pt"},
        timeout=30,
    )

    response.raise_for_status()
    text = response.json().get("text", "").strip()
    logger.info("Transcription: '%s'", text[:100])
    return text
