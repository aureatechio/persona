"""
Web Researcher — busca contexto na web via Tavily Search.
SEMPRE roda para toda pergunta, sem condicional.

Gera queries a partir da pergunta e compila resultados.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from arena_analysis.config import settings


@dataclass
class WebResearchResult:
    queries: list[str] = field(default_factory=list)
    snippets: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    combined_context: str = ""


class ArenaWebResearcher:
    """Pesquisa na web para gerar contexto sobre a pergunta."""

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
                    topic="news",
                ),
            )
            return response.get("results", []), response.get("answer", "")
        except Exception as e:
            print(f"[WebResearcher] Erro na busca '{query}': {e}")
            return [], ""

    def _generate_queries(self, question: str) -> list[str]:
        """
        Gera queries de busca a partir da pergunta.
        Sempre gera 2-3 queries para cobrir o tema.
        Todas em português para priorizar resultados em PT-BR.
        """
        # Query 1: a pergunta como esta (mais direta)
        q1 = question.strip().rstrip("?").strip()

        # Query 2: adiciona "Brasil" para resultados em PT-BR
        q2 = f"{q1} Brasil notícias"

        # Query 3: busca por noticias atuais
        from datetime import datetime

        year = datetime.now().year
        q3 = f"{q1} últimas notícias {year} Brasil"

        return [q1, q2, q3]

    def _compile_results(
        self,
        search_results: list[tuple[list[dict], str]],
        max_chars: int = 3000,
    ) -> tuple[str, list[str], list[str]]:
        """Compila resultados em contexto unico."""
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
                    all_snippets.append(content[:600])
                    all_sources.append(url)

        snippets = all_snippets[:8]
        sources = all_sources[:8]

        parts = []
        if answers:
            # Tavily answers may come in English — prefix with instruction for downstream consumers
            combined_answer = " ".join(answers)[:1200]
            parts.append("RESUMO: " + combined_answer)
        for i, snippet in enumerate(snippets[:6]):
            parts.append(f"[{i + 1}] {snippet}")

        combined = "\n\n".join(parts)
        if len(combined) > max_chars:
            combined = combined[:max_chars] + "..."

        return combined, snippets, sources

    async def research(self, question: str) -> WebResearchResult:
        """
        Pesquisa na web sobre a pergunta.
        SEMPRE roda — gera queries automaticamente e compila resultados.
        """
        if not settings.tavily_api_key:
            print("[WebResearcher] TAVILY_API_KEY nao configurada. Continuando sem web data.")
            return WebResearchResult()

        queries = self._generate_queries(question)
        print(f"[WebResearcher] Buscando: {queries}")

        tasks = [self._search_one(q) for q in queries]
        search_results = await asyncio.gather(*tasks)

        combined, snippets, sources = self._compile_results(list(search_results))

        result = WebResearchResult(
            queries=queries,
            snippets=snippets,
            sources=sources,
            combined_context=combined,
        )

        print(
            f"[WebResearcher] {len(snippets)} snippets, "
            f"{len(combined)} chars de contexto."
        )
        return result
