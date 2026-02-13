"""
Agent 1: Web Researcher
Pesquisa na web via Tavily Search API para obter contexto atualizado.
So e ativado quando o QueryAnalyzer detecta necessidade.

Suporta dois modos:
  - research(): busca geral (noticias, eventos, dados)
  - research_person(): busca SEPARADA de biografia + noticias sobre uma pessoa
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from persona_chat.config import settings


@dataclass
class WebResearchResult:
    query: str = ""
    snippets: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    combined_context: str = ""
    # Campos para person search
    person_bio_context: str = ""
    person_news_context: str = ""
    person_name: str = ""


class WebResearcher:
    """Pesquisa na web e compila contexto para injecao no prompt."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            from tavily import TavilyClient
            self._client = TavilyClient(api_key=settings.tavily_api_key)
        return self._client

    async def _search_one(self, query: str) -> tuple[list[dict], str]:
        """Executa uma busca individual."""
        try:
            client = self._get_client()
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.search(
                    query=query,
                    search_depth="advanced",
                    max_results=settings.max_web_results,
                    include_answer=True,
                    include_raw_content=False,
                ),
            )
            return response.get("results", []), response.get("answer", "")
        except Exception as e:
            print(f"[WebResearcher] Erro na busca '{query}': {e}")
            return [], ""

    def _compile_results(
        self, search_results: list[tuple[list[dict], str]], max_chars: int = 1500
    ) -> tuple[str, list[str], list[str]]:
        """Compila resultados de busca em contexto, snippets e sources."""
        all_snippets: list[str] = []
        all_sources: list[str] = []
        seen_urls: set[str] = set()
        answers: list[str] = []

        for results, answer in search_results:
            if answer:
                answers.append(answer)
            for item in results:
                url = item.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                content = item.get("content", "")
                if content:
                    all_snippets.append(content[:500])
                    all_sources.append(url)

        snippets = all_snippets[:6]
        sources = all_sources[:6]

        parts = []
        if answers:
            parts.append("RESUMO: " + " ".join(answers)[:800])
        for i, snippet in enumerate(snippets[:4]):
            parts.append(f"[{i+1}] {snippet}")

        combined = "\n\n".join(parts)
        if len(combined) > max_chars:
            combined = combined[:max_chars] + "..."

        return combined, snippets, sources

    async def research(self, queries: list[str]) -> WebResearchResult:
        """
        Busca GERAL na web. Retorna contexto combinado.
        """
        if not settings.tavily_api_key:
            return WebResearchResult()

        tasks = [self._search_one(q) for q in queries[:3]]
        search_results = await asyncio.gather(*tasks)

        combined, snippets, sources = self._compile_results(search_results)

        return WebResearchResult(
            query=" | ".join(queries),
            snippets=snippets,
            sources=sources,
            combined_context=combined,
        )

    async def research_person(
        self,
        person_name: str,
        bio_queries: list[str],
        news_queries: list[str],
    ) -> WebResearchResult:
        """
        Busca SEPARADA sobre uma pessoa: biografia + noticias.
        Retorna dois contextos distintos para injecao no prompt.
        """
        if not settings.tavily_api_key:
            return WebResearchResult()

        # Executa TODAS as buscas em paralelo
        bio_tasks = [self._search_one(q) for q in bio_queries[:2]]
        news_tasks = [self._search_one(q) for q in news_queries[:2]]
        all_results = await asyncio.gather(*(bio_tasks + news_tasks))

        # Separa resultados
        bio_results = list(all_results[:len(bio_tasks)])
        news_results = list(all_results[len(bio_tasks):])

        # Compila separadamente
        bio_context, bio_snippets, bio_sources = self._compile_results(bio_results, max_chars=1200)
        news_context, news_snippets, news_sources = self._compile_results(news_results, max_chars=1200)

        # Contexto combinado (para validacao factual)
        all_snippets = bio_snippets + news_snippets
        all_sources = bio_sources + news_sources
        combined = ""
        if bio_context:
            combined += f"PERFIL DE {person_name.upper()}:\n{bio_context}\n\n"
        if news_context:
            combined += f"NOTICIAS RECENTES DE {person_name.upper()}:\n{news_context}"

        return WebResearchResult(
            query=" | ".join(bio_queries + news_queries),
            snippets=all_snippets,
            sources=all_sources,
            combined_context=combined,
            person_bio_context=bio_context,
            person_news_context=news_context,
            person_name=person_name,
        )
