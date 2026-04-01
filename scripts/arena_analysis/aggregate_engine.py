"""
Aggregate Engine — substitui o persona_loop.

Em vez de 20k chamadas individuais, faz UMA chamada a GPT-4o com o
sentimento geral pre-computado e DERIVA scores por segmento.
"""
from __future__ import annotations

import asyncio
import json
import random
import re
import time
from typing import Any, AsyncGenerator

import openai

from arena_analysis.config import settings
from arena_analysis.context_builder import ContextResult
from arena_analysis.aggregate_prompt import (
    AGGREGATE_SYSTEM_PROMPT,
    build_user_prompt,
)


# ── Profile cache ────────────────────────────────────────────────────────────
_profile_cache: dict[str, Any] | None = None
_profile_cache_ts: float = 0.0
_PROFILE_TTL = 600  # 10 min


async def load_profile() -> dict[str, Any]:
    """Carrega o perfil agregado do Supabase (com cache)."""
    global _profile_cache, _profile_cache_ts

    now = time.time()
    if _profile_cache and (now - _profile_cache_ts) < _PROFILE_TTL:
        return _profile_cache

    def _fetch():
        from supabase import create_client
        sb = create_client(settings.supabase_url, settings.supabase_key)
        resp = sb.table("arena_sentiment_profile").select("*").eq("id", "default").single().execute()
        return resp.data

    data = await asyncio.to_thread(_fetch)
    if not data:
        raise RuntimeError("arena_sentiment_profile not found. Run aggregate_builder first.")

    _profile_cache = data
    _profile_cache_ts = now
    print(f"[AggregateEngine] Profile loaded: {data.get('total_personas', 0)} personas, computed at {data.get('computed_at', 'unknown')}")
    return data


def _clean_json_response(text: str) -> str:
    """Remove markdown fences e whitespace."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()
    return text


async def analyze(
    question: str,
    context: ContextResult | None,
    pre_classification: dict[str, Any] | None = None,
    ideological_frame: str | None = None,
    geo_filter: dict[str, Any] | None = None,
    total_personas_override: int | None = None,
) -> dict[str, Any]:
    """
    Analise agregada: 1 chamada a GPT-4o para derivar scores por segmento.

    Retorna dict no formato identico ao results_aggregator.aggregate_results().
    geo_filter: {"state": "ES", "city": null} — filtra resultados para estado/cidade
    total_personas_override: numero real de personas apos filtro geo
    """
    profile = await load_profile()
    total = total_personas_override or profile.get("total_personas", 20000)

    # Build context string
    ctx_str = ""
    if context:
        ctx_str = context.contexto or ""
        if ideological_frame:
            ctx_str += f"\n\nFRAME IDEOLOGICO:\n{ideological_frame}"

    # Geo filter instruction
    if geo_filter and geo_filter.get("state"):
        state = geo_filter["state"]
        city = geo_filter.get("city")
        geo_instruction = f"\n\nFILTRO GEOGRAFICO ATIVO: Analise APENAS personas do estado {state}"
        if city:
            geo_instruction += f", cidade {city}"
        geo_instruction += f".\nO total_personas e {total} (apenas desta regiao). stateBreakdown e cityBreakdown devem conter APENAS dados de {state}."
        ctx_str += geo_instruction

    # Build user prompt
    user_prompt = build_user_prompt(
        question=question,
        context=ctx_str,
        pre_classification=pre_classification,
        profile=profile,
    )

    # Call GPT-4o
    client = openai.AsyncOpenAI(api_key=settings.openai_api_keys[0] if settings.openai_api_keys else settings.openai_api_key)

    print(f"[AggregateEngine] Calling {settings.aggregate_model} for {total} personas...")
    start = time.time()

    response = await client.chat.completions.create(
        model=settings.aggregate_model,
        messages=[
            {"role": "system", "content": AGGREGATE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=16000,
        temperature=0.7,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or ""
    elapsed = time.time() - start
    tokens_in = response.usage.prompt_tokens if response.usage else 0
    tokens_out = response.usage.completion_tokens if response.usage else 0
    finish_reason = response.choices[0].finish_reason

    print(f"[AggregateEngine] Response in {elapsed:.1f}s | {tokens_in} in + {tokens_out} out | finish: {finish_reason}")

    if finish_reason == "length":
        print(f"[AggregateEngine] WARNING: output truncated at {tokens_out} tokens — JSON may be incomplete")

    # Parse JSON — try to repair truncated JSON
    cleaned = _clean_json_response(raw)
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"[AggregateEngine] JSON parse error: {e}")
        # Try to repair truncated JSON by closing open brackets
        repaired = cleaned
        open_braces = repaired.count("{") - repaired.count("}")
        open_brackets = repaired.count("[") - repaired.count("]")
        # Remove trailing comma or incomplete value
        repaired = repaired.rstrip().rstrip(",")
        repaired += "]" * open_brackets + "}" * open_braces
        try:
            result = json.loads(repaired)
            print(f"[AggregateEngine] JSON repaired successfully (closed {open_braces} braces, {open_brackets} brackets)")
        except json.JSONDecodeError as e2:
            print(f"[AggregateEngine] JSON repair failed: {e2}")
            print(f"[AggregateEngine] Raw tail (last 200 chars): ...{cleaned[-200:]}")
            raise RuntimeError(f"GPT returned invalid JSON: {e}")

    # Validate basic structure
    required_keys = ["total", "positive", "negative", "neutral", "segments", "comments"]
    missing = [k for k in required_keys if k not in result]
    if missing:
        raise RuntimeError(f"GPT response missing keys: {missing}")

    # Ensure total matches
    result["total"] = total

    # Add processing metadata
    result["processingTime"] = int(elapsed * 1000)
    result.setdefault("avgScore", 5.0)

    return result


def generate_ideological_points(
    profile: dict[str, Any],
    analysis_result: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Gera pontos sinteticos para o scatter plot ideologico.
    ~500-1000 pontos distribuidos pelos clusters.
    """
    clusters_data = profile.get("clusters", {}).get("clusters", {})
    cluster_results = {c["id"]: c for c in analysis_result.get("clusterResults", [])}
    persona_samples = profile.get("persona_samples", [])

    points: list[dict[str, Any]] = []

    # Use persona samples first (real coordinates)
    for sample in persona_samples:
        cid = sample.get("cluster_id", "")
        cr = cluster_results.get(cid, {})
        total_c = cr.get("count", 1)
        pos_c = cr.get("positive", 0)
        neg_c = cr.get("negative", 0)

        # Derive sentiment based on cluster distribution
        r = random.random()
        pos_ratio = pos_c / total_c if total_c > 0 else 0.33
        neg_ratio = neg_c / total_c if total_c > 0 else 0.33
        if r < pos_ratio:
            sentiment = "positive"
        elif r < pos_ratio + neg_ratio:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        points.append({
            "personaId": sample.get("name", f"sample-{len(points)}"),
            "name": sample.get("name", "Persona"),
            "scoreEco": float(sample.get("score_economico", 0)),
            "scoreCost": float(sample.get("score_costumes", 0)),
            "clusterId": cid,
            "clusterName": sample.get("nome_grupo", ""),
            "sentiment": sentiment,
            "region": sample.get("region_br", ""),
            "generation": sample.get("generation", ""),
            "educationLevel": sample.get("education_level", ""),
        })

    # Generate additional synthetic points to reach ~800 total
    target_total = 800
    remaining = max(0, target_total - len(points))

    if remaining > 0 and clusters_data:
        for cid, cdata in clusters_data.items():
            count = cdata.get("count", 0)
            if count == 0:
                continue
            # Proportional allocation
            n_points = max(1, int(remaining * count / profile.get("total_personas", 20000)))
            avg_eco = cdata.get("avg_score_eco", 0)
            avg_cost = cdata.get("avg_score_cost", 0)

            cr = cluster_results.get(cid, {})
            total_c = cr.get("count", 1)
            pos_c = cr.get("positive", 0)
            neg_c = cr.get("negative", 0)
            pos_ratio = pos_c / total_c if total_c > 0 else 0.33
            neg_ratio = neg_c / total_c if total_c > 0 else 0.33

            for _ in range(n_points):
                # Random point near cluster center
                eco = max(-1.0, min(1.0, avg_eco + random.gauss(0, 0.15)))
                cost = max(-1.0, min(1.0, avg_cost + random.gauss(0, 0.15)))

                r = random.random()
                if r < pos_ratio:
                    sentiment = "positive"
                elif r < pos_ratio + neg_ratio:
                    sentiment = "negative"
                else:
                    sentiment = "neutral"

                points.append({
                    "personaId": f"synth-{cid}-{len(points)}",
                    "name": f"Persona {cid}",
                    "scoreEco": round(eco, 3),
                    "scoreCost": round(cost, 3),
                    "clusterId": cid,
                    "clusterName": cdata.get("name", cid),
                    "sentiment": sentiment,
                    "region": cdata.get("dominant_region", ""),
                    "generation": cdata.get("dominant_generation", ""),
                    "educationLevel": cdata.get("dominant_education", ""),
                })

    return points
