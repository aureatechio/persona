"""
Query Analyzer — IA decide se a pergunta precisa de pesquisa web.

Perguntas sobre figuras públicas, notícias, eventos → PESQUISAR
Perguntas genéricas de opinião → PULAR
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

import anthropic

from arena_analysis.config import settings

ANALYZER_PROMPT = """Você é um analisador de perguntas. Sua tarefa é decidir se uma pergunta
precisa de PESQUISA WEB para ser respondida por personas sintéticas brasileiras.

PRECISA DE PESQUISA (retorne "research": true):
- Menciona figuras públicas (políticos, celebridades, empresários)
- Referencia eventos ou notícias específicas
- Menciona organizações, partidos, empresas específicas
- Contém nomes próprios que precisam de contexto
- Fala sobre leis, projetos, políticas públicas específicas

NÃO PRECISA DE PESQUISA (retorne "research": false):
- Perguntas genéricas de opinião ("aborto deveria ser legalizado?")
- Perguntas sobre costumes e valores ("casamento gay é certo?")
- Perguntas hipotéticas ou filosóficas ("velhos devem morrer?")
- Perguntas sobre preferências ("coca ou pepsi?")
- Perguntas que qualquer brasileiro entende sem contexto adicional

Responda APENAS com JSON:
{"research": true/false, "reason": "motivo em 1 frase"}"""


@dataclass
class AnalyzerResult:
    needs_research: bool
    reason: str


class QueryAnalyzer:
    def __init__(self):
        self._claude = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def analyze(self, question: str) -> AnalyzerResult:
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._claude.messages.create(
                    model=settings.model,
                    max_tokens=150,
                    system=ANALYZER_PROMPT,
                    messages=[{"role": "user", "content": question}],
                    temperature=0,
                ),
            )
            text = next(
                (b.text for b in response.content if b.type == "text"), "{}"
            )
            data = json.loads(text)
            return AnalyzerResult(
                needs_research=data.get("research", True),
                reason=data.get("reason", ""),
            )
        except Exception as e:
            print(f"[QueryAnalyzer] Error, defaulting to research: {e}")
            return AnalyzerResult(needs_research=True, reason="fallback")
