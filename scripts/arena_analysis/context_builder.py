"""
Context Builder — IA cria contexto estruturado a partir da pergunta + dados web.

Objetivo: embasar a pergunta com dados reais SEM distorcer.
Exemplo: "Lula deveria estar preso?"
  → TEMA: Possibilidade de prisão do presidente Lula
  → CONTEXTO: Luiz Inácio Lula da Silva, presidente do Brasil...
  → FIGURAS: Lula (presidente, PT)
"""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field

import anthropic

from arena_analysis.config import settings


@dataclass
class ContextResult:
    tema: str = ""
    contexto: str = ""
    figuras: list[dict] = field(default_factory=list)
    periodo: str = ""
    raw_text: str = ""
    prompt_tokens: int = 0
    output_tokens: int = 0


CONTEXT_BUILDER_PROMPT = """Você cria FICHAS DE IDENTIFICAÇÃO curtas para um sistema de pesquisa social.

A pergunta será enviada a 2000 personas brasileiras. Seu contexto serve APENAS para que elas saibam DE QUEM ou DO QUE se trata. NADA MAIS.

REGRAS ABSOLUTAS:
1. MÁXIMO 2-3 frases no contexto. Seja TELEGRÁFICO.
2. Só identifique: QUEM é, QUAL cargo, QUAL partido/posição política
3. NUNCA adicione análise, história detalhada, opinião ou julgamento
4. NUNCA adicione informação que possa influenciar a resposta
5. O objetivo é que a persona saiba se a figura é de esquerda/direita, qual cargo tem — só isso
6. Se a pergunta já é clara, o contexto deve ser MÍNIMO

EXEMPLOS:
- "Lula deve ser preso?" → contexto: "Luiz Inácio Lula da Silva, presidente do Brasil (PT, esquerda)."
- "Daniel Vorcara deve ser preso?" → contexto: "Daniel Vorcaro, presidente do Banco Master, investigado por suposta corrupção."
- "Brizola foi bom?" → contexto: "Leonel Brizola (1922-2004), político de esquerda, governador do RJ e RS."

JSON válido:
{
  "tema": "Título curto",
  "contexto": "1-3 frases MÁXIMO. Só identificação.",
  "figuras": [{"nome": "Nome", "cargo": "Cargo", "relevancia": "posição política"}],
  "periodo": "período relevante"
}"""


class ContextBuilder:
    """Cria contexto estruturado a partir da pergunta + dados da web."""

    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def build(
        self,
        question: str,
        web_context: str,
        feedback: str | None = None,
    ) -> ContextResult:
        """
        Gera contexto factual para a pergunta.

        Args:
            question: pergunta do usuario
            web_context: dados da web (Tavily)
            feedback: feedback do validador (se houve REVISE)
        """
        result = ContextResult()

        user_prompt = f'PERGUNTA: "{question}"\n\n'

        if web_context:
            user_prompt += f"DADOS DA WEB (use como base factual):\n{web_context}\n\n"
        else:
            user_prompt += "DADOS DA WEB: Nenhum disponível. Use seu conhecimento geral.\n\n"

        if feedback:
            user_prompt += (
                f"ATENÇÃO — O contexto anterior foi REJEITADO pelo validador:\n"
                f"{feedback}\n\n"
                f"Corrija os problemas apontados e gere um novo contexto.\n\n"
            )

        user_prompt += "Gere o contexto factual em JSON."

        try:
            response = await self._client.messages.create(
                model=settings.smart_model,
                max_tokens=1500,
                system=CONTEXT_BUILDER_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=0.0,
            )

            result.prompt_tokens = response.usage.input_tokens
            result.output_tokens = response.usage.output_tokens

            text_block = next((b for b in response.content if b.type == "text"), None)
            if not text_block:
                return result

            raw = text_block.text.strip()
            result.raw_text = raw

            # Limpa markdown se presente
            if raw.startswith("```"):
                raw = re.sub(r"^```json?\n?", "", raw)
                raw = re.sub(r"\n?```$", "", raw)

            parsed = json.loads(raw)
            result.tema = parsed.get("tema", "")
            result.contexto = parsed.get("contexto", "")
            result.figuras = parsed.get("figuras", [])
            result.periodo = parsed.get("periodo", "")

            print(f"[ContextBuilder] Tema: {result.tema}")
            print(f"[ContextBuilder] Figuras: {[f.get('nome', '') for f in result.figuras]}")

        except json.JSONDecodeError as e:
            print(f"[ContextBuilder] Erro parsing JSON: {e}")
            # Fallback: usa o texto raw como contexto
            result.contexto = raw if raw else question
            result.tema = question[:100]
        except Exception as e:
            print(f"[ContextBuilder] Erro: {e}")
            result.contexto = f"Pergunta: {question}"
            result.tema = question[:100]

        return result
