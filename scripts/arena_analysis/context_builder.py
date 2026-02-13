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


CONTEXT_BUILDER_PROMPT = """Você é um CONTEXTUALIZADOR para um sistema de pesquisa social brasileira.

Sua função: receber uma PERGUNTA que será apresentada a 2000 personas brasileiras sintéticas, e criar um CONTEXTO FACTUAL que EMBASA a pergunta para que cada persona tenha informação suficiente para opinar.

REGRAS CRÍTICAS:
1. NÃO distorça a pergunta — apenas EMBASA com dados reais
2. Se houver pessoas/figuras mencionadas, explique QUEM SÃO com dados verificáveis
3. Forneça contexto histórico E atual relevante
4. Seja FACTUAL — sem opinião, sem viés, sem julgamento
5. Escreva de forma que qualquer brasileiro entenda
6. Se for uma figura histórica (ex: Brizola), explique quem foi E por que é relevante
7. Se for um tema atual, forneça dados recentes
8. SEMPRE inclua o cargo/função das pessoas mencionadas

Responda APENAS com JSON válido no formato:
{
  "tema": "Título do tema em 1 linha",
  "contexto": "2-4 parágrafos com dados reais, factuais, sem opinião. Inclua: quem são as pessoas mencionadas, contexto histórico, situação atual, dados relevantes.",
  "figuras": [{"nome": "Nome Completo", "cargo": "Cargo/função", "relevancia": "Por que é mencionado"}],
  "periodo": "Quando isso é/foi relevante (ex: 2023-presente, anos 1960-80)"
}"""


class ContextBuilder:
    """Cria contexto estruturado a partir da pergunta + dados da web."""

    def __init__(self):
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

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
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.messages.create(
                    model=settings.model,
                    max_tokens=1500,
                    system=CONTEXT_BUILDER_PROMPT,
                    messages=[{"role": "user", "content": user_prompt}],
                    temperature=0.0,
                ),
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
