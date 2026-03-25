"""
News Fetcher — busca notícias de candidatos via Tavily API.
Reusa o padrão de scripts/arena_analysis/web_researcher.py.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from tavily import TavilyClient

from config import settings


@dataclass
class NewsItem:
    candidate_id: str
    headline: str
    content: str
    url: str
    score: float = 0.0


class NewsFetcher:
    def __init__(self):
        self._client = TavilyClient(api_key=settings.tavily_api_key)
        self._supabase = None

    def _get_supabase(self):
        if self._supabase is None:
            from supabase import create_client
            self._supabase = create_client(settings.supabase_url, settings.supabase_key)
        return self._supabase

    def fetch_for_candidate(self, candidate: dict) -> list[NewsItem]:
        """Busca notícias recentes para um candidato via Tavily."""
        name = candidate["name"]
        party = candidate["party"]

        queries = [
            f"{name} {party} notícias hoje",
            f"{name} eleição 2026 Brasil",
        ]

        seen_urls: set[str] = set()
        items: list[NewsItem] = []

        for query in queries:
            try:
                result = self._client.search(
                    query=query,
                    search_depth=settings.news_search_depth,
                    max_results=settings.max_news_per_candidate,
                    include_answer=False,
                    include_raw_content=False,
                    topic="news",
                )

                for r in result.get("results", []):
                    url = r.get("url", "")
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    items.append(NewsItem(
                        candidate_id=candidate["id"],
                        headline=r.get("title", "")[:200],
                        content=r.get("content", "")[:600],
                        url=url,
                        score=r.get("score", 0.0),
                    ))

            except Exception as e:
                print(f"[NewsFetcher] Erro buscando '{name}': {e}")

        # Ordenar por relevância e limitar
        items.sort(key=lambda x: x.score, reverse=True)
        return items[:settings.max_news_per_candidate]

    def fetch_all_candidates(self) -> list[NewsItem]:
        """Busca notícias para todos os candidatos ativos."""
        sb = self._get_supabase()
        candidates = sb.table("candidates").select("*").eq("is_active", True).execute()

        all_news: list[NewsItem] = []
        for candidate in candidates.data:
            news = self.fetch_for_candidate(candidate)
            # Dedup contra últimas 48h
            fresh = self._deduplicate(news, candidate["id"])
            all_news.extend(fresh)
            print(f"[NewsFetcher] {candidate['name']}: {len(news)} encontradas, {len(fresh)} novas")

        return all_news

    def _deduplicate(self, items: list[NewsItem], candidate_id: str) -> list[NewsItem]:
        """Remove notícias já processadas nas últimas 48h."""
        sb = self._get_supabase()
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=settings.dedup_hours)).isoformat()

        existing = sb.table("news_events") \
            .select("source_url") \
            .eq("candidate_id", candidate_id) \
            .gte("created_at", cutoff) \
            .execute()

        existing_urls = {r["source_url"] for r in existing.data if r.get("source_url")}

        return [item for item in items if item.url not in existing_urls]

    def fetch_candidate_discovery(self) -> list[str]:
        """Busca novos nomes de pré-candidatos na mídia."""
        try:
            result = self._client.search(
                query="pré-candidatos presidência 2026 Brasil nomes",
                search_depth="basic",
                max_results=5,
                include_answer=True,
                topic="news",
            )
            # Retorna o texto para o impact_analyzer extrair nomes
            snippets = [r.get("content", "") for r in result.get("results", [])]
            return snippets
        except Exception as e:
            print(f"[NewsFetcher] Erro buscando candidatos: {e}")
            return []
