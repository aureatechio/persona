"""Step 2: Generate personalized response text using GPT-4o + quality inspector."""

import json
import logging
from openai import OpenAI

from config import OPENAI_API_KEY

logger = logging.getLogger("worker.generate")

_client = OpenAI(api_key=OPENAI_API_KEY)

MAX_ATTEMPTS = 3  # 1 original + 2 retries


def _validate_response(
    name: str, transcription: str, generated_text: str, prompt_template: str
) -> dict:
    """
    Quality inspector: validates the generated response against the original
    transcription AND the prompt rules using gpt-4o-mini (fast + cheap).

    Returns {"approved": True} or {"approved": False, "reason": "..."}.
    """
    response = _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Você é um inspetor de qualidade de respostas políticas em vídeo.\n\n"
                    "Você recebe 3 coisas:\n"
                    "1. O PROMPT ORIGINAL com todas as regras de como o texto deve ser\n"
                    "2. O DEPOIMENTO do eleitor (o que ele falou no vídeo)\n"
                    "3. O TEXTO GERADO (a resposta que foi criada)\n\n"
                    "Sua função é verificar se o TEXTO GERADO:\n"
                    "- Obedece TODAS as regras do PROMPT ORIGINAL\n"
                    "- É coerente com o que o eleitor falou no DEPOIMENTO\n"
                    "- Fala sobre o MESMO assunto que o eleitor mencionou "
                    "(se falou do partido, deve ser sobre o partido; se falou de trânsito, sobre trânsito)\n"
                    "- NÃO contém a sigla PL, P.L., Pê Éli ou qualquer variação "
                    "(deve usar 'nosso partido', 'nossa causa', 'nossa luta' em vez da sigla)\n"
                    "- Contém o nome do eleitor corretamente\n"
                    "- Se o eleitor mencionou cidade, ela está presente\n"
                    "- Pronome de gênero correto (minha querida/meu querido)\n"
                    "- Não contém alucinações ou informações inventadas\n"
                    "- Respeita o limite de palavras do prompt\n\n"
                    "Responda APENAS com JSON válido, sem markdown:\n"
                    '{"approved": true}\n'
                    "ou\n"
                    '{"approved": false, "reason": "explicação curta do problema"}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"=== PROMPT ORIGINAL (regras) ===\n{prompt_template}\n\n"
                    f"=== DEPOIMENTO DO ELEITOR ===\n"
                    f"Nome: {name}\n"
                    f'Fala: "{transcription}"\n\n'
                    f"=== TEXTO GERADO (para verificar) ===\n"
                    f'"{generated_text}"'
                ),
            },
        ],
        max_tokens=100,
        temperature=0,
    )

    raw = (response.choices[0].message.content or "").strip()

    try:
        # Remove markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return json.loads(raw)
    except (json.JSONDecodeError, KeyError):
        logger.warning("Inspector returned invalid JSON: '%s' — approving by default", raw[:100])
        return {"approved": True}


def _generate_once(
    name: str, transcription: str, prompt_template: str, correction: str | None = None
) -> str:
    """Single generation attempt. If correction is provided, it's added as context."""
    system_prompt = prompt_template.replace("{nome}", name).replace("{transcricao}", transcription)

    user_content = (
        f'Nome: {name}\nDepoimento: "{transcription}"\n\n'
        "IMPORTANTE: Se houver nomes de cidades ou bairros no depoimento, "
        "escreva o nome COMPLETO e CORRETO. Nunca corte ou abrevie nomes de lugares."
    )

    if correction:
        user_content += (
            f"\n\nATENÇÃO — A tentativa anterior foi REJEITADA pelo inspetor de qualidade. "
            f"Motivo: {correction}\n"
            "Gere uma nova resposta que corrija esse problema."
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

    text = response.choices[0].message.content or ""
    return text.strip()


def generate_text(name: str, transcription: str, prompt_template: str) -> str:
    """
    Generate a personalized response using GPT-4o with quality validation.
    The inspector (gpt-4o-mini) checks coherence with the transcription.
    Retries up to MAX_ATTEMPTS times if validation fails.
    """
    logger.info("Generating text for '%s'...", name)

    correction = None
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

    # All attempts exhausted — use the last generated text
    logger.warning("All %d attempts rejected, using last generated text", MAX_ATTEMPTS)
    return text
