"""
Polling Fetcher — busca pesquisas eleitorais reais (Datafolha, Quaest, IPEC).
Usa Tavily + Claude Haiku para extrair números de pesquisas.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import anthropic
from tavily import TavilyClient

from config import settings


POLLING_EXTRACTOR_PROMPT = """Extraia dados de pesquisas eleitorais do texto abaixo.

Procure por pesquisas de institutos como Datafolha, Quaest, IPEC, AtlasIntel, Ipespe, Paraná Pesquisas.

Para CADA pesquisa encontrada, retorne:
{
  "polls": [
    {
      "source": "Nome do Instituto",
      "scenario": "1turno ou 2turno",
      "results": {"candidato_id": porcentagem},
      "date": "YYYY-MM-DD (aproximado)"
    }
  ]
}

Use IDs de candidato: lula, flavio (para Flávio Bolsonaro), ratinho (para Ratinho Jr.), caiado, tarcisio, marçal, etc.
Se não encontrar pesquisas com números específicos, retorne: {"polls": []}
Apenas pesquisas de 2025-2026. Ignore pesquisas antigas."""


class PollingFetcher:
    def __init__(self):
        self._tavily = TavilyClient(api_key=settings.tavily_api_key)
        self._claude = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self._supabase = None

    def _get_supabase(self):
        if self._supabase is None:
            from supabase import create_client
            self._supabase = create_client(settings.supabase_url, settings.supabase_key)
        return self._supabase

    def fetch_real_polls(self) -> list[dict]:
        """Busca pesquisas eleitorais reais e salva em polling_anchors."""
        # 1. Buscar no Tavily
        queries = [
            "pesquisa eleitoral presidência 2026 Datafolha Quaest IPEC porcentagem",
            "pesquisa intenção de voto presidente 2026 Brasil resultado",
        ]

        all_content = []
        for query in queries:
            try:
                result = self._tavily.search(
                    query=query,
                    search_depth="basic",
                    max_results=5,
                    include_answer=True,
                    topic="news",
                )
                for r in result.get("results", []):
                    all_content.append(r.get("content", ""))
                if result.get("answer"):
                    all_content.append(result["answer"])
            except Exception as e:
                print(f"[PollingFetcher] Tavily error: {e}")

        if not all_content:
            print("[PollingFetcher] Nenhum conteúdo encontrado")
            return []

        # 2. Claude Haiku extrai números
        combined = "\n---\n".join(all_content[:5])

        try:
            response = self._claude.messages.create(
                model=settings.impact_model,
                max_tokens=600,
                system=POLLING_EXTRACTOR_PROMPT,
                messages=[{"role": "user", "content": combined[:3000]}],
                temperature=0.0,
            )

            text = next((b.text for b in response.content if b.type == "text"), "")
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]

            data = json.loads(text)
            polls = data.get("polls", [])

        except Exception as e:
            print(f"[PollingFetcher] Claude error: {e}")
            return []

        # 3. Salvar em polling_anchors (dedup por source + date)
        sb = self._get_supabase()
        saved = []

        for poll in polls:
            if not poll.get("results") or not poll.get("source"):
                continue

            # Dedup: não salvar se já tem pesquisa deste instituto nesta data
            poll_date = poll.get("date", datetime.now(timezone.utc).date().isoformat())
            existing = sb.table("polling_anchors") \
                .select("id") \
                .eq("source", poll["source"]) \
                .eq("poll_date", poll_date) \
                .execute()

            if existing.data:
                continue

            row = {
                "source": poll["source"],
                "poll_date": poll_date,
                "scenario": poll.get("scenario", "1turno"),
                "results": poll["results"],
                "fetched_by": "auto",
            }

            sb.table("polling_anchors").insert(row).execute()
            saved.append(row)
            print(f"[PollingFetcher] Salva: {poll['source']} {poll_date} — {poll['results']}")

        return saved

    def get_latest_anchor(self, scenario: str = "1turno") -> dict | None:
        """Retorna a pesquisa mais recente como âncora."""
        sb = self._get_supabase()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()

        result = sb.table("polling_anchors") \
            .select("*") \
            .eq("scenario", scenario) \
            .gte("poll_date", cutoff) \
            .order("poll_date", desc=True) \
            .limit(1) \
            .execute()

        return result.data[0] if result.data else None
