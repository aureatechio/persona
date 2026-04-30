"""
Modal orchestrator: pipeline completo de lipsync.

Encadeia: audio_preprocess → LatentSync → [face_refine] → resultado

Cada etapa é uma chamada HTTP ao endpoint Modal correspondente.
Image é mínima (só requests) — os pesos e GPU ficam nas funções individuais.

Deploy: modal deploy sync-otimizado/modal/pipeline_app.py
Invoke: POST https://integracao--lipsync-pipeline.modal.run

Body:
{
  "video_url": "https://...",            # required
  "audio_url": "https://...",            # required
  "audio_preprocess": true,             # default true  (F1)
  "face_refine": true,                  # default true  (F4)
  "rife": false,                        # default false (F5 pendente)
  "latentsync": {                        # params do LatentSync (defaults = prod champion)
    "guidance_scale": 2.0,
    "inference_steps": 30,
    "enable_deepcache": true,
    "normalize_fps": true
  },
  "face_refine_config": {
    "fidelity_weight": 0.7
  }
}
"""

import modal

app = modal.App("lipsync-pipeline")

# Image mínima — só faz chamadas HTTP pros outros endpoints
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install("requests", "fastapi")
    .env({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"})
)

AUDIO_PREPROCESS_URL = "https://integracao--audio-preprocess.modal.run"
LATENTSYNC_URL       = "https://integracao--latentsync.modal.run"
FACE_REFINE_URL      = "https://integracao--face-refine.modal.run"
FRAME_INTERP_URL     = "https://integracao--frame-interp.modal.run"


@app.function(
    image=image,
    timeout=3600,  # 60 min — pipeline completo pode levar ~25 min
)
@modal.fastapi_endpoint(method="POST", label="lipsync-pipeline")
def pipeline(payload: dict):
    import time
    import requests as req

    video_url = payload.get("video_url")
    audio_url = payload.get("audio_url")
    if not video_url or not audio_url:
        return {"error": "video_url e audio_url são obrigatórios"}

    do_audio_preprocess = bool(payload.get("audio_preprocess", True))
    do_face_refine       = bool(payload.get("face_refine", True))
    do_rife              = bool(payload.get("rife", False))  # default off — opt-in
    rife_target_fps      = int(payload.get("rife_target_fps", 30))

    ls_cfg = payload.get("latentsync", {})
    fr_cfg = payload.get("face_refine_config", {})

    t0 = time.time()
    steps = {}

    # ─── F1: Audio preprocess ───
    current_audio = audio_url
    if do_audio_preprocess:
        print("[pipeline] F1: audio_preprocess...")
        t = time.time()
        r = req.post(AUDIO_PREPROCESS_URL, json={"audio_url": audio_url}, timeout=120)
        d = r.json()
        if d.get("error"):
            return {"error": f"audio_preprocess: {d['error']}", "failed_step": "audio_preprocess"}
        current_audio = d["audio_url"]
        steps["audio_preprocess"] = {
            "elapsed_seconds": d.get("elapsed_seconds"),
            "size_mb":         d.get("size_mb"),
            "filter_chain":    d.get("filter_chain"),
        }
        print(f"[pipeline] F1 done in {time.time()-t:.1f}s")

    # ─── LatentSync ───
    print("[pipeline] LatentSync...")
    t = time.time()
    r = req.post(LATENTSYNC_URL, json={
        "video_url":        video_url,
        "audio_url":        current_audio,
        "guidance_scale":   ls_cfg.get("guidance_scale",   2.0),
        "inference_steps":  ls_cfg.get("inference_steps",  30),
        "enable_deepcache": ls_cfg.get("enable_deepcache", True),
        "normalize_fps":    ls_cfg.get("normalize_fps",    True),
    }, timeout=2400)
    if not r.ok:
        return {"error": f"LatentSync HTTP {r.status_code}: {r.text[:300]}", "failed_step": "latentsync"}
    d = r.json()
    if d.get("error"):
        return {"error": f"latentsync: {d['error']}", "failed_step": "latentsync"}
    current_video = d["video_url"]
    steps["latentsync"] = {
        "elapsed_seconds":      d.get("elapsed_seconds"),
        "input_fps":            d.get("input_fps"),
        "fps_normalized_to_25": d.get("fps_normalized_to_25"),
        "storage_path":         d.get("storage_path"),
    }
    print(f"[pipeline] LatentSync done in {time.time()-t:.1f}s")

    # ─── F4: Face refine ───
    if do_face_refine:
        print("[pipeline] F4: face_refine...")
        t = time.time()
        r = req.post(FACE_REFINE_URL, json={
            "video_url":       current_video,
            "fidelity_weight": fr_cfg.get("fidelity_weight", 0.7),
        }, timeout=1800)
        if not r.ok:
            return {"error": f"face_refine HTTP {r.status_code}: {r.text[:300]}", "failed_step": "face_refine"}
        d = r.json()
        if d.get("error"):
            return {"error": f"face_refine: {d['error']}", "failed_step": "face_refine"}
        current_video = d["video_url"]
        steps["face_refine"] = {
            "elapsed_seconds": d.get("elapsed_seconds"),
            "size_mb":         d.get("size_mb"),
            "fidelity_weight": d.get("fidelity_weight"),
            "storage_path":    d.get("storage_path"),
        }
        print(f"[pipeline] F4 done in {time.time()-t:.1f}s")

    # ─── F5: Frame interpolation (25fps → target_fps) ───
    if do_rife:
        print(f"[pipeline] F5: frame_interp (25fps → {rife_target_fps}fps)...")
        t = time.time()
        r = req.post(FRAME_INTERP_URL, json={
            "video_url":  current_video,
            "target_fps": rife_target_fps,
            "quality":    "quality",
        }, timeout=600)
        if not r.ok:
            return {"error": f"frame_interp HTTP {r.status_code}: {r.text[:300]}", "failed_step": "frame_interp"}
        d = r.json()
        if d.get("error"):
            return {"error": f"frame_interp: {d['error']}", "failed_step": "frame_interp"}
        current_video = d["video_url"]
        steps["frame_interp"] = {
            "elapsed_seconds": d.get("elapsed_seconds"),
            "input_fps":       d.get("input_fps"),
            "output_fps":      d.get("output_fps"),
            "size_mb":         d.get("size_mb"),
        }
        print(f"[pipeline] F5 done in {time.time()-t:.1f}s")

    final_storage = (
        steps.get("face_refine", {}).get("storage_path")
        or steps.get("latentsync", {}).get("storage_path")
    )

    return {
        "video_url":       current_video,
        "storage_path":    final_storage,
        "elapsed_seconds": round(time.time() - t0, 1),
        "steps_run":       list(steps.keys()),
        "steps":           steps,
    }
