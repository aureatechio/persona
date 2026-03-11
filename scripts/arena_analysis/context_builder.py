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


CONTEXT_BUILDER_PROMPT = """Você cria FICHAS DE CONTEXTUALIZAÇÃO para um sistema de pesquisa social.

A pergunta será enviada a 2000 personas brasileiras. Seu contexto serve para que elas saibam:
1. DE QUEM ou DO QUE se trata
2. POR QUE essa pergunta está sendo feita (o fato, escândalo, polêmica)

Sem isso, a persona não consegue opinar com propriedade.

REGRAS:
1. MÁXIMO 3-5 frases. Seja conciso mas COMPLETO.
2. Identifique: QUEM é + QUAL cargo + O QUE FEZ/ACONTECEU que gerou a pergunta
3. Seja FACTUAL e NEUTRO — descreva os fatos sem julgamento
4. NUNCA diga se é culpado ou inocente — só o que é público (investigação, acusação, denúncia)
5. NUNCA omita o MOTIVO da polêmica — sem ele a persona não entende a pergunta
6. Se a pergunta é sobre punição/prisão → OBRIGATÓRIO explicar DO QUE a pessoa é acusada
7. Se a pergunta já é autoexplicativa (temas genéricos) → contexto mínimo

EXEMPLOS:
- "Lula deve ser preso?" → contexto: "Luiz Inácio Lula da Silva, presidente do Brasil (PT, esquerda). Foi condenado na Lava-Jato por corrupção e lavagem de dinheiro, preso em 2018, solto em 2019 após decisão do STF. Condenações foram anuladas por questão de foro."
- "Daniel Vorcara deve ser preso?" → contexto: "Daniel Vorcaro, presidente do Banco Master. O banco é alvo de investigações por operações financeiras suspeitas, emissão irregular de CDBs e possíveis fraudes contábeis. O caso ganhou repercussão após revelações sobre o tamanho da exposição do FGC."
- "Brizola foi bom?" → contexto: "Leonel Brizola (1922-2004), político de esquerda (PDT), governador do RJ e RS. Conhecido pelos CIEPs (escolas de tempo integral) e por posições nacionalistas."
- "Aborto deveria ser legalizado?" → contexto mínimo: não precisa explicar o que é aborto.

JSON válido:
{
  "tema": "Título curto",
  "contexto": "3-5 frases factuais. QUEM É + O QUE FEZ/ACONTECEU.",
  "figuras": [{"nome": "Nome", "cargo": "Cargo", "relevancia": "posição política ou papel no caso"}],
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
