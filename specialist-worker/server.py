"""
Specialist Worker — FastAPI service that runs 5 AI specialists in parallel.

Prompts are loaded from Supabase (arena_prompts table) — editable without redeploy.
Each specialist runs as a separate Claude call with its own prompt.
Results are returned as a SpecialistPanel consumed by the DUDA analysis.

Run locally: python server.py
Or: uvicorn server:app --port 3011 --reload
"""

import asyncio
import json
import logging
import time
from typing import Any

import anthropic
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client

from config import (
    ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY,
    PORT, SPECIALIST_MODEL, SPECIALIST_MAX_TOKENS,
)
from specialists import SPECIALISTS, OUTPUT_SCHEMA, build_context, get_all_specialist_ids

# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("specialist-worker")

# ── Clients ──────────────────────────────────────────────────────────────────

claude = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Prompt Cache (from Supabase) ─────────────────────────────────────────────

_prompt_cache: dict[str, str] = {}
_cache_ts: float = 0
CACHE_TTL = 300  # 5 minutes — prompts refresh every 5 min

async def load_prompts() -> dict[str, str]:
    """Load specialist prompts from Supabase with 5-min cache."""
    global _prompt_cache, _cache_ts

    if _prompt_cache and (time.time() - _cache_ts) < CACHE_TTL:
        return _prompt_cache

    try:
        prompt_ids = [spec["prompt_id"] for spec in SPECIALISTS.values()]
        res = sb.table("arena_prompts") \
            .select("id,content") \
            .in_("id", prompt_ids) \
            .eq("is_active", True) \
            .execute()

        new_cache = {row["id"]: row["content"] for row in (res.data or [])}

        if new_cache:
            _prompt_cache = new_cache
            _cache_ts = time.time()
            log.info(f"Loaded {len(new_cache)} specialist prompts from Supabase")
        else:
            log.warning("No specialist prompts found in Supabase — using cache or empty")

        return _prompt_cache
    except Exception as e:
        log.error(f"Failed to load prompts from Supabase: {e}")
        return _prompt_cache  # Return stale cache on error


# ── FastAPI ──────────────────────────────────────────────────────────────────

app = FastAPI(title="Specialist Worker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response models ──────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    question: str = ""
    positive: int = 0
    negative: int = 0
    neutral: int = 0
    totalPersonas: int = 0
    segments: dict[str, Any] = {}
    contentMeta: dict[str, Any] = {}


class SpecialistResult(BaseModel):
    id: str
    name: str
    emoji: str
    verdict: str
    riskLevel: str = "medio"
    keyPoints: list[str] = []
    recommendations: list[dict[str, Any]] = []
    dataHighlight: str | None = None


class SpecialistPanelResponse(BaseModel):
    consensus: str = ""
    divergences: str | None = None
    specialists: list[SpecialistResult] = []
    processingTimeMs: int = 0


# ── Core logic ───────────────────────────────────────────────────────────────

async def run_specialist(specialist_id: str, context: str, prompts: dict[str, str]) -> SpecialistResult:
    """Run a single specialist analysis via Claude with prompt from Supabase."""
    spec = SPECIALISTS[specialist_id]
    prompt_content = prompts.get(spec["prompt_id"], "")

    if not prompt_content:
        log.warning(f"[{specialist_id}] No prompt found in Supabase for {spec['prompt_id']}")
        return SpecialistResult(
            id=spec["id"],
            name=spec["name"],
            emoji=spec["emoji"],
            verdict="Prompt nao configurado no Supabase",
            riskLevel="medio",
        )

    # Combine Supabase prompt + output schema
    system_prompt = prompt_content + OUTPUT_SCHEMA

    try:
        response = await claude.messages.create(
            model=SPECIALIST_MODEL,
            max_tokens=SPECIALIST_MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": context}],
        )

        raw = response.content[0].text.strip()

        # Strip markdown wrapping if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        parsed = json.loads(raw)

        return SpecialistResult(
            id=spec["id"],
            name=spec["name"],
            emoji=spec["emoji"],
            verdict=parsed.get("verdict", "Analise indisponivel")[:80],
            riskLevel=parsed.get("riskLevel", "medio"),
            keyPoints=parsed.get("keyPoints", [])[:3],
            recommendations=parsed.get("recommendations", [])[:2],
            dataHighlight=parsed.get("dataHighlight"),
        )

    except json.JSONDecodeError as e:
        log.error(f"[{specialist_id}] JSON parse error: {e}")
        return SpecialistResult(
            id=spec["id"],
            name=spec["name"],
            emoji=spec["emoji"],
            verdict="Erro ao processar analise",
            riskLevel="medio",
            keyPoints=["Falha no parse do resultado da IA"],
        )
    except Exception as e:
        log.error(f"[{specialist_id}] Error: {e}")
        return SpecialistResult(
            id=spec["id"],
            name=spec["name"],
            emoji=spec["emoji"],
            verdict="Especialista indisponivel",
            riskLevel="medio",
            keyPoints=[f"Erro: {str(e)[:100]}"],
        )


def build_consensus(results: list[SpecialistResult]) -> str:
    """Build consensus from specialist results based on risk distribution."""
    high_risk = sum(1 for r in results if r.riskLevel in ("alto", "critico"))
    low_risk = sum(1 for r in results if r.riskLevel == "baixo")

    if high_risk >= 3:
        return "A maioria dos especialistas identifica riscos significativos neste conteudo — ajustes urgentes sao necessarios antes da publicacao."
    elif low_risk >= 3:
        return "Os especialistas concordam que o conteudo tem boa performance geral, com oportunidades pontuais de otimizacao."
    else:
        return "Ha divergencia entre os especialistas — alguns veem riscos enquanto outros identificam oportunidades. Analise detalhada recomendada."


def find_divergences(results: list[SpecialistResult]) -> str | None:
    """Find divergences between specialist opinions."""
    risk_levels = [r.riskLevel for r in results]
    has_high = any(r in ("alto", "critico") for r in risk_levels)
    has_low = any(r == "baixo" for r in risk_levels)

    if has_high and has_low:
        high_names = [r.name for r in results if r.riskLevel in ("alto", "critico")]
        low_names = [r.name for r in results if r.riskLevel == "baixo"]
        return (
            f"{', '.join(high_names)} alerta{'m' if len(high_names) > 1 else ''} para riscos, "
            f"enquanto {', '.join(low_names)} ve{'em' if len(low_names) > 1 else ''} oportunidades."
        )
    return None


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=SpecialistPanelResponse)
async def analyze(payload: AnalysisRequest):
    """Run all 5 specialists in parallel on the same data."""
    start = time.time()
    log.info(f"Starting analysis — {payload.totalPersonas} personas, question: {payload.question[:60]}...")

    # Load prompts from Supabase (cached 5 min)
    prompts = await load_prompts()

    # Build shared context
    context = build_context(payload.model_dump())

    # Fire all 5 specialists in parallel
    specialist_ids = get_all_specialist_ids()
    tasks = [run_specialist(sid, context, prompts) for sid in specialist_ids]
    results: list[SpecialistResult] = await asyncio.gather(*tasks)

    # Filter failed specialists for consensus
    valid_results = [r for r in results if r.verdict not in ("Especialista indisponivel", "Prompt nao configurado no Supabase")]

    consensus = build_consensus(valid_results) if valid_results else "Analise indisponivel"
    divergences = find_divergences(valid_results) if len(valid_results) >= 2 else None

    elapsed_ms = int((time.time() - start) * 1000)
    log.info(f"Analysis complete — {len(valid_results)}/5 specialists ok — {elapsed_ms}ms")

    return SpecialistPanelResponse(
        consensus=consensus,
        divergences=divergences,
        specialists=results,
        processingTimeMs=elapsed_ms,
    )


@app.get("/health")
async def health():
    """Health check."""
    prompts = await load_prompts()
    return {
        "status": "ok",
        "model": SPECIALIST_MODEL,
        "specialists": len(SPECIALISTS),
        "prompts_loaded": len(prompts),
    }


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info(f"Starting specialist-worker on port {PORT}")
    log.info(f"Model: {SPECIALIST_MODEL} | Specialists: {len(SPECIALISTS)}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
