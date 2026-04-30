"""
Modal function: mouth-only face-restore for VEED lipsync output.

Strategy: GFPGAN full-face runs per frame but ONLY the mouth region is blended
back onto the original frame. This eliminates the "mask drift" artifact of per-frame
full-face restoration: only pixels inside the soft mouth ROI differ from the input,
and that ROI is temporally smoothed via MediaPipe Face Mesh tracking + moving-average
on the bbox.

Pipeline:
  1. Download video
  2. MediaPipe Face Mesh (video mode) → mouth bbox per frame
  3. Moving average (window=5) on bboxes → temporally stable ROI
  4. GFPGAN full-face per frame → restored candidate
  5. Alpha-feathered blend: output = original*(1-mask) + restored*mask, where mask
     is a Gaussian-blurred binary of the smoothed mouth bbox
  6. Re-assemble with original audio (no tmix — mouth-only is stable enough)
  7. Upload to Supabase Storage, return signed URL

Deploy:  modal deploy modal-enhance/enhance.py
"""

import modal

app = modal.App("selfie-enhance")

# ───────────────────────────────────────────────────────────────────────
# Image: torch + GFPGAN + Real-ESRGAN + MediaPipe + FFmpeg.
# ───────────────────────────────────────────────────────────────────────
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0", "wget", "git")
    # UTF-8 everywhere — basicsr's setup.py prints box-drawing chars that break cp1252/ASCII.
    .env({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8"})
    # Step 1: torch + runtime deps (plain wheels, no build).
    .pip_install(
        "torch==2.1.0",
        "torchvision==0.16.0",
        "numpy<2",
        "opencv-python==4.9.0.80",
        "Pillow",
        "tqdm",
        "scipy",
        "scikit-image",
        "pyyaml",
        "addict",
        "future",
        "lmdb",
        "yapf",
        "tb-nightly",
        "requests",
        "fastapi",
        "mediapipe==0.10.14",
    )
    # Step 2: basicsr/facexlib/gfpgan/realesrgan need --no-build-isolation.
    .run_commands(
        "pip install --no-build-isolation --no-cache-dir basicsr==1.4.2",
        "pip install --no-build-isolation --no-cache-dir facexlib==0.3.0",
        "pip install --no-build-isolation --no-cache-dir gfpgan==1.3.8",
        "pip install --no-build-isolation --no-cache-dir realesrgan==0.3.0",
    )
    # Step 3: patch basicsr for torchvision 0.16 + pre-download weights.
    .run_commands(
        "sed -i 's/from torchvision.transforms.functional_tensor/from torchvision.transforms.functional/g' "
        "/usr/local/lib/python3.10/site-packages/basicsr/data/degradations.py",
        "mkdir -p /root/weights",
        "wget -q -O /root/weights/GFPGANv1.4.pth "
        "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth",
        "wget -q -O /root/weights/realesr-general-x4v3.pth "
        "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth",
    )
)


# MediaPipe Face Mesh — outer lip contour indices.
# We use the convex hull of these to build a polygon mask that hugs the actual
# lip shape instead of a bounding rectangle (which leaked hallucinated pixels
# into the chin/cheek area, causing the "tooth highlight before tooth" artifact).
MOUTH_LANDMARKS = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
    291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
]


@app.function(
    image=image,
    gpu="A10G",
    timeout=1800,
    secrets=[modal.Secret.from_name("supabase")],
)
@modal.fastapi_endpoint(method="POST", label="enhance")
def enhance(payload: dict):
    """
    POST body:
      - video_url (required): public/signed URL of a video to enhance
      - fidelity (optional, default 0.85): GFPGAN weight (identity preservation)
      - feather_px (optional, default 6): Gaussian blur sigma for mask feather (smaller = tighter edge)
      - expand_px (optional, default 2): dilate lip polygon outwards by N pixels before feather

    Returns: {"video_url", "frames_processed", "frames_with_face", "elapsed_seconds"}
    """
    import os
    import subprocess
    import tempfile
    import time
    from pathlib import Path

    import cv2
    import numpy as np
    import requests
    import mediapipe as mp
    from basicsr.archs.srvgg_arch import SRVGGNetCompact
    from gfpgan import GFPGANer
    from realesrgan import RealESRGANer

    video_url = payload.get("video_url")
    fidelity = float(payload.get("fidelity", 0.85))
    feather_px = int(payload.get("feather_px", 6))
    expand_px = int(payload.get("expand_px", 2))
    if not video_url:
        return {"error": "video_url is required"}

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

    # Setup restorers
    bg_model = SRVGGNetCompact(
        num_in_ch=3, num_out_ch=3, num_feat=64,
        num_conv=32, upscale=4, act_type="prelu",
    )
    bg_upsampler = RealESRGANer(
        scale=4,
        model_path="/root/weights/realesr-general-x4v3.pth",
        dni_weight=None,
        model=bg_model,
        tile=400,
        pre_pad=10,
        half=True,
    )
    restorer = GFPGANer(
        model_path="/root/weights/GFPGANv1.4.pth",
        upscale=1,
        arch="clean",
        channel_multiplier=2,
        bg_upsampler=bg_upsampler,
    )

    # MediaPipe in video mode (tracking across frames)
    face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    def lip_polygon(landmarks, w: int, h: int):
        """Returns the convex hull (int polygon) of the outer-lip landmarks, or None."""
        pts = []
        for idx in MOUTH_LANDMARKS:
            lm = landmarks[idx]
            x = int(round(lm.x * w))
            y = int(round(lm.y * h))
            if 0 <= x < w and 0 <= y < h:
                pts.append([x, y])
        if len(pts) < 4:
            return None
        arr = np.array(pts, dtype=np.int32).reshape(-1, 1, 2)
        hull = cv2.convexHull(arr)
        return hull

    def build_mask(hull, w: int, h: int) -> np.ndarray:
        """Fill the lip polygon, dilate slightly, then Gaussian-feather the edges."""
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [hull], 255)
        if expand_px > 0:
            k = 2 * expand_px + 1
            mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        if feather_px > 0:
            k = 2 * feather_px + 1
            mask = cv2.GaussianBlur(mask, (k, k), feather_px)
        return mask.astype(np.float32) / 255.0

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        in_video = tmp / "in.mp4"
        out_frames = tmp / "out_frames"
        out_frames.mkdir()

        # ─── 1. Download ───
        r = requests.get(video_url, timeout=180, stream=True)
        r.raise_for_status()
        with open(in_video, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)

        # ─── 2. Read all frames + detect mouth bbox per frame ───
        cap = cv2.VideoCapture(str(in_video))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print(f"[enhance] Input: {width}x{height} @ {fps:.2f}fps, {total} frames")

        frames = []
        hulls = []
        frames_with_face = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frames.append(frame)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = face_mesh.process(rgb)
            hull = None
            if result.multi_face_landmarks:
                hull = lip_polygon(result.multi_face_landmarks[0].landmark, width, height)
            if hull is not None:
                frames_with_face += 1
            hulls.append(hull)
        cap.release()
        face_mesh.close()
        print(f"[enhance] Detected lips on {frames_with_face}/{len(frames)} frames in {time.time() - t0:.1f}s")

        # ─── 3. GFPGAN per frame + polygon-mask blend (no bbox smoothing —
        # MediaPipe tracking already provides per-frame stability) ───
        for i, frame in enumerate(frames):
            hull = hulls[i]
            if hull is None:
                cv2.imwrite(str(out_frames / f"frame_{i:06d}.png"), frame)
                continue

            try:
                _, _, restored = restorer.enhance(
                    frame,
                    has_aligned=False,
                    only_center_face=False,
                    paste_back=True,
                    weight=fidelity,
                )
            except Exception as e:
                print(f"[enhance] GFPGAN frame {i} failed ({e}), skipping")
                cv2.imwrite(str(out_frames / f"frame_{i:06d}.png"), frame)
                continue
            if restored is None:
                cv2.imwrite(str(out_frames / f"frame_{i:06d}.png"), frame)
                continue
            if restored.shape != frame.shape:
                restored = cv2.resize(restored, (frame.shape[1], frame.shape[0]))

            mask = build_mask(hull, frame.shape[1], frame.shape[0])
            mask3 = mask[..., np.newaxis]

            blended = frame.astype(np.float32) * (1 - mask3) + restored.astype(np.float32) * mask3
            blended = np.clip(blended, 0, 255).astype(np.uint8)
            cv2.imwrite(str(out_frames / f"frame_{i:06d}.png"), blended)

            if (i + 1) % 30 == 0:
                print(f"[enhance] processed {i + 1}/{len(frames)} frames ({time.time() - t0:.1f}s)")

        print(f"[enhance] All {len(frames)} frames done in {time.time() - t0:.1f}s. Reassembling...")

        # ─── 6. Reassemble with original audio (NO tmix — mouth-only is temporally stable) ───
        out_video = tmp / "out.mp4"
        ff = subprocess.run(
            [
                "ffmpeg",
                "-framerate", f"{fps}",
                "-i", str(out_frames / "frame_%06d.png"),
                "-i", str(in_video),
                "-map", "0:v:0", "-map", "1:a:0?",
                "-c:v", "libx264", "-crf", "18", "-preset", "medium",
                "-c:a", "copy",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                "-shortest",
                "-y", str(out_video),
            ],
            capture_output=True,
            timeout=600,
        )
        if ff.returncode != 0:
            err = ff.stderr.decode(errors="replace")[-500:]
            return {"error": f"ffmpeg reassemble failed: {err}"}

        out_bytes = out_video.read_bytes()
        print(f"[enhance] Final video: {len(out_bytes) / 1024 / 1024:.2f}MB")

        # ─── 7. Upload ───
        key = f"test-enhanced/modal_mouth_{int(time.time() * 1000)}.mp4"
        supa_upload(key, out_bytes)
        signed_url = supa_sign(key)

    return {
        "video_url": signed_url,
        "storage_path": key,
        "frames_processed": len(frames),
        "frames_with_face": frames_with_face,
        "fps": round(fps, 2),
        "input_resolution": f"{width}x{height}",
        "elapsed_seconds": round(time.time() - t0, 1),
        "mode": "mouth-only",
    }


# ───────────────────────────────────────────────────────────────────────
# Local test harness:  modal run modal-enhance/enhance.py::main --video-url "..."
# ───────────────────────────────────────────────────────────────────────
@app.local_entrypoint()
def main(video_url: str, fidelity: float = 0.85):
    result = enhance.remote({"video_url": video_url, "fidelity": fidelity})
    print(result)
