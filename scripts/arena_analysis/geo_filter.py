"""
Filtragem geográfica de personas com expansão por proximidade.
Se a cidade selecionada tem <min_personas, expande para cidades vizinhas
usando distância Haversine até atingir o mínimo.
"""
from __future__ import annotations

import math
from typing import Any, Optional


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distância em km entre dois pontos (lat/lng em graus)."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def apply_geo_filter(
    personas: list[dict[str, Any]],
    geo_filter: Any,
) -> tuple[list[dict[str, Any]], list[dict]]:
    """
    Filtra personas por localização geográfica.

    Retorna: (personas_filtradas, geo_cities)
    geo_cities = [{"city": str, "state": str, "lat": float, "lng": float, "personaCount": int}]
    """
    min_p = geo_filter.min_personas or 50

    # CASO 1: Só estado (sem cidade) → filtra todas do UF
    if geo_filter.state and not geo_filter.city:
        filtered = [p for p in personas if p.get("state") == geo_filter.state]
        if not filtered:
            # Estado sem personas — fallback para todas
            return personas, _group_by_city(personas)
        return filtered, _group_by_city(filtered)

    # CASO 2: Cidade específica → filtra e expande por proximidade se necessário
    if geo_filter.city and geo_filter.state:
        # Personas da cidade exata
        city_personas = [
            p
            for p in personas
            if p.get("city") == geo_filter.city
            and p.get("state") == geo_filter.state
        ]

        if len(city_personas) >= min_p:
            return city_personas, _group_by_city(city_personas)

        # Precisa expandir — calcular centro da cidade alvo
        target_lat, target_lng = _get_city_center(
            city_personas, geo_filter.city, geo_filter.state, personas
        )

        if target_lat is None:
            # Cidade sem coordenadas — fallback para estado inteiro
            filtered = [p for p in personas if p.get("state") == geo_filter.state]
            return filtered, _group_by_city(filtered)

        # Agrupar TODAS as personas do estado por cidade com distância ao alvo
        state_personas = [p for p in personas if p.get("state") == geo_filter.state]
        city_groups: dict[str, dict] = {}

        for p in state_personas:
            c = p.get("city", "Desconhecida")
            if c not in city_groups:
                lat = _safe_float(p.get("lat"))
                lng = _safe_float(p.get("lng"))
                dist = (
                    haversine_km(target_lat, target_lng, lat, lng)
                    if lat and lng
                    else 9999.0
                )
                city_groups[c] = {
                    "personas": [],
                    "lat": lat,
                    "lng": lng,
                    "dist": dist,
                }
            city_groups[c]["personas"].append(p)

        # Ordenar por distância (cidade alvo = dist 0) e incluir até atingir min_p
        sorted_cities = sorted(city_groups.items(), key=lambda x: x[1]["dist"])

        result_personas: list[dict] = []
        result_cities: list[dict] = []
        for city_name, data in sorted_cities:
            result_personas.extend(data["personas"])
            result_cities.append(
                {
                    "city": city_name,
                    "state": geo_filter.state,
                    "lat": data["lat"],
                    "lng": data["lng"],
                    "personaCount": len(data["personas"]),
                }
            )
            if len(result_personas) >= min_p:
                break

        # Edge case: estado inteiro tem <min_p → retorna tudo que tem
        return result_personas, result_cities

    # CASO 3: Sem filtro → todas as personas
    return personas, []


def _get_city_center(
    city_personas: list[dict],
    city_name: str,
    state: str,
    all_personas: list[dict],
) -> tuple[Optional[float], Optional[float]]:
    """Obtém lat/lng da cidade a partir das personas."""
    # Tentar das personas já filtradas
    for p in city_personas:
        lat = _safe_float(p.get("lat"))
        lng = _safe_float(p.get("lng"))
        if lat is not None and lng is not None:
            return lat, lng
    # Fallback: qualquer persona do banco com essa cidade/estado
    for p in all_personas:
        if p.get("city") == city_name and p.get("state") == state:
            lat = _safe_float(p.get("lat"))
            lng = _safe_float(p.get("lng"))
            if lat is not None and lng is not None:
                return lat, lng
    return None, None


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _group_by_city(personas: list[dict]) -> list[dict]:
    """Agrupa personas por cidade retornando lista de GeoCity dicts."""
    groups: dict[str, dict] = {}
    for p in personas:
        c = p.get("city", "Desconhecida")
        if c not in groups:
            groups[c] = {
                "state": p.get("state", ""),
                "lat": _safe_float(p.get("lat")),
                "lng": _safe_float(p.get("lng")),
                "count": 0,
            }
        groups[c]["count"] += 1
    return [
        {
            "city": k,
            "state": v["state"],
            "lat": v["lat"],
            "lng": v["lng"],
            "personaCount": v["count"],
        }
        for k, v in groups.items()
    ]
