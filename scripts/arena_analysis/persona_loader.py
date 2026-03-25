"""
Carrega personas do Supabase com cache em memoria.
"""
from __future__ import annotations

import time
from typing import Any

from arena_analysis.config import settings

# Cache global
_persona_cache: list[dict[str, Any]] = []
_cache_timestamp: float = 0.0

# Supabase client singleton
_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client

        _supabase_client = create_client(settings.supabase_url, settings.supabase_key)
    return _supabase_client


# Campos necessarios para o loop de personas
PERSONA_FIELDS = ",".join([
    "id", "name", "age", "city", "state", "lat", "lng", "gender", "gender_identity",
    "education_level", "generation", "political_leaning",
    "macro_religion", "archetype_primary",
    "cluster_id", "nome_grupo", "score_economico", "score_costumes",
    "social_class", "area_type", "region_br", "civil_status",
    "apelido_politico", "cronotype",
    "voto_2022", "aprovacao_lula", "voto_2026", "raca_cor",
    "q_avaliacao_bolsonaro",
    "career_json", "demographic_json", "psychology_json", "beliefs_json",
])


def _enrich_with_sentiments(sb, personas: list[dict[str, Any]]) -> None:
    """Enriquece personas com sentimentos vivos da tabela persona_sentiments."""
    try:
        # Carregar todos os sentimentos de uma vez (mais eficiente que JOIN)
        all_sentiments: list[dict] = []
        offset = 0
        batch_size = 1000
        while True:
            resp = (
                sb.table("persona_sentiments")
                .select("persona_id,candidate_id,sentiment")
                .range(offset, offset + batch_size - 1)
                .execute()
            )
            if resp.data:
                all_sentiments.extend(resp.data)
                if len(resp.data) < batch_size:
                    break
                offset += batch_size
            else:
                break

        if not all_sentiments:
            print("[PersonaLoader] Nenhum sentimento vivo encontrado (tabela vazia)")
            return

        # Agrupar por persona_id
        sentiment_map: dict[str, dict[str, float]] = {}
        for s in all_sentiments:
            pid = s["persona_id"]
            if pid not in sentiment_map:
                sentiment_map[pid] = {}
            sentiment_map[pid][s["candidate_id"]] = float(s["sentiment"] or 0)

        # Enriquecer personas
        enriched = 0
        for p in personas:
            sents = sentiment_map.get(p["id"])
            if sents:
                p["sentiments"] = sents
                enriched += 1

        print(f"[PersonaLoader] {enriched}/{len(personas)} personas com sentimentos vivos")

    except Exception as e:
        print(f"[PersonaLoader] Sentimentos não disponíveis (tabela pode não existir): {e}")


def load_personas(cluster_filter: str | None = None) -> list[dict[str, Any]]:
    """
    Carrega todas as personas do Supabase.
    Usa cache em memoria com TTL configuravel.
    """
    global _persona_cache, _cache_timestamp

    now = time.time()
    cache_valid = (
        len(_persona_cache) > 0
        and (now - _cache_timestamp) < settings.persona_cache_ttl
    )

    if not cache_valid:
        print("[PersonaLoader] Carregando personas do Supabase...")
        sb = _get_supabase()
        all_data: list[dict] = []
        batch_size = 1000

        # Carrega em batches de 1000 (limite do Supabase)
        offset = 0
        while True:
            resp = (
                sb.table("personas")
                .select(PERSONA_FIELDS)
                .range(offset, offset + batch_size - 1)
                .execute()
            )
            if resp.data:
                all_data.extend(resp.data)
                if len(resp.data) < batch_size:
                    break
                offset += batch_size
            else:
                break

        # Carregar sentimentos vivos (persona_sentiments)
        _enrich_with_sentiments(sb, all_data)

        _persona_cache = all_data
        _cache_timestamp = now
        print(f"[PersonaLoader] {len(_persona_cache)} personas carregadas e cacheadas.")

    # Filtra por cluster se necessario
    if cluster_filter:
        return [p for p in _persona_cache if p.get("cluster_id") == cluster_filter]

    return list(_persona_cache)
