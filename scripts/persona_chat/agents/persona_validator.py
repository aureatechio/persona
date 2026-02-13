"""
Agent 3: Persona Validator
Valida se a resposta gerada e coerente com o perfil da persona.
Usa Claude Haiku 4.5 para validacao rapida (~500ms).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Literal

import anthropic

from persona_chat.config import settings
from persona_chat.prompts.validator_prompt import build_validator_prompt


@dataclass
class ValidationResult:
    verdict: Literal["PASS", "REVISE", "BLOCK"] = "PASS"
    issues: list[str] = field(default_factory=list)
    suggestions: str = ""
    prompt_tokens: int = 0
    output_tokens: int = 0


class PersonaValidator:
    """Valida coerencia da resposta com o perfil da persona."""

    def __init__(self):
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def validate(
        self,
        persona: dict[str, Any],
        user_message: str,
        generated_response: str,
    ) -> ValidationResult:
        """
        Valida a resposta gerada.

        Returns:
            ValidationResult com verdict PASS/REVISE/BLOCK
        """
        prompt = build_validator_prompt(persona, user_message, generated_response)

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

            # Parse JSON da resposta
            result = ValidationResult(
                prompt_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
            )

            try:
                # Tenta extrair JSON do texto
                json_start = raw_text.find("{")
                json_end = raw_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    parsed = json.loads(raw_text[json_start:json_end])
                    result.verdict = parsed.get("verdict", "PASS")
                    result.issues = parsed.get("issues", [])
                    result.suggestions = parsed.get("suggestions", "")
                else:
                    # Nao encontrou JSON, assume PASS
                    result.verdict = "PASS"
            except json.JSONDecodeError:
                # JSON invalido, assume PASS (fail-open)
                result.verdict = "PASS"

            return result

        except Exception as e:
            print(f"[PersonaValidator] Erro na validacao: {e}")
            # Em caso de erro, nao bloqueia a resposta (fail-open)
            return ValidationResult(verdict="PASS")
