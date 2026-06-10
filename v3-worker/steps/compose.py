"""V3 Step: Compose final video — selfie + lipsync only (no theme video)."""

from __future__ import annotations

import subprocess
import tempfile
import os
import logging
import json

import requests

logger = logging.getLogger("v3-worker.compose")

FFMPEG_TIMEOUT = 600


def _run_ffmpeg(args: list[str]):
    cmd = ["ffmpeg"] + args
    result = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
        raise RuntimeError(f"FFmpeg failed (rc={result.returncode}): {stderr}")


def _has_audio_stream(file_path: str) -> bool:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", "-select_streams", "a", file_path],
            capture_output=True, timeout=15,
        )
        if result.returncode != 0:
            return False
        data = json.loads(result.stdout)
        return len(data.get("streams", [])) > 0
    except Exception:
        return False


def _normalize(input_path: str, output_path: str):
    """Normalize a video to 720x1280 30fps h264+aac."""
    has_audio = _has_audio_stream(input_path)

    if has_audio:
        _run_ffmpeg([
            "-i", input_path,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-r", "30", "-video_track_timescale", "15360",
            "-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-ac", "2",
            "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
            "-movflags", "+faststart", "-y", output_path,
        ])
    else:
        _run_ffmpeg([
            "-i", input_path,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-r", "30", "-video_track_timescale", "15360",
            "-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-ac", "2",
            "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            "-movflags", "+faststart", "-y", output_path,
        ])


def compose_videos(selfie_bytes: bytes, selfie_ext: str, lipsync_url: str) -> bytes:
    """Compose final video: selfie + lipsync. Simple concat, no theme video."""

    tmpdir = tempfile.mkdtemp(prefix="v3_compose_")
    selfie_path = os.path.join(tmpdir, f"selfie.{selfie_ext}")
    selfie_norm = os.path.join(tmpdir, "selfie_norm.mp4")
    lipsync_path = os.path.join(tmpdir, "lipsync.mp4")
    lipsync_norm = os.path.join(tmpdir, "lipsync_norm.mp4")
    concat_list = os.path.join(tmpdir, "concat.txt")
    output_path = os.path.join(tmpdir, "final.mp4")

    try:
        with open(selfie_path, "wb") as f:
            f.write(selfie_bytes)
        _normalize(selfie_path, selfie_norm)

        logger.info("Downloading lipsync from %s...", lipsync_url[:80])
        resp = requests.get(lipsync_url, timeout=120)
        resp.raise_for_status()
        with open(lipsync_path, "wb") as f:
            f.write(resp.content)
        logger.info("Lipsync: %d bytes", len(resp.content))
        _normalize(lipsync_path, lipsync_norm)

        with open(concat_list, "w") as f:
            f.write(f"file '{selfie_norm}'\n")
            f.write(f"file '{lipsync_norm}'\n")

        _run_ffmpeg([
            "-f", "concat", "-safe", "0", "-i", concat_list,
            "-c", "copy", "-movflags", "+faststart", "-y", output_path,
        ])

        with open(output_path, "rb") as f:
            final_bytes = f.read()

        logger.info("Final video: %d bytes", len(final_bytes))
        return final_bytes

    finally:
        for fname in os.listdir(tmpdir):
            try: os.unlink(os.path.join(tmpdir, fname))
            except OSError: pass
        try: os.rmdir(tmpdir)
        except OSError: pass
