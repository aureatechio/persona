"""
⚠️  CÓDIGO LEGADO — NÃO É O BACKEND DE PRODUÇÃO DA ARENA ⚠️

Este arena-worker/ é uma versão ANTIGA e simplificada que NÃO roda em produção.
Roda no DO app "video-duda" (2a5e2bce) — porta 3002.

╔══════════════════════════════════════════════════════════════════╗
║  O BACKEND REAL DA ARENA ESTÁ EM:                              ║
║  scripts/arena_analysis/                                        ║
║  DO app: arena-analysis-api (a38cc4e4) — porta 8000             ║
║  deploy_on_push: true                                           ║
║                                                                  ║
║  Se precisar alterar prompts, classificação, persona loop,      ║
║  pré-classificação, ou qualquer coisa da Arena:                 ║
║  → EDITE scripts/arena_analysis/, NÃO este diretório.           ║
╚══════════════════════════════════════════════════════════════════╝
"""

import json
import time
import asyncio
import base64
import tempfile
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from openai import OpenAI

from config import PORT, AI_BATCH_SIZE, OPENAI_API_KEY
from db import load_all_personas
from classifier import classify_batch
from segments import SegmentAccumulator
from pre_classifier import pre_classify
from calibration import pre_classify_verbose, classify_batch_verbose


# ── Persona cache (in-memory) ────────────────────────────────────────────────

_persona_cache: list[dict] = []
_cache_loaded = False


def _ensure_cache():
    global _persona_cache, _cache_loaded
    if _cache_loaded and len(_persona_cache) > 0:
        return _persona_cache

    print("[Arena] Loading personas into cache...")
    _persona_cache = load_all_personas(
        on_batch=lambda loaded, total, _: print(f"  loaded {loaded}/{total}")
    )
    _cache_loaded = True
    print(f"[Arena] Cache ready: {len(_persona_cache)} personas")
    return _persona_cache


# ── App setup ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load cache on startup
    _ensure_cache()
    yield


app = FastAPI(title="Arena Worker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/api/arena/health")
def health():
    return {"status": "ok", "personas_cached": len(_persona_cache)}


# ── Main analysis endpoint ────────────────────────────────────────────────────

@app.post("/api/arena/analyze")
async def analyze(request: Request):
    body = await request.json()
    question = body.get("question", "")
    context_text = body.get("context_text")

    # Accept either question or context_text as primary input
    if not question and not context_text:
        return {"error": "Missing question or context_text"}

    # When context is primary (e.g. video transcript), use truncated context as question label
    if not question and context_text:
        question = context_text[:500]

    async def event_stream():
        # Run pre-classification in parallel with cache check
        # Pre-classifier understands the question semantically (type, figures, stance, framing)
        # so the batch classifier doesn't need hardcoded word lists or regex
        pre_class_task = asyncio.create_task(
            asyncio.to_thread(pre_classify, question, context_text)
        )

        personas = _ensure_cache()
        total = len(personas)

        # 1. Notify personas loaded
        yield json.dumps({"type": "personas_loaded", "data": {"count": total}})

        # Wait for pre-classification (should already be done — ~800ms vs cache is instant when warm)
        pre_class = await pre_class_task

        # Emit pre-classification result so frontend can show "Analyzing..." phase
        yield json.dumps({
            "type": "pre_classified",
            "data": {
                "question_type": pre_class.get("type", "other"),
                "core_position": pre_class.get("core_position", "")[:200],
                "figures": pre_class.get("figures", []),
            },
        })

        # 2. Process in AI batches, streaming progress
        positive = 0
        negative = 0
        neutral = 0
        processed = 0
        seg_acc = SegmentAccumulator()
        start_time = time.time()

        batch_size = AI_BATCH_SIZE

        for offset in range(0, total, batch_size):
            batch = personas[offset : offset + batch_size]

            # Classify this batch via GPT — pre_class provides semantic disambiguation
            sentiments = await asyncio.to_thread(
                classify_batch, question, batch, context_text, pre_class
            )

            # Accumulate results
            for persona, sentiment in zip(batch, sentiments):
                if sentiment == "positive":
                    positive += 1
                elif sentiment == "negative":
                    negative += 1
                else:
                    neutral += 1
                seg_acc.add(persona, sentiment)

            processed += len(batch)

            # Stream progress
            yield json.dumps({
                "type": "progress",
                "data": {
                    "processed": processed,
                    "total": total,
                    "positive": positive,
                    "negative": negative,
                    "neutral": neutral,
                    "segments": seg_acc.to_dict(),
                },
            })

        elapsed = time.time() - start_time

        # 3. Build final results
        results = {
            "total": total,
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "processingTime": round(elapsed * 1000),
            "segments": seg_acc.to_dict(),
            # These are populated by the frontend's JS for now
            "archetypes": [],
            "clusterResults": [],
            "comments": [],
            "ideologicalPoints": [],
            "quadrants": [],
            "regions": [],
            "generations": [],
            "educationLevels": [],
            "politicalFigures": [],
            "intensityBands": [],
        }

        yield json.dumps({"type": "results", "data": results})

        # 4. Done
        yield json.dumps({
            "type": "done",
            "data": {"total_personas": total, "processing_time_ms": round(elapsed * 1000)},
        })

    return EventSourceResponse(
        event_stream(),
        media_type="text/event-stream",
    )


# ── Calibration endpoint (verbose mode for debugging/tuning) ─────────────────

@app.post("/api/calibracao/analyze")
async def calibration_analyze(request: Request):
    body = await request.json()
    question = body.get("question", "")
    context_text = body.get("context_text")
    geo_filter = body.get("geo_filter")

    if not question and not context_text:
        return {"error": "Missing question or context_text"}

    if not question and context_text:
        question = context_text[:500]

    async def event_stream():
        personas = list(_ensure_cache())  # Copy so we can filter
        original_count = len(personas)

        # 1. Start
        yield json.dumps({"type": "cal_start", "data": {
            "question": question,
            "total_personas": original_count,
        }})

        # 2. Apply geo filter
        if geo_filter:
            state = geo_filter.get("state")
            city = geo_filter.get("city")
            sample_removed = []

            filtered = []
            for p in personas:
                match_state = not state or (p.get("state") or "").upper() == state.upper()
                match_city = not city or (p.get("city") or "").lower() == city.lower()
                if match_state and match_city:
                    filtered.append(p)
                elif len(sample_removed) < 5:
                    sample_removed.append({
                        "name": p.get("name", "?"),
                        "state": p.get("state", "?"),
                        "city": p.get("city", "?"),
                    })

            personas = filtered

            yield json.dumps({"type": "cal_geo_filter", "data": {
                "original_count": original_count,
                "filtered_count": len(personas),
                "criteria": {"state": state, "city": city},
                "sample_removed": sample_removed,
            }})
        else:
            yield json.dumps({"type": "cal_geo_filter", "data": {
                "original_count": original_count,
                "filtered_count": original_count,
                "criteria": None,
                "sample_removed": [],
            }})

        total = len(personas)

        # 3. Pre-classify (verbose)
        pre_result = await asyncio.to_thread(pre_classify_verbose, question, context_text)

        yield json.dumps({"type": "cal_pre_classify", "data": {
            "system_prompt": pre_result["system_prompt"],
            "user_prompt": pre_result["user_prompt"],
            "raw_response": pre_result["raw_response"],
            "parsed": pre_result["result"],
            "latency_ms": pre_result["latency_ms"],
            "tokens": pre_result["tokens"],
        }})

        pre_class = pre_result["result"]

        # 4. Classify in batches (verbose)
        positive = 0
        negative = 0
        neutral = 0
        processed = 0
        seg_acc = SegmentAccumulator()
        start_time = time.time()

        batch_size = AI_BATCH_SIZE
        batch_total = (total + batch_size - 1) // batch_size

        for batch_idx, offset in enumerate(range(0, total, batch_size)):
            batch = personas[offset : offset + batch_size]

            # Emit batch start with persona summaries
            yield json.dumps({"type": "cal_batch_start", "data": {
                "batch_index": batch_idx,
                "batch_total": batch_total,
                "persona_count": len(batch),
                "persona_ids": [p.get("id", f"idx-{offset+i}") for i, p in enumerate(batch)],
            }})

            # Classify verbose
            batch_result = await asyncio.to_thread(
                classify_batch_verbose, question, batch, context_text, pre_class
            )

            # Emit batch result with full details
            persona_details = []
            for i, (persona, sentiment) in enumerate(zip(batch, batch_result["sentiments"])):
                if sentiment == "positive":
                    positive += 1
                elif sentiment == "negative":
                    negative += 1
                else:
                    neutral += 1
                seg_acc.add(persona, sentiment)

                persona_details.append({
                    "id": persona.get("id", f"idx-{offset+i}"),
                    "name": persona.get("name", "?"),
                    "state": persona.get("state", "?"),
                    "age": persona.get("age", 0),
                    "political_leaning": persona.get("political_leaning", "?"),
                    "sentiment": sentiment,
                    "summary": batch_result["persona_summaries"][i] if i < len(batch_result["persona_summaries"]) else "",
                })

            processed += len(batch)

            yield json.dumps({"type": "cal_batch_result", "data": {
                "batch_index": batch_idx,
                "batch_total": batch_total,
                "prompt": batch_result["prompt"],
                "raw_response": batch_result["raw_response"],
                "sentiments": batch_result["sentiments"],
                "personas": persona_details,
                "latency_ms": batch_result["latency_ms"],
                "tokens": batch_result["tokens"],
            }})

            # Emit progress
            yield json.dumps({"type": "cal_progress", "data": {
                "processed": processed,
                "total": total,
                "positive": positive,
                "negative": negative,
                "neutral": neutral,
                "segments": seg_acc.to_dict(),
            }})

        elapsed = time.time() - start_time

        # 5. Final results
        yield json.dumps({"type": "cal_results", "data": {
            "total": total,
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "processing_time_ms": round(elapsed * 1000),
            "segments": seg_acc.to_dict(),
        }})

        # 6. Done
        yield json.dumps({"type": "cal_done", "data": {
            "total_personas": total,
            "processing_time_ms": round(elapsed * 1000),
        }})

    return EventSourceResponse(
        event_stream(),
        media_type="text/event-stream",
    )


# ── Video transcription via Whisper ───────────────────────────────────────────

MIME_TO_EXT = {
    "video/webm": "webm",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
}


@app.post("/api/transcribe")
async def transcribe(request: Request):
    """
    Accept base64 video/audio, send directly to Whisper API, return transcript.
    Whisper accepts video files natively (mp4, webm, mov, etc.) — no FFmpeg needed.
    """
    if not OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY not configured"}

    body = await request.json()
    data: str = body.get("data", "")
    name: str = body.get("name", "recording")
    mime_type: str = body.get("mimeType", "video/mp4")

    if not data:
        return {"error": "No data provided"}

    # Strip data URI prefix if present
    raw_b64 = data
    if data.startswith("data:"):
        parts = data.split(";base64,", 1)
        if len(parts) == 2:
            mime_type = parts[0].replace("data:", "")
            raw_b64 = parts[1]

    try:
        file_bytes = base64.b64decode(raw_b64)
    except Exception:
        return {"error": "Invalid base64 data"}

    if len(file_bytes) > 25 * 1024 * 1024:
        return {"error": "Arquivo muito grande. Maximo 25MB."}

    ext = MIME_TO_EXT.get(mime_type, "mp4")
    base_name = os.path.splitext(name)[0]
    file_name = f"{base_name}.{ext}"

    # Write to temp file and send to Whisper
    tmp = None
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False)
        tmp.write(file_bytes)
        tmp.close()

        client = OpenAI(api_key=OPENAI_API_KEY)
        with open(tmp.name, "rb") as f:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=(file_name, f),
                language="pt",
                response_format="text",
            )

        transcript = result.strip() if isinstance(result, str) else str(result).strip()
        print(f"[Transcribe] OK — {len(file_bytes)} bytes → {len(transcript)} chars")
        return {"transcript": transcript}

    except Exception as e:
        print(f"[Transcribe] Error: {e}")
        return {"error": "Falha na transcricao", "detail": str(e)}
    finally:
        if tmp and os.path.exists(tmp.name):
            os.unlink(tmp.name)


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=False)
