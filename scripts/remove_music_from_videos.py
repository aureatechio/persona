#!/usr/bin/env python3
"""
Remove background music from theme videos using Demucs (Meta AI).

Downloads theme videos from Supabase Storage, separates vocals from music
using Demucs, replaces the audio track with vocals-only, and uploads
the clean version to a new path (original is preserved).

Usage:
    # Install dependencies first:
    #   pip install demucs requests

    # Process all theme videos for a base_model:
    python scripts/remove_music_from_videos.py --model-id <uuid>

    # Process a specific storage path:
    python scripts/remove_music_from_videos.py --path models/mariadocarmo/themes/amor/video.mp4

    # Dry run (list files, don't process):
    python scripts/remove_music_from_videos.py --model-id <uuid> --dry-run

    # Use a specific Demucs model (default: htdemucs):
    python scripts/remove_music_from_videos.py --path ... --demucs-model htdemucs_ft

Environment variables:
    SUPABASE_URL              - Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY - Service role key for storage access
"""

import argparse
import logging
import os
import subprocess
import sys
import tempfile

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("remove-music")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = "voice-models"
FFMPEG_TIMEOUT = 600


def _storage_headers() -> dict:
    return {"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"}


def download_from_storage(path: str) -> bytes:
    """Download a file from Supabase Storage."""
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{path}"
    resp = requests.get(url, headers=_storage_headers(), timeout=60)
    resp.raise_for_status()
    logger.info("Downloaded %s: %d bytes", path, len(resp.content))
    return resp.content


def upload_to_storage(path: str, data: bytes, content_type: str = "video/mp4"):
    """Upload a file to Supabase Storage (upsert)."""
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{path}"
    headers = _storage_headers()
    headers["Content-Type"] = content_type
    headers["x-upsert"] = "true"
    resp = requests.post(url, headers=headers, data=data, timeout=120)
    resp.raise_for_status()
    logger.info("Uploaded %s: %d bytes", path, len(data))


def get_theme_videos_for_model(model_id: str) -> list[dict]:
    """Fetch theme_models with uploaded videos for a given base_model."""
    url = f"{SUPABASE_URL}/rest/v1/v2_theme_models"
    params = {
        "select": "id,theme_slug,video_storage_path",
        "base_model_id": f"eq.{model_id}",
        "is_uploaded": "eq.true",
        "video_storage_path": "not.is.null",
    }
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    themes = resp.json()
    logger.info("Found %d theme videos for model %s", len(themes), model_id)
    return themes


def _nomusic_path(original_path: str) -> str:
    """Generate the no-music variant path: video.mp4 -> video_nomusic.mp4"""
    base, ext = os.path.splitext(original_path)
    return f"{base}_nomusic{ext}"


def remove_music(video_bytes: bytes, demucs_model: str = "htdemucs") -> bytes:
    """
    Remove background music from video using Demucs.

    Steps:
    1. Extract audio from video
    2. Run Demucs to separate vocals
    3. Replace video audio with vocals-only track
    """
    tmpdir = tempfile.mkdtemp(prefix="demucs_")
    video_path = os.path.join(tmpdir, "input.mp4")
    audio_path = os.path.join(tmpdir, "audio.wav")
    output_path = os.path.join(tmpdir, "output.mp4")

    try:
        with open(video_path, "wb") as f:
            f.write(video_bytes)

        # 1. Extract audio as WAV (Demucs needs WAV)
        logger.info("Extracting audio...")
        result = subprocess.run(
            [
                "ffmpeg", "-i", video_path,
                "-vn", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2",
                "-y", audio_path,
            ],
            capture_output=True, timeout=FFMPEG_TIMEOUT,
        )
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg extract failed: {result.stderr.decode()[-300:]}")

        # 2. Run Demucs to separate vocals
        logger.info("Running Demucs (%s) — this may take a few minutes...", demucs_model)
        result = subprocess.run(
            [
                sys.executable, "-m", "demucs",
                "--two-stems", "vocals",  # Only separate vocals vs accompaniment
                "-n", demucs_model,
                "-o", tmpdir,
                audio_path,
            ],
            capture_output=True, timeout=1800,  # 30 min max
        )
        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
            raise RuntimeError(f"Demucs failed (rc={result.returncode}): {stderr}")

        # Demucs outputs to: {tmpdir}/{model}/audio/vocals.wav
        vocals_path = os.path.join(tmpdir, demucs_model, "audio", "vocals.wav")
        if not os.path.exists(vocals_path):
            # Fallback: search for the vocals file
            for root, _, files in os.walk(tmpdir):
                for fname in files:
                    if fname == "vocals.wav":
                        vocals_path = os.path.join(root, fname)
                        break

        if not os.path.exists(vocals_path):
            raise FileNotFoundError(f"Demucs vocals output not found in {tmpdir}")

        vocals_size = os.path.getsize(vocals_path)
        logger.info("Vocals extracted: %d bytes (%s)", vocals_size, vocals_path)

        # 3. Replace audio in video with vocals-only
        logger.info("Remuxing video with vocals-only audio...")
        result = subprocess.run(
            [
                "ffmpeg",
                "-i", video_path,
                "-i", vocals_path,
                "-map", "0:v",       # Video from original
                "-map", "1:a",       # Audio from vocals
                "-c:v", "copy",      # Don't re-encode video
                "-c:a", "aac", "-b:a", "192k",
                "-shortest",
                "-y", output_path,
            ],
            capture_output=True, timeout=FFMPEG_TIMEOUT,
        )
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg remux failed: {result.stderr.decode()[-300:]}")

        with open(output_path, "rb") as f:
            output_bytes = f.read()

        logger.info(
            "Done: %d bytes -> %d bytes (%.1f%%)",
            len(video_bytes), len(output_bytes),
            len(output_bytes) / len(video_bytes) * 100,
        )
        return output_bytes

    finally:
        # Cleanup
        subprocess.run(["rm", "-rf", tmpdir], capture_output=True)


def process_single(storage_path: str, demucs_model: str, dry_run: bool = False):
    """Process a single video from storage."""
    nomusic = _nomusic_path(storage_path)
    logger.info("Processing: %s -> %s", storage_path, nomusic)

    if dry_run:
        logger.info("[DRY RUN] Would process %s", storage_path)
        return

    video_bytes = download_from_storage(storage_path)
    clean_bytes = remove_music(video_bytes, demucs_model=demucs_model)
    upload_to_storage(nomusic, clean_bytes)
    logger.info("Uploaded clean version: %s", nomusic)


def _update_theme_path(theme_id: str, new_path: str, dry_run: bool = False):
    """Update video_storage_path in v2_theme_models to point to the nomusic version."""
    logger.info("Updating theme %s -> %s", theme_id, new_path)
    if dry_run:
        logger.info("[DRY RUN] Would update theme %s", theme_id)
        return
    url = f"{SUPABASE_URL}/rest/v1/v2_theme_models?id=eq.{theme_id}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    resp = requests.patch(url, headers=headers, json={"video_storage_path": new_path}, timeout=15)
    resp.raise_for_status()
    logger.info("Theme %s updated to %s", theme_id, new_path)


def main():
    parser = argparse.ArgumentParser(description="Remove background music from theme videos")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--model-id", help="Process all theme videos for a base_model UUID")
    group.add_argument("--path", help="Process a single storage path")
    parser.add_argument("--demucs-model", default="htdemucs", help="Demucs model (default: htdemucs)")
    parser.add_argument("--dry-run", action="store_true", help="List files without processing")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars")
        sys.exit(1)

    if args.path:
        process_single(args.path, args.demucs_model, dry_run=args.dry_run)
    else:
        themes = get_theme_videos_for_model(args.model_id)
        if not themes:
            logger.warning("No theme videos found for model %s", args.model_id)
            return

        # Deduplicate: multiple themes can share the same video file
        processed_paths: set[str] = set()
        success_paths: set[str] = set()

        for theme in themes:
            path = theme["video_storage_path"]
            slug = theme.get("theme_slug", "?")
            logger.info("--- Theme: %s ---", slug)

            if path in processed_paths:
                logger.info("Already processed %s, skipping", path)
                if path in success_paths:
                    _update_theme_path(theme["id"], _nomusic_path(path), dry_run=args.dry_run)
                continue

            processed_paths.add(path)
            try:
                process_single(path, args.demucs_model, dry_run=args.dry_run)
                success_paths.add(path)
                _update_theme_path(theme["id"], _nomusic_path(path), dry_run=args.dry_run)
            except Exception as e:
                logger.error("Failed to process %s (%s): %s", slug, path, e)
                continue

        logger.info(
            "Done! Processed %d unique files, %d succeeded, %d themes updated",
            len(processed_paths), len(success_paths), len(success_paths),
        )


if __name__ == "__main__":
    main()
