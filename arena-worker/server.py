"""
Arena Worker — FastAPI SSE server.

Receives a question, loads personas from Supabase, classifies each one's
sentiment using GPT-4o-mini, and streams progress via Server-Sent Events.

SSE protocol (matches what the Next.js frontend expects):
  data: {"type":"personas_loaded","data":{"count":20000}}
  data: {"type":"progress","data":{"processed":500,"total":20000,"positive":230,"negative":200,"neutral":70}}
  data: {"type":"results","data":{...full simulation result...}}
  data: {"type":"done","data":{"total_personas":20000}}
"""

import json
import time
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from config import PORT, AI_BATCH_SIZE
from db import load_all_personas
from classifier import classify_batch
from segments import SegmentAccumulator


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

    if not question:
        return {"error": "Missing question"}

    async def event_stream():
        personas = _ensure_cache()
        total = len(personas)

        # 1. Notify personas loaded
        yield json.dumps({"type": "personas_loaded", "data": {"count": total}})

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

            # Classify this batch via GPT
            sentiments = await asyncio.to_thread(
                classify_batch, question, batch, context_text
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


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=False)
