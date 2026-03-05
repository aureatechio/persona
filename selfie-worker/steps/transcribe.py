"""Step 1: Transcribe selfie video audio using local Whisper."""

import tempfile
import os
import whisper
import logging

from config import WHISPER_MODEL

logger = logging.getLogger("worker.transcribe")

# Load model once at import time (cached in memory)
_model = None


def _get_model():
    global _model
    if _model is None:
        logger.info("Loading Whisper model '%s'...", WHISPER_MODEL)
        _model = whisper.load_model(WHISPER_MODEL)
        logger.info("Whisper model loaded.")
    return _model


def transcribe(video_bytes: bytes, file_ext: str = "mp4") -> str:
    """
    Transcribe audio from video bytes using local Whisper.
    Returns the transcription text.
    """
    model = _get_model()

    with tempfile.NamedTemporaryFile(suffix=f".{file_ext}", delete=False) as f:
        f.write(video_bytes)
        tmp_path = f.name

    try:
        logger.info("Transcribing %d bytes (%s)...", len(video_bytes), file_ext)
        result = model.transcribe(tmp_path, language="pt", fp16=False)
        text = result["text"].strip()
        logger.info("Transcription: '%s'", text[:100])
        return text
    finally:
        os.unlink(tmp_path)
