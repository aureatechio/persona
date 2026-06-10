"""V2 Step 2b: Generate personalized response text using GPT-4o (full_video/legacy only)."""

import json
import logging
from openai import OpenAI

from config import OPENAI_API_KEY

logger = logging.getLogger("v2-worker.generate")

_client = OpenAI(api_key=OPENAI_API_KEY)

MAX_ATTEMPTS = 3


def _validate_response(name: str, transcription: str, generated_text: str, prompt_template: str) -> dict:
    """Quality inspector: validates the generated response."""
    response = _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Você é um inspetor de qualidade de respostas políticas em vídeo.\n\n"
                    "Verifique se o TEXTO GERADO:\n"
                    "- Obedece TODAS as regras do PROMPT ORIGINAL\n"
                    "- É coerente com o DEPOIMENTO\n"
                    "- Contém o nome do eleitor corretamente\n"
                    "- Não contém alucinações ou repetições\n"
                    "- Respeita o limite de palavras\n\n"
                    "Responda APENAS com JSON válido:\n"
                    '{"approved": true}\nou\n'
                    '{"approved": false, "reason": "explicação curta"}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"=== PROMPT ORIGINAL ===\n{prompt_template}\n\n"
                    f"=== DEPOIMENTO ===\nNome: {name}\nFala: \"{transcription}\"\n\n"
                    f"=== TEXTO GERADO ===\n\"{generated_text}\""
                ),
            },
        ],
        max_tokens=100,
        temperature=0,
    )

    raw = (response.choices[0].message.content or "").strip()
    try:
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return json.loads(raw)
    except (json.JSONDecodeError, KeyError):
        return {"approved": True}


def _generate_once(name: str, transcription: str, prompt_template: str, correction: str | None = None) -> str:
    """Single generation attempt."""
    system_prompt = prompt_template.replace("{nome}", name).replace("{transcricao}", transcription)

    user_content = (
        f'Nome: {name}\nDepoimento: "{transcription}"\n\n'
        "IMPORTANTE: Se houver nomes de cidades ou bairros, escreva o nome COMPLETO."
    )

    if correction:
        user_content += (
            f"\n\nATENÇÃO — Tentativa anterior REJEITADA. Motivo: {correction}\n"
            "Gere uma nova resposta corrigindo esse problema."
        )

    response = _client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        max_tokens=200,
        temperature=0.8,
    )

    return (response.choices[0].message.content or "").strip()


def generate_text(name: str, transcription: str, prompt_template: str) -> str:
    """Generate personalized response with quality validation. Retries up to MAX_ATTEMPTS."""
    logger.info("Generating text for '%s'...", name)

    correction = None
    text = ""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        text = _generate_once(name, transcription, prompt_template, correction)
        logger.info("Attempt %d/%d: '%s'", attempt, MAX_ATTEMPTS, text[:100])

        result = _validate_response(name, transcription, text, prompt_template)

        if result.get("approved"):
            if attempt > 1:
                logger.info("Approved on attempt %d", attempt)
            return text

        reason = result.get("reason", "motivo não especificado")
        logger.warning("Rejected (attempt %d/%d): %s", attempt, MAX_ATTEMPTS, reason)
        correction = reason

    logger.warning("All %d attempts rejected, using last text", MAX_ATTEMPTS)
    return text
