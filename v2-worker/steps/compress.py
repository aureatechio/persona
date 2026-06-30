"""Ensure the final video fits WhatsApp's media size limit.

WhatsApp (both the Cloud API and UAZAPI) silently fails to deliver video
messages larger than ~16 MB: the send request returns 200/OK but the
recipient never receives the file. To avoid that, we re-encode any oversized
final video with a 2-pass libx264 pass targeting a size safely under the
limit, preserving resolution/fps and keeping quality high (SSIM ~0.98 on the
720x1280 talking-head videos this pipeline produces).
"""

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger("v2-worker.compress")

# WhatsApp's hard limit for video messages.
WHATSAPP_MAX_MB = 16.0
# Target size for the re-encode — headroom below the hard limit.
TARGET_MB = 14.0
# Audio bitrate kept for the compressed output (speech-friendly).
AUDIO_BITRATE_KBPS = 128
# Floor for the video bitrate so very long videos never go to mush.
MIN_VIDEO_KBPS = 400
FFMPEG_TIMEOUT = 600  # seconds


def _probe_duration(path: str) -> float:
    """Return the duration of a media file in seconds (0.0 if unknown)."""
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            capture_output=True, text=True, timeout=60,
        )
        return float(out.stdout.strip())
    except (ValueError, subprocess.SubprocessError):
        return 0.0


def ensure_under_limit(video_bytes: bytes, target_mb: float = TARGET_MB) -> bytes:
    """Return video_bytes unchanged if already within the WhatsApp limit,
    otherwise a 2-pass re-encoded version targeting ~target_mb.

    Never raises: on any failure it logs and returns the original bytes, so a
    compression problem can't block an otherwise-deliverable send.
    """
    size_mb = len(video_bytes) / (1024 * 1024)
    if size_mb <= WHATSAPP_MAX_MB:
        logger.info("Final video %.2f MB within WhatsApp limit — no compression", size_mb)
        return video_bytes

    logger.info("Final video %.2f MB exceeds limit — compressing to ~%.0f MB", size_mb, target_mb)

    try:
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "in.mp4")
            dst = os.path.join(tmp, "out.mp4")
            passlog = os.path.join(tmp, "ff2pass")
            with open(src, "wb") as f:
                f.write(video_bytes)

            duration = _probe_duration(src)
            if duration <= 0:
                logger.warning("Could not probe duration — returning original")
                return video_bytes

            # Total bitrate budget for the target size, minus the audio track.
            total_kbps = (target_mb * 8 * 1024) / duration
            video_kbps = int(max(MIN_VIDEO_KBPS, total_kbps - AUDIO_BITRATE_KBPS))
            logger.info("duration=%.1fs -> video %d kbps (2-pass, slow)", duration, video_kbps)

            common = [
                "-c:v", "libx264", "-b:v", f"{video_kbps}k",
                "-preset", "slow", "-pix_fmt", "yuv420p",
            ]
            # Pass 1 — analysis only; null muxer avoids non-seekable-output issues.
            subprocess.run(
                ["ffmpeg", "-y", "-i", src, *common,
                 "-pass", "1", "-passlogfile", passlog,
                 "-an", "-f", "null", os.devnull],
                check=True, capture_output=True, timeout=FFMPEG_TIMEOUT,
            )
            # Pass 2 — real encode with audio + faststart for streaming.
            subprocess.run(
                ["ffmpeg", "-y", "-i", src, *common,
                 "-pass", "2", "-passlogfile", passlog,
                 "-c:a", "aac", "-b:a", f"{AUDIO_BITRATE_KBPS}k",
                 "-movflags", "+faststart", dst],
                check=True, capture_output=True, timeout=FFMPEG_TIMEOUT,
            )
            with open(dst, "rb") as f:
                out_bytes = f.read()
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or b"").decode("utf-8", "replace")[-400:] if isinstance(e.stderr, bytes) else str(e.stderr)
        logger.error("Compression failed (%s) — returning original: %s", e, stderr)
        return video_bytes
    except Exception as e:
        logger.error("Compression error — returning original: %s", e)
        return video_bytes

    new_mb = len(out_bytes) / (1024 * 1024)
    if not out_bytes or len(out_bytes) >= len(video_bytes):
        logger.warning("Compression did not reduce size (%.2f MB) — returning original", new_mb)
        return video_bytes

    logger.info("Compressed %.2f MB -> %.2f MB", size_mb, new_mb)
    return out_bytes
