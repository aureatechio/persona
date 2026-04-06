"""
Persona Scorer API client — substitui aggregate_engine com scoring matricial BERTimbau.

Chama a API externa que faz multiplicacao matricial 20k personas x 146 features
e retorna arena_data completo em ~1-3s. Se falhar, retorna None para fallback.

Flag: settings.use_persona_scorer (config.py)
"""
from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx

from arena_analysis.config import settings
from arena_analysis.context_builder import ContextResult


# ── Key mapping: API field names → frontend field names ─────────────────────
_SEGMENT_MAP = {
    "gender": "gender",
    "generation": "generation",
    "macroReligion": "religion",
    "regionBr": "region",
    "racaCor": "race",
    "socialClass": "socialClass",
    "educationLevel": "education",
    "politicalLeaning": "politicalLeaning",
    "voto2022": "voto2022",
    "aprovacaoLula": "aprovacaoLula",
    "voto2026": "voto2026",
    "clusterMacro": "clusterMacro",
    "scoreEco": "scoreEco",
    "scoreCost": "scoreCost",
}


async def analyze(
    question: str,
    context: ContextResult | None,
    pre_classification: dict[str, Any] | None = None,
    geo_filter: dict[str, Any] | None = None,
    total_personas_override: int | None = None,
    visual_figures: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    """
    Call Persona Scorer API and map response to frontend-compatible format.
    Returns None if API fails (caller should fallback to aggregate_engine).
    """
    start = time.time()

    # Build request payload
    content_text = question or ""
    media_context = ""
    if context and context.contexto:
        media_context = context.contexto[:3000]  # trim to avoid huge payloads

    payload: dict[str, Any] = {
        "content_text": content_text,
        "media_context": media_context,
    }

    if pre_classification:
        payload["pre_classification"] = pre_classification

    try:
        async with httpx.AsyncClient(verify=False, timeout=settings.persona_scorer_timeout) as client:
            resp = await client.post(
                f"{settings.persona_scorer_url}/analyze",
                json=payload,
            )

        if resp.status_code != 200:
            print(f"[PersonaScorer] API error: HTTP {resp.status_code} — {resp.text[:200]}")
            return None

        data = resp.json()
        arena_data = data.get("arena_data", {})
        elapsed = time.time() - start

        print(
            f"[PersonaScorer] OK in {elapsed:.2f}s | mode={data.get('mode', '?')} | "
            f"personas={arena_data.get('totalPersonas', '?')} | "
            f"families={[f[0] for f in data.get('detected_families', [])]}"
        )

        return _map_to_frontend(arena_data, data, elapsed)

    except httpx.TimeoutException:
        print(f"[PersonaScorer] Timeout after {settings.persona_scorer_timeout}s — falling back")
        return None
    except Exception as e:
        print(f"[PersonaScorer] Error: {e} — falling back")
        return None


def _map_to_frontend(ad: dict[str, Any], raw: dict[str, Any], elapsed: float) -> dict[str, Any]:
    """Map Persona Scorer arena_data to the format the frontend expects."""
    gs = ad.get("globalStats", {})
    total = ad.get("totalPersonas", 20000)

    # ── Global stats ──
    result: dict[str, Any] = {
        "total": total,
        "positive": gs.get("positive_count", 0),
        "negative": gs.get("negative_count", 0),
        "neutral": gs.get("neutral_count", 0),
        "avgScore": round(gs.get("mean_score", 5.0), 1),
        "processingTime": int(elapsed * 1000),
    }

    # ── Segments (map API keys → frontend keys) ──
    segments: dict[str, list] = {}
    for api_key, fe_key in _SEGMENT_MAP.items():
        items = ad.get(api_key, [])
        if items:
            # Strip total_score (not needed by frontend)
            segments[fe_key] = [
                {k: v for k, v in item.items() if k != "total_score"}
                for item in items
            ]
    result["segments"] = segments

    # ── Top-level arrays the frontend also reads ──
    result["clusterResults"] = ad.get("clusterResults", [])
    result["quadrants"] = ad.get("quadrants", [])
    result["politicalFigures"] = ad.get("politicalFigures", [])
    result["regions"] = ad.get("regions", [])
    result["generations"] = ad.get("generations", [])
    result["educationLevels"] = ad.get("educationLevels", [])
    result["archetypes"] = ad.get("archetypes", [])
    result["stateBreakdown"] = ad.get("stateBreakdown", {})
    result["cityBreakdown"] = ad.get("cityBreakdown", {})
    result["intensityBands"] = ad.get("intensityBands", [])

    # ── Comments placeholder (generated separately by GPT) ──
    result["comments"] = []

    # ── Metadata ──
    result["_scorer_mode"] = raw.get("mode", "unknown")
    result["_scorer_families"] = raw.get("detected_families", [])

    return result
