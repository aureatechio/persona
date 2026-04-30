"""
Modal function: face refinement com CodeFormer.

Problema que resolve: LatentSync processa internamente em 512x512 (face crop),
entregando face levemente "soft" — perde textura de dentes, pele, barba.
CodeFormer restaura esses detalhes sem mudar o resto do frame.

Params:
  fidelity_weight: float 0.0-1.0 (default 0.7)
    0.0 = restauração máxima (pode perder identidade)
    1.0 = qualidade original (sem restauração)
    0.7 = balanceado — recomendado pro nosso caso

Deploy: modal deploy sync-otimizado/modal/face_refine_app.py
"""

import modal

app = modal.App("face-refine")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0", "git", "wget")
    .env({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"})
    # torch 2.5.1 = mesma versão do LatentSync (suporta numpy 2.x, cuda 12.1)
    .pip_install(
        "torch==2.5.1",
        "torchvision==0.20.1",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install("requests", "fastapi")
    .run_commands(
        "cd /root && git clone https://github.com/sczhou/CodeFormer.git",
        # Instala requirements.txt do CodeFormer (inclui opencv que exige numpy>=2)
        "cd /root/CodeFormer && pip install -r requirements.txt",
        # ffmpeg-python: CodeFormer basicsr/utils/video_util.py faz `import ffmpeg`
        # (não está no requirements.txt deles mas é necessário pra vídeo)
        "pip install 'ffmpeg-python==0.2.0'",
        # basicsr local (versão patched do CodeFormer)
        "cd /root/CodeFormer && python basicsr/setup.py develop",
        # Baixa pesos durante build (zero cold start)
        "cd /root/CodeFormer && python scripts/download_pretrained_models.py CodeFormer",
        "cd /root/CodeFormer && python scripts/download_pretrained_models.py facelib",
    )
)


@app.function(
    image=image,
    gpu="A10G",
    timeout=1800,  # 30 min
    secrets=[modal.Secret.from_name("supabase")],
)
@modal.fastapi_endpoint(method="POST", label="face-refine")
def face_refine(payload: dict):
    """
    POST body: {
      "video_url": "...",          # required — LatentSync output
      "fidelity_weight": 0.7,     # default 0.7, range 0.0-1.0
      "upscale": 1,                # default 1 (no upscale, keep original resolution)
    }
    Returns: {"video_url", "storage_path", "elapsed_seconds", "size_mb"}
    """
    import os
    import subprocess
    import tempfile
    import time
    from pathlib import Path

    import requests

    video_url = payload.get("video_url")
    if not video_url:
        return {"error": "video_url is required"}

    fidelity = float(payload.get("fidelity_weight", 0.7))
    upscale   = int(payload.get("upscale", 1))

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
        }, data=data, timeout=600)
        r.raise_for_status()

    def supa_sign(key, expires=3600):
        url = f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{key}"
        r = requests.post(url, headers={"Authorization": f"Bearer {SUPABASE_KEY}"},
                          json={"expiresIn": expires}, timeout=30)
        r.raise_for_status()
        return f"{SUPABASE_URL}/storage/v1{r.json()['signedURL']}"

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        in_video = tmp / "input.mp4"
        out_dir  = tmp / "codeformer_out"
        out_dir.mkdir()

        # ─── 1. Download LatentSync output ───
        print(f"[face_refine] Downloading video...")
        r = requests.get(video_url, timeout=180, stream=True)
        r.raise_for_status()
        with open(in_video, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
        print(f"[face_refine] Downloaded {in_video.stat().st_size / 1024 / 1024:.2f}MB")

        # ─── 2. Run CodeFormer ───
        print(f"[face_refine] Running CodeFormer (fidelity={fidelity}, upscale={upscale})...")
        result = subprocess.run(
            ["python", "inference_codeformer.py",
             "--input_path",    str(in_video),
             "--output_path",   str(out_dir),
             "-w",              str(fidelity),
             "--bg_upsampler",  "none",   # keep background unchanged
             "--upscale",       str(upscale),
             ],
            cwd="/root/CodeFormer",
            capture_output=True,
            timeout=1500,
            env={**os.environ, "PYTHONPATH": "/root/CodeFormer"},
        )

        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace")
            stdout = result.stdout.decode(errors="replace")
            return {
                "error": f"CodeFormer failed (rc={result.returncode})",
                "stderr_tail": stderr[-1200:],
                "stderr_head": stderr[:600:],
                "stdout_tail": stdout[-400:],
            }

        # ─── 3. Find output file ───
        # CodeFormer writes to {output_path}/restored_video/<filename>
        out_video = out_dir / "restored_video" / "input.mp4"
        if not out_video.exists():
            # Fallback: search recursively for any mp4
            mp4s = list(out_dir.rglob("*.mp4"))
            if not mp4s:
                return {
                    "error": "CodeFormer produced no mp4 output",
                    "stdout": result.stdout.decode(errors="replace")[-600:],
                    "out_dir_tree": [str(p) for p in out_dir.rglob("*")][:30],
                }
            out_video = mp4s[0]

        print(f"[face_refine] Output: {out_video} ({out_video.stat().st_size / 1024 / 1024:.2f}MB)")

        # ─── 4. Upload to Supabase ───
        out_bytes = out_video.read_bytes()
        key = f"face-refined/video_{int(time.time()*1000)}.mp4"
        supa_upload(key, out_bytes)
        signed = supa_sign(key)

    return {
        "video_url": signed,
        "storage_path": key,
        "elapsed_seconds": round(time.time() - t0, 1),
        "size_mb": round(len(out_bytes) / 1024 / 1024, 2),
        "fidelity_weight": fidelity,
        "upscale": upscale,
    }
