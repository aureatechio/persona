"""Classifica o depoimento do eleitor em UM dos temas cadastrados em
``themes_template`` (30 latentes do AM + ``padrao``).

A função recebe os temas direto do banco (lista de dicts com slug, label
e description). O GPT-4o-mini lê a descrição de cada tema pra decidir
qual encaixa melhor. Se não houver match claro, retorna ``"padrao"``.

Diferente do classify_category antigo (que retornava palavras livres),
aqui o vocabulário é fechado — o worker depende disso pra olhar a
``video_theme_models`` correta no banco.
"""

from __future__ import annotations

import logging
import re
import unicodedata

from openai import OpenAI

from config import OPENAI_API_KEY

logger = logging.getLogger("worker.classify_theme")

_client = OpenAI(api_key=OPENAI_API_KEY)

DEFAULT_THEME_SLUG = "padrao"


def classify_theme(transcription: str, themes: list[dict]) -> str:
    """
    Recebe a transcrição do depoimento e a lista de temas disponíveis
    (cada item: {slug, label, description}). Retorna o slug do tema
    escolhido, ou ``padrao`` se não houver match claro.

    Falha silenciosa (LLM error, JSON inválido, etc.) cai pra ``padrao``.
    """
    text = (transcription or "").strip()
    if not text or not themes:
        return DEFAULT_THEME_SLUG

    valid_slugs = {t["slug"] for t in themes}

    options_lines = []
    for t in themes:
        if t.get("slug") == DEFAULT_THEME_SLUG:
            continue  # padrao é fallback, não opção explícita
        label = t.get("label", "")
        description = t.get("description", "")
        options_lines.append(f"- {t['slug']}: {label} — {description}")
    options_text = "\n".join(options_lines)

    system_prompt = (
        "Você é um classificador de depoimentos de eleitores em temas "
        "políticos do Amazonas. Analise o depoimento e escolha O SLUG "
        "do tema que MELHOR representa o assunto principal do eleitor.\n\n"
        "REGRAS:\n"
        "- Responda APENAS o slug, sem aspas, sem markdown, sem explicação.\n"
        "- Se o eleitor mencionar múltiplos assuntos, escolha o mais "
        "central/recorrente.\n"
        f"- Se o depoimento não se encaixar claramente em NENHUM tema "
        f"abaixo, responda exatamente: {DEFAULT_THEME_SLUG}\n\n"
        f"TEMAS DISPONÍVEIS:\n{options_text}\n\n"
        f"- {DEFAULT_THEME_SLUG}: usar quando nenhum tema acima representa "
        "o que o eleitor falou."
    )

    try:
        resp = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Depoimento: '{text}'\n\nSlug do tema:"},
            ],
            max_tokens=30,
            temperature=0,
        )
        raw = (resp.choices[0].message.content or "").strip()
    except Exception as e:
        logger.warning("classify_theme: chamada falhou (%s), usando %s", e, DEFAULT_THEME_SLUG)
        return DEFAULT_THEME_SLUG

    slug = _normalize_slug(raw)
    if slug not in valid_slugs:
        logger.warning(
            "classify_theme: slug '%s' (raw=%r) não está na lista de temas — usando %s",
            slug, raw, DEFAULT_THEME_SLUG,
        )
        return DEFAULT_THEME_SLUG

    logger.info("classify_theme: '%s' -> %s", text[:60], slug)
    return slug


def _normalize_slug(raw: str) -> str:
    """Limpa o output do LLM até virar um slug válido (snake_case)."""
    if not raw:
        return ""
    cleaned = raw.strip().strip("\"'`.,;:!?\n\r ")
    if ":" in cleaned:
        cleaned = cleaned.split(":", 1)[0].strip()
    # Remove acentos e força lowercase
    cleaned = "".join(
        c for c in unicodedata.normalize("NFD", cleaned) if unicodedata.category(c) != "Mn"
    ).lower()
    cleaned = re.sub(r"[^a-z0-9_]+", "_", cleaned).strip("_")
    return cleaned[:60]
