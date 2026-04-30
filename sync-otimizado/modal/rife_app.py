"""
Modal function: interpolação temporal de frames (25fps → target_fps).

Para 25→30fps usa ffmpeg minterpolate (motion-compensated optical flow).
RIFE neural seria marginalmente melhor mas pesos não têm URL direta pra build automatizado.
A diferença prática é imperceptível para multiplicadores pequenos (25→30fps = +20% frames).
Para multiplicadores grandes (2x, 4x) uma implementação RIFE via ncnn pode ser adicionada.

Deploy: modal deploy sync-otimizado/modal/rife_app.py
Invoke: POST https://integracao--frame-interp.modal.run
  body: {"video_url": "https://...", "target_fps": 30}
"""

import modal

app = modal.App("frame-interp")

# CPU é suficiente — ffmpeg minterpolate não usa GPU
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg")
    .pip_install("requests", "fastapi")
    .env({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"})
)


@app.function(
    image=image,
    cpu=4,      # minterpolate beneficia de múltiplos cores
    timeout=600,
    secrets=[modal.Secret.from_name("supabase")],
)
@modal.fastapi_endpoint(method="POST", label="frame-interp")
def frame_interp(payload: dict):
    """
    POST body: {
      "video_url": "...",    # required
      "target_fps": 30,      # default 30 — qualquer fps acima do input
      "quality": "fast"      # "fast" (blend) ou "quality" (mci optical flow, ~3x mais lento)
    }
    Returns: {"video_url", "storage_path", "input_fps", "output_fps", "elapsed_seconds"}
    """
    import os
    import subprocess
    import tempfile
    import time
    from pathlib import Path

    import requests

    video_url  = payload.get("video_url")
    target_fps = int(payload.get("target_fps", 30))
    quality    = payload.get("quality", "quality")  # "fast" ou "quality"

    if not video_url:
        return {"error": "video_url is required"}

    t0 = time.time()
    SUPABASE_URL = os.environ["SUPABASE_URL"]
    SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    BUCKET = "voice-models"

    def supa_upload(key, data, ct="video/mp4"):
        url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{key}"
        r = requests.post(url, headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": ct,
            "x-upsert": "true",
        }, data=data, timeout=300)
        r.raise_for_status()

    def supa_sign(key, expires=3600):
        url = f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{key}"
        r = requests.post(url, headers={"Authorization": f"Bearer {SUPABASE_KEY}"},
                          json={"expiresIn": expires}, timeout=30)
        r.raise_for_status()
        return f"{SUPABASE_URL}/storage/v1{r.json()['signedURL']}"

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        in_video  = tmp / "input.mp4"
        out_video = tmp / "output.mp4"

        # ─── 1. Download ───
        r = requests.get(video_url, timeout=180, stream=True)
        r.raise_for_status()
        with open(in_video, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)

        # ─── 2. Detect input fps ───
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", str(in_video)],
            capture_output=True, timeout=30,
        )
        try:
            num, den = probe.stdout.decode().strip().split("/")
            input_fps = float(num) / float(den)
        except Exception:
            input_fps = 25.0

        print(f"[frame_interp] {input_fps:.2f}fps → {target_fps}fps ({quality} mode)")

        if abs(input_fps - target_fps) < 0.1:
            # Já está no fps target — só faz passthrough
            out_video = in_video
            print("[frame_interp] Input already at target fps, passthrough")
        else:
            # ─── 3. Interpolate ───
            if quality == "fast":
                # Blend simples entre frames adjacentes (mais rápido)
                vf = f"minterpolate='fps={target_fps}:mi_mode=blend'"
            else:
                # Motion-compensated interpolation (melhor qualidade)
                vf = f"minterpolate='fps={target_fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1'"

            cmd = ["ffmpeg", "-i", str(in_video),
                   "-vf", vf,
                   "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                   "-c:a", "copy",
                   "-y", str(out_video)]

            result = subprocess.run(cmd, capture_output=True, timeout=480)
            if result.returncode != 0:
                return {
                    "error": f"ffmpeg failed (rc={result.returncode})",
                    "stderr": result.stderr.decode(errors="replace")[-600:],
                }

        # ─── 4. Upload ───
        out_bytes = out_video.read_bytes()
        key = f"frame-interp/video_{int(time.time()*1000)}.mp4"
        supa_upload(key, out_bytes)
        signed = supa_sign(key)

    return {
        "video_url":       signed,
        "storage_path":    key,
        "input_fps":       round(input_fps, 2),
        "output_fps":      target_fps,
        "elapsed_seconds": round(time.time() - t0, 1),
        "size_mb":         round(len(out_bytes) / 1024 / 1024, 2),
        "quality_mode":    quality,
    }
