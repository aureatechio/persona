"""Generate TTS audio with ElevenLabs Thais voice (eleven_v3, stability 0.7)."""

import logging
import requests

from config import ELEVENLABS_API_KEY, TTS_VOICE_ID, TTS_MODEL_ID, TTS_STABILITY

logger = logging.getLogger("worker.tts")

TTS_TIMEOUT = 30


def generate_tts(text: str) -> bytes:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{TTS_VOICE_ID}?output_format=mp3_44100_128"
    logger.info("Generating TTS (voice=%s, model=%s, stability=%.2f, %d chars)",
                TTS_VOICE_ID[:8], TTS_MODEL_ID, TTS_STABILITY, len(text))

    response = requests.post(
        url,
        headers={
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
        },
        json={
            "text": text,
            "model_id": TTS_MODEL_ID,
            "voice_settings": {"stability": TTS_STABILITY},
        },
        timeout=TTS_TIMEOUT,
    )
    response.raise_for_status()
    audio = response.content
    logger.info("TTS audio: %d bytes", len(audio))
    return audio
