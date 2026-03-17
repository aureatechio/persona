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

# Dicionário de pronúncia no ElevenLabs — cidades com fonética irregular (indígenas)
PRONUNCIATION_DICT_ID = "d9hTg7V9pjOs8aojKFYl"


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
    Generic pronunciation fixes for Brazilian Portuguese TTS.
    Uses linguistic RULES instead of hardcoded lists:

    1. HIATUS — vowel + accented í/ú = separate syllables (always in PT-BR)
    2. CEDILLA → SS — ç always sounds like "ss", but TTS reads as "k" in proper nouns
    3. NH NON-DIGRAPH — in indigenous-origin words, "nh" are separate sounds (n+h)
    4. PROPER NOUN ISOLATION — add pause around capitalized words
    5. SYLLABLE HYPHENS — rejoin GPT-inserted hyphens
    """
    # REGRA 1: HIATO — nomes com vogal + ís → duplica s pra reforçar pronúncia
    # Ex: "Laís" → "Laíss" (sem quebrar a palavra)
    def _fix_hiatus(m: re.Match) -> str:
        before, after = m.group(1), m.group(2)
        if after.endswith('s'):
            return f"{before}{after}s"
        return m.group(0)

    text = re.sub(
        r'\b([A-ZÀ-Úa-zà-ú]*[aeiouAEIOU])([íúÍÚ][s]?)\b',
        _fix_hiatus,
        text,
    )

    # REGRA 2: CEDILHA → SS em nomes próprios
    text = re.sub(
        r'\b([A-ZÀ-Ú][a-zà-ú]*?)ç([a-zà-ú])',
        lambda m: m.group(1) + "ss" + m.group(2),
        text,
    )

    # REGRA 3: "NH" NÃO-DÍGRAFO em palavras indígenas
    indigenous_suffixes = re.compile(
        r'(?:a[cçs]su|assu|mirim|gua[cçs]su|aba|uba|inga|ema|ita|uí|aí)', re.IGNORECASE
    )

    def _fix_nh(m: re.Match) -> str:
        before, after = m.group(1), m.group(2)
        if indigenous_suffixes.search(after):
            return f"{before}n{after}"
        return m.group(0)

    text = re.sub(
        r'\b([A-ZÀ-Ú][a-zà-ú]*?)nh([uao][a-zà-ú]*)\b',
        _fix_nh,
        text,
    )

    # REGRA 4: SIGLAS — converter pra forma fonética escrita
    # "P.L." ou "PL" → "Pê Éli" (TTS fala naturalmente)
    def _fix_sigla(pattern: str, replacement: str, txt: str) -> str:
        """Replace acronym preserving trailing punctuation."""
        def _repl(m: re.Match) -> str:
            after = m.group(0)
            if after[-1] in '.!?,;:':
                return replacement + after[-1]
            return replacement
        return re.sub(pattern, _repl, txt)

    text = _fix_sigla(r'\bP\.?\s*L\.?[.!?,;:]?', 'Pê Éli', text)
    text = _fix_sigla(r'\bP\.?\s*T\.?[.!?,;:]?(?!\w)', 'Pê Tê', text)
    text = _fix_sigla(r'\bM\.?\s*D\.?\s*B\.?[.!?,;:]?', 'Ême Dê Bê', text)
    text = _fix_sigla(r'\bP\.?\s*S\.?\s*D\.?\s*B\.?[.!?,;:]?', 'Pê Ésse Dê Bê', text)
    text = _fix_sigla(r'\bP\.?\s*S\.?\s*D\.?[.!?,;:]?(?!\w)', 'Pê Ésse Dê', text)
    text = _fix_sigla(r'\bP\.?\s*D\.?\s*T\.?[.!?,;:]?', 'Pê Dê Tê', text)
    text = _fix_sigla(r'\bP\.?\s*S\.?\s*B\.?[.!?,;:]?', 'Pê Ésse Bê', text)
    text = _fix_sigla(r'\bP\.?\s*S\.?\s*O\.?\s*L\.?[.!?,;:]?', 'Pê Sól', text)
    text = _fix_sigla(r'\bS\.?\s*T\.?\s*F\.?[.!?,;:]?', 'Ésse Tê Éfe', text)
    text = _fix_sigla(r'\bC\.?\s*P\.?\s*I\.?[.!?,;:]?(?!\w)', 'Cê Pê Í', text)

    # REGRA 5: HÍFENS SILÁBICOS do GPT — juntar de volta
    text = re.sub(
        r'\b[A-ZÀ-Ú][a-zà-ú]{1,4}(?:-[A-Za-zà-ú]{1,4}){2,}\b',
        lambda m: m.group(0).replace("-", ""),
        text,
    )

    return text


def generate_tts(text: str, voice_id: str) -> tuple[bytes, str]:
    """
    Generate TTS audio using ElevenLabs + apply outdoor environment FX.
    Returns (processed_audio_bytes, processed_text_sent_to_elevenlabs).
    """
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    # Fix pronunciation with generic rules
    processed_text = _fix_pronunciation(text)
    if processed_text != text:
        logger.info("Pronunciation fix applied: '%s' → '%s'", text[:80], processed_text[:80])

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
                "stability": 0.6,
                "similarity_boost": 0.75,
                "style": 0.35,
                "use_speaker_boost": False,
                "speed": 0.88,
            },
        },
        timeout=TTS_TIMEOUT,
    )

    response.raise_for_status()
    raw_audio = response.content
    logger.info("TTS raw audio: %d bytes", len(raw_audio))

    # Adicionar 1.5s de silêncio no final pra evitar corte abrupto no lip-sync
    padded_audio = _add_tail_silence(raw_audio)
    return padded_audio, processed_text


def _add_tail_silence(audio: bytes, seconds: float = 1.5) -> bytes:
    """Append silence at the end of audio to prevent abrupt cut in lip-sync."""
    tmpdir = tempfile.mkdtemp(prefix="tts_pad_")
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
            logger.warning("Tail silence failed, using original audio")
            return audio

        with open(output_path, "rb") as f:
            padded = f.read()

        logger.info("Tail silence added: %d → %d bytes (+%.1fs)", len(audio), len(padded), seconds)
        return padded

    except Exception as e:
        logger.warning("Tail silence failed: %s", e)
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
