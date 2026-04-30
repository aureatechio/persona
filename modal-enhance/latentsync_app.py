"""
Modal function: LatentSync lip-sync (ByteDance).

Input: video URL + audio URL → output: lipsync'd video URL (uploaded to Supabase).

Deploy: modal deploy modal-enhance/latentsync.py
Invoke: POST https://integracao--latentsync.modal.run
  body: {"video_url": "https://...", "audio_url": "https://...", "inference_steps": 20, "guidance_scale": 1.5}

Docs: https://github.com/bytedance/LatentSync
Weights: ByteDance/LatentSync-1.6 on HuggingFace
"""

import modal

app = modal.App("latentsync")

# ───────────────────────────────────────────────────────────────────────
# Image: Python 3.10 + PyTorch 2.5 CUDA 12.1 + LatentSync deps + pre-downloaded weights.
# We follow the official requirements.txt from bytedance/LatentSync.
# ───────────────────────────────────────────────────────────────────────
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0", "wget", "git", "git-lfs")
    .env({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8"})
    # Install torch first from the CUDA 12.1 index
    .pip_install(
        "torch==2.5.1",
        "torchvision==0.20.1",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    # Install the rest of LatentSync's requirements
    .pip_install(
        "diffusers==0.32.2",
        "transformers==4.48.0",
        "decord==0.6.0",
        "accelerate==0.26.1",
        "einops==0.7.0",
        "omegaconf==2.3.0",
        "opencv-python==4.9.0.80",
        "mediapipe==0.10.11",
        "python_speech_features==0.6",
        "librosa==0.10.1",
        "scenedetect==0.6.1",
        "ffmpeg-python==0.2.0",
        "imageio==2.31.1",
        "imageio-ffmpeg==0.5.1",
        "lpips==0.1.4",
        "face-alignment==1.4.1",
        "huggingface-hub==0.30.2",
        "numpy==1.26.4",
        "kornia==0.8.0",
        "insightface==0.7.3",
        "onnxruntime-gpu==1.21.0",
        "DeepCache==0.1.1",
        # Our additions (not in their requirements but we need them)
        "requests",
        "fastapi",
    )
    # Clone the repo
    .run_commands(
        "cd /root && git clone https://github.com/bytedance/LatentSync.git",
    )
    # Download weights from HuggingFace (no auth required — public model)
    .run_commands(
        "mkdir -p /root/LatentSync/checkpoints/whisper",
        "cd /root/LatentSync && huggingface-cli download ByteDance/LatentSync-1.6 "
        "latentsync_unet.pt whisper/tiny.pt --local-dir checkpoints",
    )
)


@app.function(
    image=image,
    gpu="A10G",
    timeout=2400,  # 40 min
    secrets=[modal.Secret.from_name("supabase")],
)
@modal.fastapi_endpoint(method="POST", label="latentsync")
def latentsync(payload: dict):
    """
    POST body:
      - video_url (required): URL of the input video (face should be visible)
      - audio_url (required): URL of the input audio
      - inference_steps (optional, default 20): diffusion steps (20-50)
      - guidance_scale (optional, default 1.5): classifier-free guidance (1.0-3.0)

    Returns: {"video_url", "elapsed_seconds", "storage_path"}
    """
    import os
    import subprocess
    import tempfile
    import time
    from pathlib import Path

    import requests

    video_url = payload.get("video_url")
    audio_url = payload.get("audio_url")
    inference_steps = int(payload.get("inference_steps", 20))
    guidance_scale = float(payload.get("guidance_scale", 1.5))
    enable_deepcache = bool(payload.get("enable_deepcache", True))
    normalize_fps = bool(payload.get("normalize_fps", True))  # LatentSync trained @ 25fps

    if not video_url or not audio_url:
        return {"error": "video_url and audio_url are required"}

    t0 = time.time()

    SUPABASE_URL = os.environ["SUPABASE_URL"]
    SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    BUCKET = "voice-models"

    def supa_upload(key: str, data: bytes, content_type: str = "video/mp4"):
        url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{key}"
        r = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            data=data,
            timeout=180,
        )
        r.raise_for_status()

    def supa_sign(key: str, expires: int = 3600) -> str:
        url = f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{key}"
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {SUPABASE_KEY}"},
            json={"expiresIn": expires},
            timeout=30,
        )
        r.raise_for_status()
        return f"{SUPABASE_URL}/storage/v1{r.json()['signedURL']}"

    def download(url: str, dest: Path):
        r = requests.get(url, timeout=180, stream=True)
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        in_video = tmp / "input.mp4"
        in_audio = tmp / "input_audio.wav"
        out_video = tmp / "output.mp4"

        # ─── 1. Download inputs ───
        print(f"[latentsync] Downloading video: {video_url[:80]}...")
        download(video_url, in_video)
        print(f"[latentsync] Downloading audio: {audio_url[:80]}...")
        download(audio_url, in_audio)

        # ─── 2. Convert audio to WAV if it's not (LatentSync expects .wav) ───
        wav_audio = tmp / "audio.wav"
        ff = subprocess.run(
            ["ffmpeg", "-i", str(in_audio), "-ac", "1", "-ar", "16000", "-y", str(wav_audio)],
            capture_output=True,
            timeout=120,
        )
        if ff.returncode != 0:
            err = ff.stderr.decode(errors="replace")[-400:]
            return {"error": f"audio conversion failed: {err}"}

        # ─── 2.5. Normalize video to 25fps (LatentSync's training fps) ───
        # ByteDance's pipeline assumes 25fps for audio↔frame alignment with whisper.
        # Feeding 30fps causes drift; pre-converting eliminates that.
        inference_video = in_video
        input_fps = 0.0
        fps_was_normalized = False
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", str(in_video)],
            capture_output=True, timeout=30,
        )
        try:
            num, den = probe.stdout.decode().strip().split("/")
            input_fps = float(num) / float(den)
        except (ValueError, ZeroDivisionError):
            input_fps = 0.0

        if normalize_fps and input_fps > 0 and abs(input_fps - 25.0) > 0.01:
            print(f"[latentsync] Input fps={input_fps:.2f} → normalizing to 25fps")
            normalized = tmp / "input_25fps.mp4"
            ff_norm = subprocess.run(
                ["ffmpeg", "-i", str(in_video),
                 "-vf", "fps=25",
                 "-c:v", "libx264", "-preset", "fast", "-crf", "12",
                 "-pix_fmt", "yuv420p",
                 "-an",  # LatentSync uses audio separately
                 "-y", str(normalized)],
                capture_output=True, timeout=300,
            )
            if ff_norm.returncode != 0:
                err = ff_norm.stderr.decode(errors="replace")[-400:]
                return {"error": f"fps normalization failed: {err}"}
            inference_video = normalized
            fps_was_normalized = True
        else:
            print(f"[latentsync] Input fps={input_fps:.2f} — keeping as-is (normalize_fps={normalize_fps})")

        # ─── 3. Run LatentSync inference ───
        print(f"[latentsync] Running inference (steps={inference_steps}, guidance={guidance_scale}, deepcache={enable_deepcache})...")
        cmd = [
            "python", "-m", "scripts.inference",
            "--unet_config_path", "configs/unet/stage2_512.yaml",
            "--inference_ckpt_path", "checkpoints/latentsync_unet.pt",
            "--inference_steps", str(inference_steps),
            "--guidance_scale", str(guidance_scale),
            "--video_path", str(inference_video),
            "--audio_path", str(wav_audio),
            "--video_out_path", str(out_video),
        ]
        if enable_deepcache:
            cmd.append("--enable_deepcache")
        # Force PYTHONPATH to /root/LatentSync so the `latentsync` package is
        # importable as a package (avoids collision with any stray module named
        # latentsync that Modal might add to sys.path from the wrapper file).
        env = {**os.environ, "PYTHONPATH": "/root/LatentSync"}
        result = subprocess.run(
            cmd,
            cwd="/root/LatentSync",
            capture_output=True,
            timeout=2100,  # 35 min max for inference
            env=env,
        )
        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace")[-800:]
            stdout = result.stdout.decode(errors="replace")[-400:]
            return {"error": f"LatentSync inference failed (rc={result.returncode}): stderr={stderr} | stdout={stdout}"}

        if not out_video.exists():
            return {"error": "LatentSync produced no output file"}

        out_bytes = out_video.read_bytes()
        print(f"[latentsync] Inference done. Output: {len(out_bytes) / 1024 / 1024:.2f}MB in {time.time() - t0:.1f}s")

        # ─── 4. Upload to Supabase ───
        key = f"test-enhanced/latentsync_{int(time.time() * 1000)}.mp4"
        supa_upload(key, out_bytes)
        signed_url = supa_sign(key)

    return {
        "video_url": signed_url,
        "storage_path": key,
        "elapsed_seconds": round(time.time() - t0, 1),
        "inference_steps": inference_steps,
        "guidance_scale": guidance_scale,
        "enable_deepcache": enable_deepcache,
        "input_fps": round(input_fps, 2),
        "fps_normalized_to_25": fps_was_normalized,
    }


@app.local_entrypoint()
def main(video_url: str, audio_url: str, inference_steps: int = 20, guidance_scale: float = 1.5):
    result = latentsync.remote({
        "video_url": video_url,
        "audio_url": audio_url,
        "inference_steps": inference_steps,
        "guidance_scale": guidance_scale,
    })
    print(result)
