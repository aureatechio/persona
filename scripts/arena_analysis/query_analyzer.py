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

⚠️ REGRA #1 — NOMES PRÓPRIOS: Se a pergunta contém QUALQUER nome próprio de pessoa, empresa, lugar específico ou evento → research: TRUE. SEMPRE.
Não importa se a pergunta começa com "na minha opinião", "eu acho que", "vocês acham que" — se tem um NOME que nem todo brasileiro conhece, PRECISA de contexto.

Exemplos com nome próprio → SEMPRE true:
- "Na minha opinião, o Vorcaro deveria estar preso" → TRUE (quem é Vorcaro?)
- "Eu acho que o Pablo Marçal é um gênio" → TRUE (quem é Pablo Marçal?)
- "Lula deveria renunciar" → TRUE (precisa identificar: presidente, PT, esquerda)
- "O que vocês acham do caso Banco Master?" → TRUE (o que aconteceu?)
- "Daniel Vorcaro merece cadeia" → TRUE (quem é e do que é acusado?)

PRECISA DE CONTEXTO (research: true):
- Nomes próprios de QUALQUER pessoa (político, empresário, celebridade, influencer)
- Eventos recentes/específicos (escândalos, acidentes, casos judiciais)
- Figuras públicas que precisam de identificação
- Siglas ou termos técnicos pouco conhecidos
- Empresas ou instituições que nem todos conhecem

NÃO PRECISA DE CONTEXTO (research: false):
- Perguntas 100% genéricas SEM nenhum nome próprio
- "Aborto deveria ser legalizado?" → todo mundo sabe o que é
- "Maconha deveria ser liberada?" → todos entendem
- "Pena de morte é justa?" → conceito universal
- Qualquer pergunta sobre conceitos universais SEM menção a pessoas/eventos

IMPORTANTE: Na dúvida, responda TRUE. É mais seguro contextualizar do que deixar as personas sem saber de quem/do que se trata.

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
                model=settings.smart_model,
                max_tokens=200,
                system=ANALYZER_PROMPT,
                messages=[{"role": "user", "content": question}],
                temperature=0,
            )
            text = next(
                (b.text for b in response.content if b.type == "text"), "{}"
            ).strip()

            # Limpar markdown fences se houver
            if text.startswith("```"):
                import re
                text = re.sub(r"^```json?\n?", "", text)
                text = re.sub(r"\n?```$", "", text)
                text = text.strip()

            # Tentar extrair JSON de dentro do texto
            if not text.startswith("{"):
                start = text.find("{")
                if start >= 0:
                    text = text[start:]
                    end = text.rfind("}") + 1
                    if end > 0:
                        text = text[:end]

            data = json.loads(text)
            needs = data.get("research", False)
            reason = data.get("reason", "")
            print(f"[QueryAnalyzer] research={needs} | {reason}")
            return AnalyzerResult(needs_research=needs, reason=reason)
        except Exception as e:
            print(f"[QueryAnalyzer] Error ({e}), defaulting to YES research (safe fallback)")
            # Fallback para YES — é mais seguro pesquisar do que não pesquisar
            return AnalyzerResult(needs_research=True, reason="error fallback - defaulting to research")
