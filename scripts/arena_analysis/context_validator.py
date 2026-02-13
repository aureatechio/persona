"""
Context Validator — verifica se o contexto gerado é correto e suficiente.

Exemplos de o que verifica:
- "Brizola foi bom?" → contexto menciona Leonel Brizola? Não confundiu com outra pessoa?
- "Lula deve ser preso?" → Lula é identificado como Luiz Inácio? Datas conferem?
- Contexto é suficiente para uma persona opinar?
- Não tem viés ou distorção da pergunta original?
"""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass

import anthropic

from arena_analysis.config import settings
from arena_analysis.context_builder import ContextResult


@dataclass
class ValidationResult:
    verdict: str = "PASS"  # "PASS" ou "REVISE"
    issues: list[str] = None
    corrections: str = ""
    prompt_tokens: int = 0
    output_tokens: int = 0

    def __post_init__(self):
        if self.issues is None:
            self.issues = []


VALIDATOR_PROMPT = """Você é um VALIDADOR DE CONTEXTO para um sistema de pesquisa social brasileira.

Sua função: verificar se o contexto gerado para uma pergunta está CORRETO e SUFICIENTE antes de ser apresentado a 2000 personas sintéticas.

VERIFIQUE:
1. IDENTIDADE: As pessoas/figuras mencionadas estão identificadas corretamente?
   - "Brizola" = Leonel Brizola (político gaúcho, PDT)? Ou confundiu com outra pessoa?
   - "Lula" = Luiz Inácio Lula da Silva (presidente, PT)?
   - Se for um nome ambíguo, a identificação está correta?

2. FATOS: As datas, cargos, eventos e dados estão corretos?
   - Compare com os DADOS DA WEB fornecidos
   - Se algo não bate, aponte

3. SUFICIÊNCIA: O contexto é suficiente para uma persona brasileira opinar?
   - Uma persona de 20 anos saberia opinar com esse contexto?
   - Uma persona de 70 anos com ensino fundamental tem info suficiente?

4. NEUTRALIDADE: O contexto NÃO distorce a pergunta?
   - Não está tendencioso para nenhum lado?
   - Não omite informação relevante que mudaria a opinião?

Responda APENAS com JSON:
{
  "verdict": "PASS" ou "REVISE",
  "issues": ["lista de problemas encontrados, vazia se PASS"],
  "corrections": "Instruções detalhadas de o que corrigir, vazio se PASS"
}"""


class ContextValidator:
    """Valida o contexto gerado antes de enviar para o loop de personas."""

    def __init__(self):
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def validate(
        self,
        question: str,
        context: ContextResult,
        web_context: str,
    ) -> ValidationResult:
        """
        Valida se o contexto está correto.

        Returns:
            ValidationResult com verdict PASS ou REVISE
        """
        result = ValidationResult()

        # Monta o contexto para validação
        context_text = (
            f"TEMA: {context.tema}\n"
            f"CONTEXTO: {context.contexto}\n"
            f"FIGURAS: {json.dumps(context.figuras, ensure_ascii=False)}\n"
            f"PERÍODO: {context.periodo}"
        )

        user_prompt = (
            f'PERGUNTA ORIGINAL: "{question}"\n\n'
            f"CONTEXTO GERADO:\n{context_text}\n\n"
        )

        if web_context:
            user_prompt += f"DADOS DA WEB (referência para verificação):\n{web_context}\n\n"

        user_prompt += "Valide o contexto e responda em JSON."

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.messages.create(
                    model=settings.model,
                    max_tokens=800,
                    system=VALIDATOR_PROMPT,
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
            if raw.startswith("```"):
                raw = re.sub(r"^```json?\n?", "", raw)
                raw = re.sub(r"\n?```$", "", raw)

            parsed = json.loads(raw)
            result.verdict = parsed.get("verdict", "PASS")
            result.issues = parsed.get("issues", [])
            result.corrections = parsed.get("corrections", "")

            if result.verdict == "REVISE":
                print(f"[ContextValidator] REVISE: {result.issues}")
            else:
                print("[ContextValidator] PASS — contexto validado.")

        except json.JSONDecodeError:
            print("[ContextValidator] Erro parsing JSON — assumindo PASS")
            result.verdict = "PASS"
        except Exception as e:
            print(f"[ContextValidator] Erro (assumindo PASS): {e}")
            result.verdict = "PASS"

        return result
