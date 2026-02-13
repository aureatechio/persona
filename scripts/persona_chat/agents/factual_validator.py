"""
Agent: Factual Validator
Valida se os FATOS mencionados na resposta estao corretos
comparando com os dados retornados pela web search.

Exemplo:
  Pergunta: "quem é o prefeito de Salvador?"
  Web search: "Bruno Reis é o prefeito de Salvador desde 2021"
  Resposta gerada: "o prefeito daqui e acm neto ne"
  → REVISE: "O prefeito atual de Salvador é Bruno Reis, não ACM Neto"

Diferente do PersonaValidator que checa coerencia de PERSONA,
este checa coerencia de FATOS.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Literal

import anthropic

from persona_chat.config import settings


@dataclass
class FactualValidationResult:
    verdict: Literal["PASS", "REVISE"] = "PASS"
    factual_errors: list[str] = field(default_factory=list)
    corrections: str = ""
    prompt_tokens: int = 0
    output_tokens: int = 0


def _build_factual_prompt(
    user_message: str,
    generated_response: str,
    web_context: str,
    persona_city: str,
    persona_state: str,
) -> str:
    """Prompt para validacao factual contra dados da web."""
    from datetime import datetime
    now = datetime.now()
    data_atual = now.strftime("%d/%m/%Y")
    ano_atual = now.year
    mes_atual = now.strftime("%B")

    return f"""Voce e um VERIFICADOR DE FATOS RIGOROSO. Sua funcao e comparar uma resposta
gerada com dados reais da internet e verificar se TODOS os fatos estao corretos.

IMPORTANTE: Voce NAO verifica tom, linguagem ou estilo. Voce SOMENTE verifica se
informacoes factuais (nomes, datas, cargos, partidos, eventos, numeros, REFERENCIAS
TEMPORAIS) estao corretas.

## DATA ATUAL: {data_atual} (ano {ano_atual})
Use esta data para validar QUALQUER referencia temporal na resposta.

## CONTEXTO GEOGRAFICO
Cidade: {persona_city}
Estado: {persona_state}

## PERGUNTA DO USUARIO
"{user_message}"

## DADOS REAIS DA INTERNET (fonte confiavel)
{web_context}

## RESPOSTA GERADA (a ser verificada)
"{generated_response}"

## INSTRUCOES DE VERIFICACAO

1. Extraia TODOS os fatos mencionados na resposta:
   - Nomes de pessoas e seus cargos
   - Datas, anos, periodos
   - Partidos politicos
   - Eventos e acontecimentos
   - Numeros e estatisticas
   - REFERENCIAS TEMPORAIS ("esse ano", "ano passado", "recentemente", "acabou de", etc.)

2. Compare cada fato com os dados da internet acima

3. VERIFICACAO TEMPORAL CRITICA:
   - Estamos em {data_atual}. O ano atual e {ano_atual}.
   - Se a resposta diz "esse ano" ou "este ano", o evento DEVE ter acontecido em {ano_atual}.
   - Se aconteceu em {ano_atual - 1}, o correto e "ano passado", NAO "esse ano".
   - Se a resposta diz "entrou esse ano" mas a posse foi em {ano_atual - 1}, isso e ERRO.
   - Eleicoes municipais no Brasil foram em outubro de 2024, posses em janeiro de 2025.
   - Se alguem tomou posse em janeiro de 2025, em {data_atual} isso foi "ano passado", nao "esse ano".

4. Se a resposta diz "nao sei" ou "nao acompanho" = NAO e erro factual (resposta valida)
5. Se a resposta so da opiniao sem fatos = NAO e erro factual

RESPONDA EXATAMENTE NESTE FORMATO JSON:

{{
  "verdict": "PASS" ou "REVISE",
  "factual_errors": ["lista de erros factuais encontrados, incluindo erros temporais"],
  "corrections": "informacoes corretas para substituir os erros. Inclua datas corretas. Ex: 'Silvio Barros tomou posse em janeiro de 2025, nao em 2026. O correto e dizer que ele entrou ANO PASSADO, nao esse ano.'"
}}

Se tudo estiver correto, retorne {{"verdict": "PASS", "factual_errors": [], "corrections": ""}}.

SEJA EXTREMAMENTE RIGOROSO com:
- Nomes errados de politicos
- Cargos trocados
- Partidos errados
- Datas e referencias temporais erradas (esse ano vs ano passado)
- Fatos inventados que nao aparecem nos dados da internet"""


class FactualValidator:
    """Valida precisao factual da resposta contra dados da web search."""

    def __init__(self):
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def validate(
        self,
        user_message: str,
        generated_response: str,
        web_context: str,
        persona_city: str = "",
        persona_state: str = "",
    ) -> FactualValidationResult:
        """
        Compara fatos da resposta com dados da web.

        Returns:
            FactualValidationResult com verdict PASS/REVISE
        """
        if not web_context or not web_context.strip():
            # Sem dados da web, nao tem como validar fatos
            return FactualValidationResult(verdict="PASS")

        prompt = _build_factual_prompt(
            user_message=user_message,
            generated_response=generated_response,
            web_context=web_context,
            persona_city=persona_city,
            persona_state=persona_state,
        )

        try:
            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.messages.create(
                    model=settings.validator_model,
                    max_tokens=400,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0,
                ),
            )

            raw_text = ""
            for block in response.content:
                if block.type == "text":
                    raw_text += block.text

            result = FactualValidationResult(
                prompt_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
            )

            try:
                json_start = raw_text.find("{")
                json_end = raw_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    parsed = json.loads(raw_text[json_start:json_end])
                    result.verdict = parsed.get("verdict", "PASS")
                    result.factual_errors = parsed.get("factual_errors", [])
                    result.corrections = parsed.get("corrections", "")
                else:
                    result.verdict = "PASS"
            except json.JSONDecodeError:
                result.verdict = "PASS"

            return result

        except Exception as e:
            print(f"[FactualValidator] Erro na validacao: {e}")
            return FactualValidationResult(verdict="PASS")
