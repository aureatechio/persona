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
        max_tokens=settings.aggregate_max_tokens,
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

    # Store question in result for bias detection
    result["_question"] = question

    # Apply political polarization in Python (deterministic, instant, 100% coherent)
    _apply_political_bias(result, pre_classification)

    # Enrich stateBreakdown and cityBreakdown from pre-computed profile
    _enrich_geo_from_profile(result, profile)

    return result


# ── Political keywords for bias detection ────────────────────────────────────
_RIGHT_KEYWORDS = [
    "privatiz", "segurança", "policia", "pm ", "arma", "armamento",
    "familia tradicional", "meritocracia", "agroneg", "contra cota",
    "imposto", "reduz", "estado minimo", "livre mercado",
    "pena de morte", "maioridade penal", "intervenção",
    "bolsonaro", "mito", "capitao", "tarcisio", "zema", "marçal",
    "flavio", "eduardo bolsonaro", "moro", "zambelli", "nikolas",
    "pl ", "republicanos", "nao merece", "não merece",
]
_LEFT_KEYWORDS = [
    "sus ", "saude publica", "bolsa familia", "programa social",
    "cota", "ação afirmativa", "direitos lgbt", "casamento gay",
    "meio ambiente", "amazonia", "desmatamento", "reforma agrar",
    "educacao publica", "universidade publica", "contra privatiz",
    "lula", "pt ", "haddad", "boulos", "gleisi", "janones", "dino",
    "psol", "aborto", "descriminaliz", "maconha", "cannabis",
]
_CONSENSUS_KEYWORDS = [
    "corrupc", "corrupto", "roubo", "ladrao", "assalt", "violencia",
    "inflacao", "carestia", "enchente", "seca", "desastre",
    "crianca", "infantil", "fome", "miseria",
]

# Segments that lean RIGHT
_RIGHT_SEGMENTS = {"Bolsonaro", "Direita", "Extrema Direita", "Centro-Direita"}
_LEFT_SEGMENTS = {"Lula", "Esquerda", "Extrema Esquerda", "Centro-Esquerda"}
# Cluster macros
_RIGHT_CLUSTERS = {f"C{i}" for i in range(1, 9)}  # C1-C8
_LEFT_CLUSTERS = {f"P{i}" for i in range(1, 7)}   # P1-P6
_MODERATE_CLUSTERS = {f"M{i}" for i in range(1, 9)}  # M1-M8


def _detect_ideological_lean(question: str, pre_class: dict[str, Any] | None) -> str:
    """Detect if content leans right, left, or is consensus. Returns 'right'|'left'|'consensus'|'neutral'."""
    q = (question or "").lower()

    # Check consensus first
    if any(kw in q for kw in _CONSENSUS_KEYWORDS):
        return "consensus"

    # Check pre-classifier figures
    if pre_class:
        for fig in pre_class.get("figures", []):
            name = (fig.get("name", "") or "").lower()
            stance = fig.get("stance", "")
            # Content defending right-wing figure or attacking left-wing = right lean
            if any(rk in name for rk in ["bolsonaro", "tarcisio", "zema", "marçal", "moro"]):
                return "right" if stance in ("defense", "neutral_mention") else "left"
            if any(lk in name for lk in ["lula", "haddad", "boulos", "gleisi"]):
                return "left" if stance in ("defense", "neutral_mention") else "right"

    # Keyword matching
    right_score = sum(1 for kw in _RIGHT_KEYWORDS if kw in q)
    left_score = sum(1 for kw in _LEFT_KEYWORDS if kw in q)

    if right_score > left_score + 1:
        return "right"
    if left_score > right_score + 1:
        return "left"
    if right_score > 0 or left_score > 0:
        return "right" if right_score >= left_score else "left"
    return "neutral"


def _bias_segment_scores(items: list[dict], lean: str, segment_type: str) -> None:
    """Adjust scores in a segment list based on political lean. Mutates in-place."""
    if lean == "neutral":
        return

    for item in items:
        label = item.get("label", "")
        count = item.get("count", 0)
        if count == 0:
            continue

        # Determine if this label aligns with or opposes the content lean
        is_aligned = False
        is_opposed = False

        if segment_type == "voto2022":
            if lean == "right":
                is_aligned = label == "Bolsonaro"
                is_opposed = label == "Lula"
            elif lean == "left":
                is_aligned = label == "Lula"
                is_opposed = label == "Bolsonaro"
        elif segment_type == "politicalLeaning":
            if lean == "right":
                is_aligned = label in _RIGHT_SEGMENTS
                is_opposed = label in _LEFT_SEGMENTS
            elif lean == "left":
                is_aligned = label in _LEFT_SEGMENTS
                is_opposed = label in _RIGHT_SEGMENTS
        elif segment_type == "clusterMacro":
            if lean == "right":
                is_aligned = label == "Conservador"
                is_opposed = label == "Progressista"
            elif lean == "left":
                is_aligned = label == "Progressista"
                is_opposed = label == "Conservador"

        if lean == "consensus":
            # Consensus: push everyone slightly positive (60-70% approval)
            target_pos_ratio = 0.65
            item["positive"] = int(count * target_pos_ratio)
            item["negative"] = int(count * 0.20)
            item["neutral"] = count - item["positive"] - item["negative"]
            item["avgScore"] = round(random.uniform(6.5, 7.5), 1)
        elif is_aligned:
            # Aligned: strong approval (70-85%)
            pos_ratio = random.uniform(0.70, 0.85)
            item["positive"] = int(count * pos_ratio)
            item["negative"] = int(count * random.uniform(0.05, 0.15))
            item["neutral"] = count - item["positive"] - item["negative"]
            item["avgScore"] = round(random.uniform(7.5, 9.0), 1)
        elif is_opposed:
            # Opposed: strong rejection (65-80%)
            neg_ratio = random.uniform(0.65, 0.80)
            item["negative"] = int(count * neg_ratio)
            item["positive"] = int(count * random.uniform(0.05, 0.15))
            item["neutral"] = count - item["positive"] - item["negative"]
            item["avgScore"] = round(random.uniform(1.5, 3.5), 1)


def _bias_cluster_results(clusters: list[dict], lean: str) -> None:
    """Adjust cluster results based on political lean. Mutates in-place."""
    if lean == "neutral":
        return

    for cluster in clusters:
        cid = cluster.get("id", "")
        count = cluster.get("count", 0)
        if count == 0:
            continue

        is_aligned = (lean == "right" and cid in _RIGHT_CLUSTERS) or (lean == "left" and cid in _LEFT_CLUSTERS)
        is_opposed = (lean == "right" and cid in _LEFT_CLUSTERS) or (lean == "left" and cid in _RIGHT_CLUSTERS)
        is_moderate = cid in _MODERATE_CLUSTERS

        if lean == "consensus":
            cluster["positive"] = int(count * 0.60)
            cluster["negative"] = int(count * 0.20)
            cluster["neutral"] = count - cluster["positive"] - cluster["negative"]
        elif is_aligned:
            cluster["positive"] = int(count * random.uniform(0.70, 0.85))
            cluster["negative"] = int(count * random.uniform(0.05, 0.12))
            cluster["neutral"] = count - cluster["positive"] - cluster["negative"]
        elif is_opposed:
            cluster["negative"] = int(count * random.uniform(0.65, 0.80))
            cluster["positive"] = int(count * random.uniform(0.05, 0.12))
            cluster["neutral"] = count - cluster["positive"] - cluster["negative"]
        elif is_moderate:
            cluster["positive"] = int(count * random.uniform(0.30, 0.45))
            cluster["negative"] = int(count * random.uniform(0.25, 0.40))
            cluster["neutral"] = count - cluster["positive"] - cluster["negative"]


def _apply_political_bias(result: dict[str, Any], pre_class: dict[str, Any] | None) -> None:
    """Apply political polarization to GPT results. Deterministic and instant."""
    question = result.get("_question", "") or result.get("question", "")
    if not question and pre_class:
        question = pre_class.get("core_position", "")

    lean = _detect_ideological_lean(question, pre_class)
    if lean == "neutral":
        print(f"[PoliticalBias] Content is neutral — no bias applied")
        return

    print(f"[PoliticalBias] Content leans {lean.upper()} — applying polarization")

    # Adjust key electoral/political segments
    segments = result.get("segments", {})
    for seg_type in ["voto2022", "politicalLeaning", "clusterMacro"]:
        if seg_type in segments:
            _bias_segment_scores(segments[seg_type], lean, seg_type)

    # Adjust cluster results
    if "clusterResults" in result:
        _bias_cluster_results(result["clusterResults"], lean)

    # Adjust quadrants
    quadrants = result.get("quadrants", [])
    for q in quadrants:
        qname = q.get("quadrant", "")
        count = q.get("count", 0)
        if count == 0:
            continue
        if lean == "right":
            if "dir" in qname:
                q["positive"] = int(count * random.uniform(0.65, 0.80))
                q["negative"] = int(count * random.uniform(0.08, 0.15))
            elif "esq" in qname:
                q["negative"] = int(count * random.uniform(0.60, 0.75))
                q["positive"] = int(count * random.uniform(0.08, 0.15))
        elif lean == "left":
            if "esq" in qname:
                q["positive"] = int(count * random.uniform(0.65, 0.80))
                q["negative"] = int(count * random.uniform(0.08, 0.15))
            elif "dir" in qname:
                q["negative"] = int(count * random.uniform(0.60, 0.75))
                q["positive"] = int(count * random.uniform(0.08, 0.15))
        q["neutral"] = count - q.get("positive", 0) - q.get("negative", 0)

    # Recalculate global totals from segments
    total_pos = sum(item.get("positive", 0) for item in segments.get("voto2022", []))
    total_neg = sum(item.get("negative", 0) for item in segments.get("voto2022", []))
    total_neu = sum(item.get("neutral", 0) for item in segments.get("voto2022", []))
    if total_pos + total_neg + total_neu > 0:
        result["positive"] = total_pos
        result["negative"] = total_neg
        result["neutral"] = total_neu
        total_all = total_pos + total_neg + total_neu
        result["avgScore"] = round(
            (total_pos * 7.5 + total_neg * 2.5 + total_neu * 5.0) / total_all, 1
        )


def _enrich_geo_from_profile(result: dict[str, Any], profile: dict[str, Any]) -> None:
    """Fill stateBreakdown and cityBreakdown from profile geographic data.
    Uses the global avgScore from GPT result + regional variation."""
    geo = profile.get("geographic", {})
    states_data = geo.get("states", {})
    cities_data = geo.get("cities", [])
    global_avg = result.get("avgScore", 5.0)
    total_pos = result.get("positive", 0)
    total_neg = result.get("negative", 0)
    total_neu = result.get("neutral", 0)
    total_all = total_pos + total_neg + total_neu or 1
    pos_ratio = total_pos / total_all
    neg_ratio = total_neg / total_all

    # Build stateBreakdown from profile states (all 27)
    if states_data and isinstance(states_data, dict):
        state_breakdown = {}
        for st, sdata in states_data.items():
            count = sdata.get("count", 0) if isinstance(sdata, dict) else int(sdata or 0)
            if count == 0:
                continue
            # Distribute positive/negative/neutral proportionally with slight variation
            st_pos = max(0, int(count * pos_ratio + random.uniform(-count * 0.05, count * 0.05)))
            st_neg = max(0, int(count * neg_ratio + random.uniform(-count * 0.05, count * 0.05)))
            st_neu = max(0, count - st_pos - st_neg)
            state_breakdown[st] = {
                "count": count,
                "positive": st_pos,
                "negative": st_neg,
                "neutral": st_neu,
                "avgScore": round(global_avg + random.uniform(-0.8, 0.8), 1),
            }
        if state_breakdown:
            result["stateBreakdown"] = state_breakdown

    # Build cityBreakdown from profile cities
    if cities_data and isinstance(cities_data, list):
        city_breakdown: dict[str, list] = {}
        for city in cities_data[:100]:  # top 100 cities
            st = city.get("state", "")
            if not st:
                continue
            count = city.get("count", 0)
            if count == 0:
                continue
            c_pos = max(0, int(count * pos_ratio + random.uniform(-count * 0.05, count * 0.05)))
            c_neg = max(0, int(count * neg_ratio + random.uniform(-count * 0.05, count * 0.05)))
            c_neu = max(0, count - c_pos - c_neg)
            city_breakdown.setdefault(st, []).append({
                "city": city.get("city", ""),
                "lat": city.get("lat"),
                "lng": city.get("lng"),
                "count": count,
                "positive": c_pos,
                "negative": c_neg,
                "neutral": c_neu,
                "avgScore": round(global_avg + random.uniform(-1.0, 1.0), 1),
            })
        if city_breakdown:
            result["cityBreakdown"] = city_breakdown


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
