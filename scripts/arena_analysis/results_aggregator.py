"""
Results Aggregator — agrega dados REAIS do loop de personas
no formato esperado pelo frontend (EnhancedSimulationResult).

Todos os dados vêm das respostas reais da IA, não de fórmulas.
"""
from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from arena_analysis.persona_loop import PersonaResult


# 24 clusters com seus macros
CLUSTER_MACROS = {
    "P1": "Progressista", "P2": "Progressista", "P3": "Progressista",
    "P4": "Progressista", "P5": "Progressista", "P6": "Progressista",
    "M1": "Moderado", "M2": "Moderado", "M3": "Moderado", "M4": "Moderado",
    "M5": "Moderado", "M6": "Moderado", "M7": "Moderado", "M8": "Moderado",
    "C1": "Conservador", "C2": "Conservador", "C3": "Conservador",
    "C4": "Conservador", "C5": "Conservador", "C6": "Conservador",
    "C7": "Conservador", "C8": "Conservador",
    "T1": "Transversal", "T2": "Transversal",
}

CLUSTER_NAMES = {
    "P1": "Base Social", "P2": "Trabalhista", "P3": "Progressista Urbano",
    "P4": "Regulador Técnico", "P5": "Desenvolvimentista", "P6": "Centro-Esquerda Moderada",
    "M1": "Centro Econômico", "M2": "Centro Conservador", "M3": "Institucional",
    "M4": "Gestor Pragmático", "M5": "Volátil Econômico", "M6": "Empreendedor Urbano",
    "M7": "Classe Média Sensível", "M8": "Cético Político",
    "C1": "Liberal de Mercado", "C2": "Conservador Religioso", "C3": "Nacionalista",
    "C4": "Linha Dura Segurança", "C5": "Antissistema", "C6": "Pequeno Empresário",
    "C7": "Direita Digital", "C8": "Conservador Tradicional",
    "T1": "Desengajado", "T2": "Anti-Incumbente",
}

# 10 archetypes (matching frontend)
ARCHETYPE_IDS = [
    "traditionalist", "activist", "analyst", "moderate", "entrepreneur",
    "pragmatist", "idealist", "skeptic", "religious", "youth",
]

QUADRANT_LABELS = {
    "esq_progressista": "Esquerda + Progressista",
    "esq_conservador": "Esquerda + Conservador",
    "dir_conservador": "Direita + Conservador",
    "dir_progressista": "Direita + Progressista",
}

EDUCATION_ORDER = [
    "Fundamental incompleto", "Fundamental completo",
    "Médio incompleto", "Médio completo",
    "Superior Incompleto", "Superior Completo",
    "Pós-Graduação/MBA", "Mestrado/Doutorado",
]

INTENSITY_BANDS = [
    {"label": "Fraco (0-0.2)", "range": [0.0, 0.2]},
    {"label": "Moderado (0.2-0.5)", "range": [0.2, 0.5]},
    {"label": "Forte (0.5-0.7)", "range": [0.5, 0.7]},
    {"label": "Extremo (0.7-1.0)", "range": [0.7, 1.0]},
]


def _classify_quadrant(score_eco: float, score_cost: float) -> str:
    if score_eco <= 0 and score_cost <= 0:
        return "esq_progressista"
    if score_eco <= 0 and score_cost > 0:
        return "esq_conservador"
    if score_eco > 0 and score_cost > 0:
        return "dir_conservador"
    return "dir_progressista"


def _sentiment_score(s: str) -> int:
    if s == "positive":
        return 1
    if s == "negative":
        return -1
    return 0


def aggregate_results(
    personas: list[dict[str, Any]],
    results: list[PersonaResult],
    question: str,
) -> dict[str, Any]:
    """
    Agrega resultados REAIS do loop de personas no formato do dashboard.

    Retorna dict compativel com EnhancedSimulationResult do frontend.
    """
    # Mapeia persona_id → result
    result_map: dict[str, PersonaResult] = {}
    for r in results:
        result_map[r.persona_id] = r

    total = len(personas)
    total_positive = 0
    total_negative = 0
    total_neutral = 0

    # Aggregators
    cluster_data: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "positive": 0, "negative": 0, "neutral": 0}
    )
    quadrant_data: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "positive": 0, "negative": 0, "neutral": 0, "cluster_counts": defaultdict(int)}
    )
    region_data: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "positive": 0, "negative": 0, "neutral": 0}
    )
    generation_data: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "positive": 0, "negative": 0, "neutral": 0, "total_age": 0}
    )
    education_data: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "positive": 0, "negative": 0, "neutral": 0, "total_intensity": 0.0}
    )
    intensity_data = [
        {"label": b["label"], "range": b["range"], "count": 0, "total_score": 0}
        for b in INTENSITY_BANDS
    ]

    # Political figure counters
    political_support: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    political_attack: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    political_neutral: dict[str, int] = defaultdict(int)
    political_support_total: dict[str, int] = defaultdict(int)
    political_attack_total: dict[str, int] = defaultdict(int)

    # Scatter points
    ideological_points: list[dict] = []

    # Comments
    all_comments: list[dict] = []

    # Detect political figures in question
    norm_q = question.lower()
    detected_figures: list[str] = []
    if "lula" in norm_q or "pt " in norm_q or " pt" in norm_q or "petista" in norm_q:
        detected_figures.append("lula")
    if "bolsonaro" in norm_q or "mito" in norm_q or "capitao" in norm_q:
        detected_figures.append("bolsonaro")

    for persona in personas:
        pid = str(persona.get("id", persona.get("name", "")))
        result = result_map.get(pid)

        if not result:
            sentiment = "neutral"
            comment = ""
        else:
            sentiment = result.sentiment
            comment = result.comment

        # Totals
        if sentiment == "positive":
            total_positive += 1
        elif sentiment == "negative":
            total_negative += 1
        else:
            total_neutral += 1

        # Cluster
        cid = persona.get("cluster_id") or "unknown"
        cluster_data[cid]["count"] += 1
        cluster_data[cid][sentiment] += 1

        # Quadrant
        eco = float(persona.get("score_economico") or 0)
        cost = float(persona.get("score_costumes") or 0)
        quadrant = _classify_quadrant(eco, cost)
        quadrant_data[quadrant]["count"] += 1
        quadrant_data[quadrant][sentiment] += 1
        quadrant_data[quadrant]["cluster_counts"][cid] += 1

        # Region
        region = persona.get("region_br") or "Não informado"
        region_data[region]["count"] += 1
        region_data[region][sentiment] += 1

        # Generation
        gen = persona.get("generation") or "Não informado"
        generation_data[gen]["count"] += 1
        generation_data[gen][sentiment] += 1
        generation_data[gen]["total_age"] += int(persona.get("age") or 0)

        # Education
        edu = persona.get("education_level") or "Não informado"
        education_data[edu]["count"] += 1
        education_data[edu][sentiment] += 1
        education_data[edu]["total_intensity"] += (abs(eco) + abs(cost)) / 2

        # Intensity bands
        magnitude = (abs(eco) + abs(cost)) / 2
        sent_score = _sentiment_score(sentiment)
        for band in intensity_data:
            low, high = band["range"]
            if magnitude >= low and (magnitude < high or (band == intensity_data[-1] and magnitude >= low)):
                band["count"] += 1
                band["total_score"] += sent_score
                break

        # Political figures
        for figure in detected_figures:
            if figure == "lula":
                if eco < -0.3:
                    stance = "support"
                elif eco > 0.3:
                    stance = "attack"
                else:
                    stance = "neutral"
            else:  # bolsonaro
                if eco > 0.2 and cost > 0.5:
                    stance = "support"
                elif eco < -0.3 or cost < -0.3:
                    stance = "attack"
                else:
                    stance = "neutral"

            if stance == "support":
                political_support_total[figure] += 1
                political_support[figure][cid] += 1
            elif stance == "attack":
                political_attack_total[figure] += 1
                political_attack[figure][cid] += 1
            else:
                political_neutral[figure] += 1

        # Scatter point
        if persona.get("score_economico") is not None and persona.get("score_costumes") is not None:
            ideological_points.append({
                "personaId": pid,
                "name": persona.get("name", "Persona"),
                "scoreEco": eco,
                "scoreCost": cost,
                "clusterId": cid,
                "clusterName": persona.get("nome_grupo", "Desconhecido"),
                "sentiment": sentiment,
                "region": region,
                "generation": gen,
                "educationLevel": edu,
            })

        # Comment
        if comment:
            # Extract archetype
            archetype = persona.get("archetype_primary", "moderate")

            all_comments.append({
                "archetype": archetype,
                "sentiment": sentiment,
                "comment": comment,
                "personaName": persona.get("name", "Anônimo"),
                "age": persona.get("age", 0),
                "location": persona.get("state", ""),
                "state": persona.get("state", ""),
                "region": region,
                "generation": gen,
            })

    # ── Build final result ──

    # Cluster results
    cluster_results = []
    for cid, data in cluster_data.items():
        if data["count"] > 0:
            cluster_results.append({
                "id": cid or "unknown",
                "name": CLUSTER_NAMES.get(cid, cid) or "Desconhecido",
                "macro": CLUSTER_MACROS.get(cid, "Transversal") or "Transversal",
                "count": data["count"],
                "positive": data["positive"],
                "negative": data["negative"],
                "neutral": data["neutral"],
            })
    cluster_results.sort(key=lambda c: c["id"] or "")

    # Quadrant results
    quadrants = []
    for q, data in quadrant_data.items():
        if data["count"] > 0:
            sorted_clusters = sorted(
                data["cluster_counts"].items(), key=lambda x: x[1], reverse=True
            )[:3]
            quadrants.append({
                "quadrant": q,
                "label": QUADRANT_LABELS.get(q, q),
                "count": data["count"],
                "positive": data["positive"],
                "negative": data["negative"],
                "neutral": data["neutral"],
                "dominantClusters": [c[0] for c in sorted_clusters],
            })

    # Region results
    regions = [
        {"region": r, **data}
        for r, data in region_data.items()
        if data["count"] > 0
    ]
    regions.sort(key=lambda x: x["count"], reverse=True)

    # Generation results
    generations = []
    for gen, data in generation_data.items():
        if data["count"] > 0:
            generations.append({
                "generation": gen,
                "count": data["count"],
                "positive": data["positive"],
                "negative": data["negative"],
                "neutral": data["neutral"],
                "avgAge": round(data["total_age"] / data["count"]) if data["count"] else 0,
            })

    # Education results
    education_levels = []
    for edu, data in education_data.items():
        if data["count"] > 0:
            education_levels.append({
                "level": edu,
                "count": data["count"],
                "positive": data["positive"],
                "negative": data["negative"],
                "neutral": data["neutral"],
                "avgIntensity": data["total_intensity"] / data["count"] if data["count"] else 0,
            })
    # Sort by education order
    edu_order = {e: i for i, e in enumerate(EDUCATION_ORDER)}
    education_levels.sort(key=lambda x: edu_order.get(x["level"], 99))

    # Political figures
    political_figures = []
    for figure in detected_figures:
        top_support = sorted(
            political_support[figure].items(), key=lambda x: x[1], reverse=True
        )[:5]
        top_attack = sorted(
            political_attack[figure].items(), key=lambda x: x[1], reverse=True
        )[:5]
        political_figures.append({
            "figure": figure,
            "label": "Lula (PT)" if figure == "lula" else "Bolsonaro",
            "supportCount": political_support_total.get(figure, 0),
            "attackCount": political_attack_total.get(figure, 0),
            "neutralCount": political_neutral.get(figure, 0),
            "supportClusters": [c[0] for c in top_support],
            "attackClusters": [c[0] for c in top_attack],
        })

    # Intensity bands
    intensity_bands = []
    for band in intensity_data:
        intensity_bands.append({
            "label": band["label"],
            "range": band["range"],
            "count": band["count"],
            "avgSentimentScore": band["total_score"] / band["count"] if band["count"] else 0,
        })

    # Archetypes (aggregate from personas)
    archetype_data: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "positive": 0, "negative": 0, "neutral": 0}
    )
    for persona in personas:
        arch = persona.get("archetype_primary", "moderate")
        pid = str(persona.get("id", persona.get("name", "")))
        result = result_map.get(pid)
        sentiment = result.sentiment if result else "neutral"
        archetype_data[arch]["count"] += 1
        archetype_data[arch][sentiment] += 1

    archetypes = [
        {
            "id": arch,
            "name": arch,
            "count": data["count"],
            "positive": data["positive"],
            "negative": data["negative"],
            "neutral": data["neutral"],
        }
        for arch, data in archetype_data.items()
        if data["count"] > 0
    ]

    return {
        "total": total,
        "positive": total_positive,
        "negative": total_negative,
        "neutral": total_neutral,
        "archetypes": archetypes,
        "clusterResults": cluster_results,
        "comments": all_comments,
        "processingTime": 0,  # Set by main.py
        "ideologicalPoints": ideological_points,
        "quadrants": quadrants,
        "regions": regions,
        "generations": generations,
        "educationLevels": education_levels,
        "politicalFigures": political_figures,
        "intensityBands": intensity_bands,
    }
