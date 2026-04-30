"""
Modal function: SyncNet evaluator.

Computes Sync-D (LSE-D) and Sync-C (LSE-C) — the canonical metrics for lipsync quality.
Same metric used in the LatentSync, MuseTalk, Wav2Lip papers.

Sync-D: distance audio↔mouth movement. LOWER is better. Typical range 5-15.
Sync-C: confidence in the sync. HIGHER is better. Typical range 1-9.
AV offset: optimal frame offset (frames @ 25fps). Diagnostic.

Deploy: modal deploy sync-otimizado/modal/syncnet_app.py
Invoke: POST https://integracao--syncnet.modal.run
  body: {"video_url": "https://..."}

Reference: https://github.com/joonson/syncnet_python
"""

import modal

app = modal.App("syncnet-eval")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0", "wget", "git")
    .env({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"})
    .pip_install(
        "torch==1.13.1",
        "torchvision==0.14.1",
        extra_index_url="https://download.pytorch.org/whl/cu117",
    )
    .pip_install(
        "scipy==1.10.1",
        "numpy==1.24.4",
        "opencv-python-headless==4.8.0.74",
        "scenedetect==0.6.1",
        "python-speech-features==0.6",
        "ffmpeg-python==0.2.0",
        "fastapi",
        "requests",
    )
    .run_commands(
        "cd /root && git clone https://github.com/joonson/syncnet_python.git",
        "cd /root/syncnet_python && bash download_model.sh",
    )
)


@app.function(
    image=image,
    gpu="T4",   # SyncNet is small — T4 is enough and ~half the price of A10G
    timeout=600,
)
@modal.fastapi_endpoint(method="POST", label="syncnet")
def syncnet(payload: dict):
    """
    POST body: {"video_url": "..."}
    Returns: {sync_d, sync_c, av_offset, elapsed_seconds}
    """
    import os
    import re
    import shutil
    import subprocess
    import tempfile
    import time
    from pathlib import Path

    import requests

    video_url = payload.get("video_url")
    if not video_url:
        return {"error": "video_url is required"}

    t0 = time.time()

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        in_video = tmp / "input.mp4"

        # ─── 1. Download ───
        r = requests.get(video_url, timeout=180, stream=True)
        r.raise_for_status()
        with open(in_video, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)

        ref_name = "eval_run"
        data_dir = tmp / "data"
        data_dir.mkdir()

        # ─── 2. Face detection + tracking ───
        pipe = subprocess.run(
            ["python", "run_pipeline.py",
             "--videofile", str(in_video),
             "--reference", ref_name,
             "--data_dir", str(data_dir)],
            cwd="/root/syncnet_python",
            capture_output=True,
            timeout=300,
        )
        if pipe.returncode != 0:
            return {
                "error": f"pipeline failed (rc={pipe.returncode})",
                "stderr": pipe.stderr.decode(errors="replace")[-600:],
                "stdout": pipe.stdout.decode(errors="replace")[-300:],
            }

        # ─── 3. SyncNet inference ───
        sync = subprocess.run(
            ["python", "run_syncnet.py",
             "--videofile", str(in_video),
             "--reference", ref_name,
             "--data_dir", str(data_dir)],
            cwd="/root/syncnet_python",
            capture_output=True,
            timeout=300,
        )
        if sync.returncode != 0:
            return {
                "error": f"syncnet failed (rc={sync.returncode})",
                "stderr": sync.stderr.decode(errors="replace")[-600:],
                "stdout": sync.stdout.decode(errors="replace")[-300:],
            }

        # syncnet_python prints scores via logger; merge stdout+stderr
        stdout = sync.stdout.decode(errors="replace")
        stderr = sync.stderr.decode(errors="replace")
        combined = stdout + "\n=== STDERR ===\n" + stderr

        # syncnet_python outputs per-frame intermediates AND a final aggregate.
        # Grab the LAST occurrence to get the aggregate (the line after all per-frame logs).
        offsets = re.findall(r"AV offset:\s*(-?[\d.]+)", combined)
        dists   = re.findall(r"Min dist:\s*([\d.]+)", combined)
        confs   = re.findall(r"Confidence:\s*([\d.]+)", combined)

        # Multiple tracks possible (one per detected face track in the video).
        # Convention: report the track with the HIGHEST confidence (most reliable face).
        all_dists = [float(d) for d in dists]
        all_confs = [float(c) for c in confs]
        all_offsets = [float(o) for o in offsets]

        if not all_confs:
            return {
                "error": "no scores parsed",
                "stderr_tail": stderr[-800:],
            }

        best_idx = max(range(len(all_confs)), key=lambda i: all_confs[i])

        return {
            "sync_d": all_dists[best_idx],
            "sync_c": all_confs[best_idx],
            "av_offset": all_offsets[best_idx] if best_idx < len(all_offsets) else None,
            "all_dists": all_dists,
            "all_confs": all_confs,
            "all_offsets": all_offsets,
            "track_count": len(all_confs),
            "best_track": best_idx,
            "elapsed_seconds": round(time.time() - t0, 1),
        }
