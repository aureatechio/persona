"""Step 2: Generate personalized response text using GPT-4o."""

import logging
from openai import OpenAI

from config import OPENAI_API_KEY

logger = logging.getLogger("worker.generate")

_client = OpenAI(api_key=OPENAI_API_KEY)


def generate_text(name: str, transcription: str, prompt_template: str) -> str:
    """
    Generate a personalized response using GPT-4o.
    prompt_template should contain {nome} and {transcricao} placeholders.
    Returns the generated text.
    """
    system_prompt = prompt_template.replace("{nome}", name).replace("{transcricao}", transcription)

    logger.info("Generating text for '%s'...", name)

    response = _client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f'Nome: {name}\nDepoimento: "{transcription}"\n\n'
                    "IMPORTANTE: Se houver nomes de cidades ou bairros no depoimento, "
                    "escreva o nome COMPLETO e CORRETO. Nunca corte ou abrevie nomes de lugares."
                ),
            },
        ],
        max_tokens=200,
        temperature=0.8,
    )

    text = response.choices[0].message.content or ""
    logger.info("Generated text: '%s'", text[:100])
    return text.strip()
