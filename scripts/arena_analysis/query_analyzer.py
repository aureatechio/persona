"""
Query Analyzer — IA decide se a pergunta precisa de contexto adicional.

REGRA DE OURO: o contexto existe APENAS para identificar pessoas/eventos
que a persona precisa conhecer para opinar. NUNCA para influenciar a resposta.

Sem contexto: "todos os idosos devem morrer" → qualquer brasileiro entende
Com contexto: "Daniel Vorcara deve ser preso" → precisa saber quem é Daniel Vorcara
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

import anthropic

from arena_analysis.config import settings

ANALYZER_PROMPT = """Você analisa perguntas que serão enviadas a 2000 personas brasileiras sintéticas.

Sua ÚNICA tarefa: decidir se a pergunta precisa de CONTEXTO ADICIONAL para as personas entenderem DO QUE SE TRATA.

PRECISA DE CONTEXTO (research: true):
- Nomes próprios que NEM TODO brasileiro conhece ("Daniel Vorcara deve ser preso?" → quem é?)
- Eventos recentes/específicos ("o escândalo do Banco Master" → o que aconteceu?)
- Figuras públicas que precisam de identificação ("Lula deve ser preso?" → precisa saber que é presidente, PT, esquerda)
- Siglas ou termos técnicos pouco conhecidos

NÃO PRECISA DE CONTEXTO (research: false):
- Perguntas que qualquer brasileiro entende sem explicação
- "Todos os idosos devem morrer?" → óbvio, não precisa contexto
- "Aborto deveria ser legalizado?" → todo mundo sabe o que é
- "Casamento gay é certo?" → tema conhecido
- "Homens são melhores que mulheres?" → autoexplicativo
- "Maconha deveria ser liberada?" → todos entendem
- Qualquer pergunta sobre conceitos universais (morte, violência, moral, preferências)

IMPORTANTE: Na dúvida, responda FALSE. Contexto desnecessário PIORA os resultados.

JSON apenas:
{"research": true/false, "reason": "1 frase curta"}"""


@dataclass
class AnalyzerResult:
    needs_research: bool
    reason: str


class QueryAnalyzer:
    def __init__(self):
        self._claude = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def analyze(self, question: str) -> AnalyzerResult:
        try:
            response = await self._claude.messages.create(
                model=settings.model,
                max_tokens=100,
                system=ANALYZER_PROMPT,
                messages=[{"role": "user", "content": question}],
                temperature=0,
            )
            text = next(
                (b.text for b in response.content if b.type == "text"), "{}"
            )
            data = json.loads(text)
            needs = data.get("research", False)
            reason = data.get("reason", "")
            print(f"[QueryAnalyzer] research={needs} | {reason}")
            return AnalyzerResult(needs_research=needs, reason=reason)
        except Exception as e:
            print(f"[QueryAnalyzer] Error, defaulting to NO research: {e}")
            return AnalyzerResult(needs_research=False, reason="error fallback")
