"""
Modal function: audio preprocessing pipeline for LatentSync inputs.

Cleans up TTS/recorded audio before it goes into LatentSync. Order matters:
  1. (optional) trim leading/trailing silence — DEFAULT OFF, preserves duration
  2. denoise (afftdn)
  3. voice band EQ (high-pass 80Hz, low-pass 8kHz)
  4. loudness normalize (EBU R128 → -16 LUFS, broadcast voice standard)
  5. mono 44.1kHz output (LatentSync downsamples internally to 16kHz)

Deploy: modal deploy sync-otimizado/modal/audio_preprocess_app.py
Invoke: POST https://integracao--audio-preprocess.modal.run
  body: {
    "audio_url": "https://...",       # required
    "denoise": true,                  # default true
    "voice_eq": true,                 # default true
    "loudnorm": true,                 # default true
    "trim_silence": false             # default false (keeps original duration)
  }
"""

import modal

app = modal.App("audio-preprocess")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg")
    .pip_install("requests", "fastapi")
    .env({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"})
)


@app.function(
    image=image,
    timeout=300,
    secrets=[modal.Secret.from_name("supabase")],
)
@modal.fastapi_endpoint(method="POST", label="audio-preprocess")
def audio_preprocess(payload: dict):
    import os
    import subprocess
    import tempfile
    import time
    from pathlib import Path

    import requests

    audio_url = payload.get("audio_url")
    if not audio_url:
        return {"error": "audio_url is required"}

    denoise      = bool(payload.get("denoise", True))
    voice_eq     = bool(payload.get("voice_eq", True))
    loudnorm     = bool(payload.get("loudnorm", True))
    trim_silence = bool(payload.get("trim_silence", False))

    t0 = time.time()

    SUPABASE_URL = os.environ["SUPABASE_URL"]
    SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    BUCKET = "voice-models"

    def supa_upload(key, data, ct="audio/wav"):
        url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{key}"
        r = requests.post(url, headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": ct,
            "x-upsert": "true",
        }, data=data, timeout=180)
        r.raise_for_status()

    def supa_sign(key, expires=3600):
        url = f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{key}"
        r = requests.post(url, headers={"Authorization": f"Bearer {SUPABASE_KEY}"},
                          json={"expiresIn": expires}, timeout=30)
        r.raise_for_status()
        return f"{SUPABASE_URL}/storage/v1{r.json()['signedURL']}"

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        in_audio = tmp / "input"
        out_audio = tmp / "output.wav"

        # ─── Download ───
        r = requests.get(audio_url, timeout=180, stream=True)
        r.raise_for_status()
        with open(in_audio, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)

        # ─── Build ffmpeg filter chain ───
        filters = []
        # Order matters: denoise BEFORE EQ (denoise sees full spectrum), loudnorm LAST
        if trim_silence:
            filters.append("silenceremove=start_periods=1:start_duration=0.05:start_threshold=-45dB:detection=peak")
        if denoise:
            filters.append("afftdn=nr=12:nf=-25")  # mild noise reduction
        if voice_eq:
            filters.append("highpass=f=80,lowpass=f=8000")  # voice band
        if loudnorm:
            # EBU R128 single-pass; -16 LUFS is broadcast voice target
            filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")
        if trim_silence:
            # Trim trailing silence too (reverse, trim head, reverse back)
            filters.append("areverse,silenceremove=start_periods=1:start_duration=0.05:start_threshold=-45dB:detection=peak,areverse")

        af = ",".join(filters) if filters else "anull"

        cmd = ["ffmpeg", "-i", str(in_audio),
               "-af", af,
               "-ar", "44100",  # high quality intermediate; LatentSync re-downsamples
               "-ac", "1",      # mono
               "-y", str(out_audio)]

        result = subprocess.run(cmd, capture_output=True, timeout=180)
        if result.returncode != 0:
            return {
                "error": f"ffmpeg failed (rc={result.returncode})",
                "stderr": result.stderr.decode(errors="replace")[-600:],
                "filters": filters,
            }

        out_bytes = out_audio.read_bytes()
        key = f"audio-preprocessed/audio_{int(time.time()*1000)}.wav"
        supa_upload(key, out_bytes, "audio/wav")
        signed = supa_sign(key)

        return {
            "audio_url": signed,
            "storage_path": key,
            "elapsed_seconds": round(time.time() - t0, 1),
            "size_mb": round(len(out_bytes) / 1024 / 1024, 2),
            "filter_chain": af,
            "filters_applied": {
                "trim_silence": trim_silence,
                "denoise": denoise,
                "voice_eq": voice_eq,
                "loudnorm": loudnorm,
            },
        }
