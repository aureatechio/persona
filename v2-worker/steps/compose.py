"""V2 Step 5: Download videos, normalize with FFmpeg, concatenate + closing."""

import subprocess
import tempfile
import os
import logging
import json

import requests

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

logger = logging.getLogger("v2-worker.compose")

FFMPEG_TIMEOUT = 600

DEFAULT_CLOSING_VIDEO_PATH = "assets/closing_video.mp4"
DEFAULT_CLOSING_MUSIC_PATH = "assets/closing_music.mp3"
CLOSING_MUSIC_VOLUME = 0.5

_asset_cache: dict[str, bytes] = {}


def _download_storage_asset(path: str) -> bytes | None:
    """Download an asset from Supabase Storage (cached by path)."""
    if path in _asset_cache:
        return _asset_cache[path]
    try:
        url = f"{SUPABASE_URL}/storage/v1/object/voice-models/{path}"
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"},
            timeout=30,
        )
        resp.raise_for_status()
        logger.info("Downloaded %s: %d bytes", path, len(resp.content))
        _asset_cache[path] = resp.content
        return resp.content
    except Exception as e:
        logger.warning("Failed to download %s: %s", path, e)
        return None


def _run_ffmpeg(args: list[str]):
    """Run ffmpeg with args, raise on failure."""
    cmd = ["ffmpeg"] + args
    logger.debug("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
        raise RuntimeError(f"FFmpeg failed (rc={result.returncode}): {stderr}")


def _has_audio_stream(file_path: str) -> bool:
    """Check if a media file has an audio stream."""
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
    except Exception:
        return False


def _normalize(input_path: str, output_path: str, start_offset: float = 0.0):
    """Normalize a video to 720x1280 30fps h264+aac."""
    has_audio = _has_audio_stream(input_path)
    logger.info("Normalizing %s (has_audio=%s, start_offset=%.2fs)...", os.path.basename(input_path), has_audio, start_offset)

    seek_args = ["-ss", f"{start_offset:.3f}"] if start_offset > 0 else []

    if has_audio:
        _run_ffmpeg([
            *seek_args, "-i", input_path,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-r", "30", "-video_track_timescale", "15360",
            "-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-ac", "2",
            "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
            "-movflags", "+faststart", "-y", output_path,
        ])
    else:
        _run_ffmpeg([
            *seek_args, "-i", input_path,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-r", "30", "-video_track_timescale", "15360",
            "-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-ac", "2",
            "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            "-movflags", "+faststart", "-y", output_path,
        ])

    if not _has_audio_stream(output_path):
        logger.warning("Normalized output still has no audio — adding silent track")
        temp_out = output_path + ".tmp.mp4"
        _run_ffmpeg([
            "-i", output_path,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            "-movflags", "+faststart", "-y", temp_out,
        ])
        os.replace(temp_out, output_path)


def _prepare_closing_video(tmpdir: str, video_storage_path: str, music_storage_path: str) -> str | None:
    """Prepare closing video with background music overlay."""
    closing_bytes = _download_storage_asset(video_storage_path)
    if closing_bytes is None:
        logger.warning("No closing video at %s, skipping", video_storage_path)
        return None

    closing_raw = os.path.join(tmpdir, "closing_raw.mp4")
    closing_norm = os.path.join(tmpdir, "closing_norm.mp4")

    with open(closing_raw, "wb") as f:
        f.write(closing_bytes)

    music_bytes = _download_storage_asset(music_storage_path)
    if music_bytes is not None:
        music_path = os.path.join(tmpdir, "closing_music.mp3")
        closing_with_music = os.path.join(tmpdir, "closing_music_mixed.mp4")

        with open(music_path, "wb") as f:
            f.write(music_bytes)

        try:
            _run_ffmpeg([
                "-i", closing_raw, "-i", music_path,
                "-filter_complex",
                f"[1:a]volume={CLOSING_MUSIC_VOLUME},afade=t=in:d=0.5[music]",
                "-map", "0:v", "-map", "[music]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                "-shortest",
                "-y", closing_with_music,
            ])
            closing_raw = closing_with_music
            logger.info("Closing music mixed successfully")
        except Exception as e:
            logger.warning("Failed to mix closing music: %s", e)

    _normalize(closing_raw, closing_norm)
    return closing_norm


def compose_videos(
    selfie_bytes: bytes,
    selfie_ext: str,
    middle_urls: str | list[str],
    closing_video_path: str | None = None,
    closing_music_path: str | None = None,
    middle_offsets: list[float] | None = None,
) -> bytes:
    """
    Compose final video: selfie + middle[0..N] + closing.

    middle_urls: single URL or list of URLs (name_sync + theme_video).
    middle_offsets: seconds to skip at start of each middle.
    """
    if isinstance(middle_urls, str):
        middle_urls = [middle_urls]
    middle_urls = [u for u in middle_urls if u]
    if not middle_urls:
        raise ValueError("compose_videos: middle_urls vazio")

    tmpdir = tempfile.mkdtemp(prefix="v2_compose_")
    selfie_path = os.path.join(tmpdir, f"selfie.{selfie_ext}")
    selfie_norm = os.path.join(tmpdir, "selfie_norm.mp4")
    concat_list = os.path.join(tmpdir, "concat.txt")
    output_path = os.path.join(tmpdir, "final.mp4")

    try:
        with open(selfie_path, "wb") as f:
            f.write(selfie_bytes)
        _normalize(selfie_path, selfie_norm)

        middle_norms: list[str] = []
        for idx, url in enumerate(middle_urls):
            raw_path = os.path.join(tmpdir, f"middle_{idx}.mp4")
            norm_path = os.path.join(tmpdir, f"middle_{idx}_norm.mp4")
            logger.info("Downloading middle[%d] from %s...", idx, url[:80])
            resp = requests.get(url, timeout=120)
            resp.raise_for_status()
            with open(raw_path, "wb") as f:
                f.write(resp.content)
            logger.info("middle[%d]: %d bytes", idx, len(resp.content))
            offset = middle_offsets[idx] if middle_offsets and idx < len(middle_offsets) else 0.0
            _normalize(raw_path, norm_path, start_offset=offset)
            middle_norms.append(norm_path)

        closing_norm = _prepare_closing_video(
            tmpdir,
            video_storage_path=closing_video_path or DEFAULT_CLOSING_VIDEO_PATH,
            music_storage_path=closing_music_path or DEFAULT_CLOSING_MUSIC_PATH,
        )

        with open(concat_list, "w") as f:
            f.write(f"file '{selfie_norm}'\n")
            for m in middle_norms:
                f.write(f"file '{m}'\n")
            if closing_norm:
                f.write(f"file '{closing_norm}'\n")

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
        for fname in os.listdir(tmpdir):
            try:
                os.unlink(os.path.join(tmpdir, fname))
            except OSError:
                pass
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass
