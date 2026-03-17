"""Step 5: Download videos, normalize with FFmpeg, concatenate."""

import subprocess
import tempfile
import os
import logging
import json

import requests

logger = logging.getLogger("worker.compose")

FFMPEG_TIMEOUT = 600  # seconds (10 min — large videos on small instances need time)


def _run_ffmpeg(args: list[str]):
    """Run ffmpeg with args, raise on failure."""
    cmd = ["ffmpeg"] + args
    logger.debug("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
        raise RuntimeError(f"FFmpeg failed (rc={result.returncode}): {stderr}")


def _has_audio_stream(file_path: str) -> bool:
    """Check if a media file has an audio stream using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_streams", "-select_streams", "a",
                file_path,
            ],
            capture_output=True,
            timeout=15,
        )
        if result.returncode != 0:
            return False
        data = json.loads(result.stdout)
        return len(data.get("streams", [])) > 0
    except Exception as e:
        logger.warning("ffprobe check failed for %s: %s", file_path, e)
        return False


def _normalize(input_path: str, output_path: str):
    """
    Normalize a video to 720x1280 30fps h264+aac.
    If the input has no audio stream, generates a silent audio track
    so that concat always has matching streams.
    """
    has_audio = _has_audio_stream(input_path)
    logger.info("Normalizing %s (has_audio=%s)...", os.path.basename(input_path), has_audio)

    if has_audio:
        _run_ffmpeg([
            "-i", input_path,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-r", "30", "-video_track_timescale", "15360",
            "-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-ac", "2",
            "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2",
            "-movflags", "+faststart", "-y", output_path,
        ])
    else:
        # Generate silent audio to match video duration
        _run_ffmpeg([
            "-i", input_path,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-r", "30", "-video_track_timescale", "15360",
            "-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-ac", "2",
            "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            "-movflags", "+faststart", "-y", output_path,
        ])

    # Verify output has audio
    if not _has_audio_stream(output_path):
        logger.warning("Normalized output %s still has no audio — adding silent track", os.path.basename(output_path))
        temp_out = output_path + ".tmp.mp4"
        _run_ffmpeg([
            "-i", output_path,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "256k",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            "-movflags", "+faststart", "-y", temp_out,
        ])
        os.replace(temp_out, output_path)


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

        # 3. Normalize both (ensures matching streams: video h264 + audio aac)
        _normalize(selfie_path, selfie_norm)
        _normalize(lipsync_path, lipsync_norm)

        # 4. Concat (re-encode to ensure perfect audio/video sync)
        logger.info("Concatenating...")
        with open(concat_list, "w") as f:
            f.write(f"file '{selfie_norm}'\nfile '{lipsync_norm}'\n")

        _run_ffmpeg([
            "-f", "concat", "-safe", "0", "-i", concat_list,
            "-c", "copy",
            "-movflags", "+faststart",
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
