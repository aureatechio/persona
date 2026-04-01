"""
Aggregate Builder — pre-computes a statistical profile of ~20k synthetic
personas and stores the result in the `arena_sentiment_profile` table.

Run standalone:
    python -m arena_analysis.aggregate_builder
"""
from __future__ import annotations

import asyncio
import random
from collections import Counter, defaultdict
from typing import Any

from arena_analysis.config import settings
from arena_analysis.persona_loader import load_personas
from arena_analysis.results_aggregator import CLUSTER_MACROS, CLUSTER_NAMES


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(value: Any, default: float = 0.0) -> float:
    """Safely convert a value to float."""
    try:
        return float(value) if value is not None else default
    except (ValueError, TypeError):
        return default


def _normalize_voto_2022(raw: str | None) -> str:
    """Normalize voto_2022 to Lula / Bolsonaro / Nulo/Outro."""
    if not raw:
        return "Nulo/Outro"
    low = raw.strip().lower()
    if "lula" in low or "pt" in low:
        return "Lula"
    if "bolsonaro" in low or "jair" in low:
        return "Bolsonaro"
    return "Nulo/Outro"


def _most_common(counter: Counter) -> str | None:
    """Return the most common element from a Counter, or None."""
    mc = counter.most_common(1)
    return mc[0][0] if mc else None


def _classify_quadrant(eco: float, cost: float) -> str:
    if eco <= 0 and cost <= 0:
        return "esq_progressista"
    if eco <= 0 and cost > 0:
        return "esq_conservador"
    if eco > 0 and cost > 0:
        return "dir_conservador"
    return "dir_progressista"


def _bucketize_eco(eco: float) -> str:
    if eco <= -0.5:
        return "Esquerda forte"
    if eco <= -0.1:
        return "Esquerda leve"
    if eco <= 0.1:
        return "Centro"
    if eco <= 0.5:
        return "Direita leve"
    return "Direita forte"


def _bucketize_cost(cost: float) -> str:
    if cost <= -0.5:
        return "Progressista forte"
    if cost <= -0.1:
        return "Progressista leve"
    if cost <= 0.1:
        return "Centro"
    if cost <= 0.5:
        return "Conservador leve"
    return "Conservador forte"


def _classify_opinion(value: str | None) -> str:
    """Classify a thematic opinion field into A favor / Contra / Outro."""
    if not value:
        return "Outro"
    low = value.strip().lower()
    if any(k in low for k in ["favor", "sim", "aprova", "apoia", "concorda", "bom", "funciona", "confia"]):
        return "A favor"
    if any(k in low for k in ["contra", "não", "nao", "reprova", "discorda", "ruim"]):
        return "Contra"
    return "Outro"


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _build_demographics(personas: list[dict[str, Any]]) -> dict[str, Any]:
    """Section 1: demographic distributions."""
    dimensions: dict[str, str] = {
        "gender": "gender",
        "religion": "macro_religion",
        "race": "raca_cor",
        "generation": "generation",
        "education": "education_level",
        "social_class": "social_class",
    }
    result: dict[str, dict[str, int]] = {}
    for dim_name, field_name in dimensions.items():
        counter: Counter[str] = Counter()
        for p in personas:
            val = p.get(field_name) or "Não informado"
            counter[str(val)] += 1
        result[dim_name] = dict(counter.most_common())
    return result


def _build_electoral(personas: list[dict[str, Any]]) -> dict[str, Any]:
    """Section 2: electoral distributions."""
    voto_2022: Counter[str] = Counter()
    aprovacao_lula: Counter[str] = Counter()
    voto_2026: Counter[str] = Counter()
    avaliacao_bolsonaro: Counter[str] = Counter()

    for p in personas:
        voto_2022[_normalize_voto_2022(p.get("voto_2022"))] += 1
        aprovacao_lula[str(p.get("aprovacao_lula") or "Não informado").strip()] += 1
        voto_2026[str(p.get("voto_2026") or "Não informado").strip()] += 1
        avaliacao_bolsonaro[str(p.get("q_avaliacao_bolsonaro") or "Não informado").strip()] += 1

    return {
        "voto_2022": dict(voto_2022.most_common()),
        "aprovacao_lula": dict(aprovacao_lula.most_common()),
        "voto_2026": dict(voto_2026.most_common()),
        "avaliacao_bolsonaro": dict(avaliacao_bolsonaro.most_common()),
    }


def _build_ideological(personas: list[dict[str, Any]]) -> dict[str, Any]:
    """Section 3: ideological histograms and quadrants."""
    eco_hist: Counter[str] = Counter()
    cost_hist: Counter[str] = Counter()
    leaning: Counter[str] = Counter()
    quadrants: Counter[str] = Counter()

    for p in personas:
        eco = _safe_float(p.get("score_economico"))
        cost = _safe_float(p.get("score_costumes"))

        eco_hist[_bucketize_eco(eco)] += 1
        cost_hist[_bucketize_cost(cost)] += 1
        leaning[str(p.get("political_leaning") or "Não informado")] += 1
        quadrants[_classify_quadrant(eco, cost)] += 1

    return {
        "score_economico": dict(eco_hist.most_common()),
        "score_costumes": dict(cost_hist.most_common()),
        "political_leaning": dict(leaning.most_common()),
        "quadrants": dict(quadrants.most_common()),
    }


def _build_clusters(personas: list[dict[str, Any]]) -> dict[str, Any]:
    """Section 4: per-cluster profiles and archetype distribution."""
    cluster_personas: dict[str, list[dict]] = defaultdict(list)
    archetype_counter: Counter[str] = Counter()

    for p in personas:
        cid = p.get("cluster_id") or "unknown"
        cluster_personas[cid].append(p)
        archetype_counter[str(p.get("archetype_primary") or "unknown")] += 1

    cluster_profiles: dict[str, dict[str, Any]] = {}
    for cid, members in cluster_personas.items():
        eco_values = [_safe_float(m.get("score_economico")) for m in members]
        cost_values = [_safe_float(m.get("score_costumes")) for m in members]
        region_counter: Counter[str] = Counter(
            str(m.get("region_br") or "Não informado") for m in members
        )
        gen_counter: Counter[str] = Counter(
            str(m.get("generation") or "Não informado") for m in members
        )
        edu_counter: Counter[str] = Counter(
            str(m.get("education_level") or "Não informado") for m in members
        )

        count = len(members)
        cluster_profiles[cid] = {
            "count": count,
            "avg_score_eco": round(sum(eco_values) / count, 4) if count else 0.0,
            "avg_score_cost": round(sum(cost_values) / count, 4) if count else 0.0,
            "dominant_region": _most_common(region_counter),
            "dominant_generation": _most_common(gen_counter),
            "dominant_education": _most_common(edu_counter),
            "macro": CLUSTER_MACROS.get(cid, "Outro"),
            "name": CLUSTER_NAMES.get(cid, cid),
        }

    return {
        "clusters": cluster_profiles,
        "archetypes": dict(archetype_counter.most_common()),
    }


def _build_thematic_opinions(personas: list[dict[str, Any]]) -> dict[str, Any]:
    """Section 5: thematic opinion distributions."""
    tema_fields = [
        "tema_aborto", "tema_armas", "tema_maconha",
        "tema_privatizacoes", "tema_cotas_raciais", "tema_casamento_gay",
    ]
    q_fields = [
        "q_pena_morte", "q_bolsa_familia_bom", "q_sus_funciona",
        "q_vacinas_confiar", "q_imposto_ricos", "q_direitos_lgbt",
        "q_intervencao_militar", "q_impeachment_lula",
    ]

    result: dict[str, dict[str, int]] = {}
    for field_name in tema_fields + q_fields:
        counter: Counter[str] = Counter()
        for p in personas:
            counter[_classify_opinion(p.get(field_name))] += 1
        result[field_name] = dict(counter.most_common())

    return result


def _build_geographic(personas: list[dict[str, Any]]) -> dict[str, Any]:
    """Section 6: per-state and top-100 city breakdown."""
    # Per state
    state_data: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"count": 0, "eco_sum": 0.0, "cost_sum": 0.0}
    )
    # Per city
    city_data: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"count": 0, "city": "", "state": "", "lat": None, "lng": None}
    )

    for p in personas:
        st = str(p.get("state") or "Não informado")
        eco = _safe_float(p.get("score_economico"))
        cost = _safe_float(p.get("score_costumes"))

        state_data[st]["count"] += 1
        state_data[st]["eco_sum"] += eco
        state_data[st]["cost_sum"] += cost

        city_name = str(p.get("city") or "Desconhecida")
        city_key = f"{st}|{city_name}"
        city_data[city_key]["count"] += 1
        city_data[city_key]["city"] = city_name
        city_data[city_key]["state"] = st
        if city_data[city_key]["lat"] is None:
            city_data[city_key]["lat"] = p.get("lat")
            city_data[city_key]["lng"] = p.get("lng")

    states: dict[str, dict[str, Any]] = {}
    for st, d in state_data.items():
        c = d["count"]
        states[st] = {
            "count": c,
            "avg_score_eco": round(d["eco_sum"] / c, 4) if c else 0.0,
            "avg_score_cost": round(d["cost_sum"] / c, 4) if c else 0.0,
        }

    # Top 100 cities by count
    sorted_cities = sorted(city_data.values(), key=lambda x: x["count"], reverse=True)[:100]
    cities = [
        {
            "city": cd["city"],
            "state": cd["state"],
            "count": cd["count"],
            "lat": cd["lat"],
            "lng": cd["lng"],
        }
        for cd in sorted_cities
    ]

    return {
        "states": states,
        "top_cities": cities,
    }


def _build_cross_tabulations(personas: list[dict[str, Any]]) -> dict[str, Any]:
    """Section 7: cross-tabulation matrices."""
    cluster_region: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    gen_leaning: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    voto_class: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for p in personas:
        cid = str(p.get("cluster_id") or "unknown")
        region = str(p.get("region_br") or "Não informado")
        gen = str(p.get("generation") or "Não informado")
        pol = str(p.get("political_leaning") or "Não informado")
        voto = _normalize_voto_2022(p.get("voto_2022"))
        sc = str(p.get("social_class") or "Outro")

        cluster_region[cid][region] += 1
        gen_leaning[gen][pol] += 1
        voto_class[voto][sc] += 1

    # Convert nested defaultdicts to plain dicts for JSON serialization
    return {
        "cluster_x_region": {k: dict(v) for k, v in cluster_region.items()},
        "generation_x_political_leaning": {k: dict(v) for k, v in gen_leaning.items()},
        "voto_2022_x_social_class": {k: dict(v) for k, v in voto_class.items()},
    }


def _build_persona_samples(personas: list[dict[str, Any]], target: int = 200) -> list[dict[str, Any]]:
    """Section 8: ~200 stratified representative persona samples."""
    sample_fields = [
        "name", "age", "city", "state", "region_br", "gender",
        "education_level", "generation", "social_class", "political_leaning",
        "cluster_id", "nome_grupo", "score_economico", "score_costumes",
        "voto_2022", "aprovacao_lula", "archetype_primary", "macro_religion",
        "raca_cor",
        # Thematic fields
        "tema_aborto", "tema_armas", "tema_privatizacoes",
        "tema_casamento_gay", "q_pena_morte",
    ]

    # Group by cluster
    by_cluster: dict[str, list[dict]] = defaultdict(list)
    for p in personas:
        cid = p.get("cluster_id") or "unknown"
        by_cluster[cid].append(p)

    n_clusters = len(by_cluster)
    per_cluster = max(target // max(n_clusters, 1), 1)

    samples: list[dict[str, Any]] = []
    for cid, members in by_cluster.items():
        # Aim for diversity: sort by (education, region, generation, gender) then sample evenly
        members_sorted = sorted(
            members,
            key=lambda m: (
                str(m.get("education_level") or ""),
                str(m.get("region_br") or ""),
                str(m.get("generation") or ""),
                str(m.get("gender") or ""),
            ),
        )

        # Take evenly spaced samples
        count = min(per_cluster, len(members_sorted))
        if len(members_sorted) <= count:
            chosen = members_sorted
        else:
            step = len(members_sorted) / count
            chosen = [members_sorted[int(i * step)] for i in range(count)]

        for p in chosen:
            sample = {k: p.get(k) for k in sample_fields}
            samples.append(sample)

    # Shuffle to avoid cluster-ordered output
    random.shuffle(samples)
    return samples[:target]


# ---------------------------------------------------------------------------
# Main functions
# ---------------------------------------------------------------------------

async def build_aggregate_profile() -> dict[str, Any]:
    """
    Build the full aggregate profile from all personas.

    Returns the complete profile dict ready to be saved.
    """
    print("[AggregateBuilder] Loading personas...")
    personas = load_personas()
    print(f"[AggregateBuilder] {len(personas)} personas loaded. Computing profile...")

    demographics = _build_demographics(personas)
    electoral = _build_electoral(personas)
    ideological = _build_ideological(personas)
    clusters = _build_clusters(personas)
    thematic_opinions = _build_thematic_opinions(personas)
    geographic = _build_geographic(personas)
    cross_tabulations = _build_cross_tabulations(personas)
    persona_samples = _build_persona_samples(personas)

    profile: dict[str, Any] = {
        "id": "default",
        "total_personas": len(personas),
        "demographics": demographics,
        "electoral": electoral,
        "ideological": ideological,
        "clusters": clusters,
        "thematic_opinions": thematic_opinions,
        "geographic": geographic,
        "cross_tabulations": cross_tabulations,
        "persona_samples": persona_samples,
    }

    print("[AggregateBuilder] Profile computed successfully.")
    return profile


async def save_profile(profile: dict[str, Any]) -> None:
    """Save the profile to the arena_sentiment_profile table via upsert."""
    from supabase import create_client

    sb = create_client(settings.supabase_url, settings.supabase_key)

    row = {
        "id": profile["id"],
        "total_personas": profile["total_personas"],
        "demographics": profile["demographics"],
        "electoral": profile["electoral"],
        "ideological": profile["ideological"],
        "clusters": profile["clusters"],
        "thematic_opinions": profile["thematic_opinions"],
        "geographic": profile["geographic"],
        "cross_tabulations": profile["cross_tabulations"],
        "persona_samples": profile["persona_samples"],
    }

    resp = sb.table("arena_sentiment_profile").upsert(row).execute()
    print(f"[AggregateBuilder] Saved to arena_sentiment_profile (id='{profile['id']}').")
    return resp


async def main() -> None:
    """Entry point for standalone execution."""
    profile = await build_aggregate_profile()
    await save_profile(profile)
    print("[AggregateBuilder] Done.")


if __name__ == "__main__":
    asyncio.run(main())
