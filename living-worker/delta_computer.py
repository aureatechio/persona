"""
Delta Computer — calcula deltas de sentimento de forma DETERMINÍSTICA (sem IA).
Converte a análise de impacto do Claude Haiku em valores numéricos auditáveis.
"""
from __future__ import annotations

import random

from config import settings
from impact_analyzer import ImpactResult, SegmentImpact, CrossEffect


def compute_segment_delta(
    news_magnitude: float,
    segment: SegmentImpact,
) -> float:
    """
    Calcula o delta base para um segmento (cluster macro).

    Formula:
    delta = magnitude × sensibilidade × MAX_SINGLE_DELTA × direção × ruído

    O multiplicador_campos é aplicado no db_updater por persona individual.
    Aqui calculamos o delta BASE que será ajustado por persona.
    """
    base = news_magnitude * segment.sensitivity * settings.max_single_delta

    # Direção
    sign = 1.0 if segment.direction == "positive" else -1.0

    # Ruído ±10% para evitar uniformidade mecânica
    noise = 1.0 + random.uniform(-0.1, 0.1)

    delta = base * sign * noise

    # Clamp ao máximo
    return max(-settings.max_single_delta, min(settings.max_single_delta, delta))


def compute_cross_delta(cross: CrossEffect) -> float:
    """
    Calcula delta para efeito cruzado (impacto em OUTRO candidato).
    Cross effects são sempre menores que o efeito direto.
    """
    base = cross.magnitude * settings.max_single_delta * 0.5  # metade do máximo

    sign = 1.0 if cross.direction == "positive" else -1.0
    noise = 1.0 + random.uniform(-0.1, 0.1)

    delta = base * sign * noise
    return max(-settings.max_single_delta * 0.5, min(settings.max_single_delta * 0.5, delta))


def compute_calibration_delta(
    our_percent: float,
    real_percent: float,
) -> float:
    """
    Calcula delta de correção baseado em pesquisa real.

    Aplica correção suave (×0.3) para convergir em ~3 dias.
    """
    error = real_percent - our_percent

    if abs(error) <= settings.polling_error_threshold:
        return 0.0  # dentro da margem

    # Correção suave
    correction = error * settings.polling_correction_factor / 100.0  # converter % para escala -1 a +1

    # Clamp
    return max(-settings.max_single_delta, min(settings.max_single_delta, correction))


def field_match_multiplier(
    persona_fields: dict,
    sensitivity_fields: list[str],
) -> float:
    """
    Calcula multiplicador baseado em quantos sensitivity_fields
    a persona tem opinião forte.

    0 matches = 0.5x (metade do impacto)
    all matches = 2.0x (dobro do impacto)
    """
    if not sensitivity_fields:
        return 1.0

    matches = 0
    for field_name in sensitivity_fields:
        value = persona_fields.get(field_name)
        if value and str(value).strip() not in ("", "Não respondeu", "None", "null"):
            matches += 1

    ratio = matches / len(sensitivity_fields)
    return 0.5 + (ratio * 1.5)
