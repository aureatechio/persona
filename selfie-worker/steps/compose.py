"""Step 5: Download videos, normalize with FFmpeg, concatenate."""

import subprocess
import tempfile
import os
import logging

import requests

logger = logging.getLogger("worker.compose")

FFMPEG_TIMEOUT = 120  # seconds


def _run_ffmpeg(args: list[str]):
    """Run ffmpeg with args, raise on failure."""
    cmd = ["ffmpeg"] + args
    logger.debug("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
        raise RuntimeError(f"FFmpeg failed (rc={result.returncode}): {stderr}")


def compose_videos(selfie_bytes: bytes, selfie_ext: str, lipsync_url: str) -> bytes:
    """
    Download lipsync video, normalize both to same format, concatenate.
    Returns final video bytes (MP4).
    """
    tmpdir = tempfile.mkdtemp(prefix="selfie_compose_")
    selfie_path = os.path.join(tmpdir, f"selfie.{selfie_ext}")
    lipsync_path = os.path.join(tmpdir, "lipsync.mp4")
    selfie_norm = os.path.join(tmpdir, "selfie_norm.mp4")
    lipsync_norm = os.path.join(tmpdir, "lipsync_norm.mp4")
    concat_list = os.path.join(tmpdir, "concat.txt")
    output_path = os.path.join(tmpdir, "final.mp4")

    try:
        # 1. Write selfie
        with open(selfie_path, "wb") as f:
            f.write(selfie_bytes)

        # 2. Download lipsync video
        logger.info("Downloading lipsync video...")
        resp = requests.get(lipsync_url, timeout=60)
        resp.raise_for_status()
        with open(lipsync_path, "wb") as f:
            f.write(resp.content)
        logger.info("Lipsync downloaded: %d bytes", len(resp.content))

        # 3. Normalize selfie (720x1280, 30fps, h264, aac)
        logger.info("Normalizing selfie...")
        _run_ffmpeg([
            "-i", selfie_path,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-r", "30", "-video_track_timescale", "15360",
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
            "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2",
            "-movflags", "+faststart", "-y", selfie_norm,
        ])

        # 4. Normalize lipsync (same params for clean concat)
        logger.info("Normalizing lipsync...")
        _run_ffmpeg([
            "-i", lipsync_path,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-r", "30", "-video_track_timescale", "15360",
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
            "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2",
            "-movflags", "+faststart", "-y", lipsync_norm,
        ])

        # 5. Concat
        logger.info("Concatenating...")
        with open(concat_list, "w") as f:
            f.write(f"file '{selfie_norm}'\nfile '{lipsync_norm}'\n")

        _run_ffmpeg([
            "-f", "concat", "-safe", "0", "-i", concat_list,
            "-c", "copy", "-movflags", "+faststart",
            "-y", output_path,
        ])

        with open(output_path, "rb") as f:
            final_bytes = f.read()

        logger.info("Final video: %d bytes", len(final_bytes))
        return final_bytes

    finally:
        # Cleanup all temp files
        for fname in os.listdir(tmpdir):
            try:
                os.unlink(os.path.join(tmpdir, fname))
            except OSError:
                pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass
