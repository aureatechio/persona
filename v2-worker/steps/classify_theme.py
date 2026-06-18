"""V2 Step 2a: Classify the voter's message into one of the 31 theme slugs."""

from __future__ import annotations

import logging
import re
import unicodedata

from openai import OpenAI

from config import OPENAI_API_KEY

logger = logging.getLogger("v2-worker.classify_theme")

_client = OpenAI(api_key=OPENAI_API_KEY)

DEFAULT_THEME_SLUG = "padrao"


def classify_theme(transcription: str, themes: list[dict]) -> str:
    """
    Classify transcription into one of the theme slugs.
    Returns the matching slug, or 'padrao' if no clear match.
    """
    text = (transcription or "").strip()
    if not text or not themes:
        return DEFAULT_THEME_SLUG

    valid_slugs = {t["slug"] for t in themes}

    options_lines = []
    for t in themes:
        if t.get("slug") == DEFAULT_THEME_SLUG:
            continue
        label = t.get("label", "")
        description = t.get("description", "")
        options_lines.append(f"- {t['slug']}: {label} — {description}")
    options_text = "\n".join(options_lines)

    system_prompt = (
        "Você é um classificador de depoimentos de eleitores em temas "
        "políticos. Analise o depoimento e escolha O SLUG "
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
        logger.warning("classify_theme failed (%s), using %s", e, DEFAULT_THEME_SLUG)
        return DEFAULT_THEME_SLUG

    slug = _normalize_slug(raw)
    if slug not in valid_slugs:
        logger.warning("classify_theme: slug '%s' (raw=%r) not in list — using %s", slug, raw, DEFAULT_THEME_SLUG)
        return DEFAULT_THEME_SLUG

    logger.info("classify_theme: '%s' -> %s", text[:60], slug)
    return slug


def normalize_first_name(full_name: str) -> str:
    """Extract and normalize first name for cache key."""
    name = (full_name or "").strip()
    if not name:
        return ""
    first = name.split()[0]
    normalized = "".join(
        c for c in unicodedata.normalize("NFD", first) if unicodedata.category(c) != "Mn"
    ).lower()
    return re.sub(r"[^a-z]+", "", normalized)


def _normalize_slug(raw: str) -> str:
    """Clean LLM output into a valid slug (snake_case)."""
    if not raw:
        return ""
    cleaned = raw.strip().strip("\"'`.,;:!?\n\r ")
    if ":" in cleaned:
        cleaned = cleaned.split(":", 1)[0].strip()
    cleaned = "".join(
        c for c in unicodedata.normalize("NFD", cleaned) if unicodedata.category(c) != "Mn"
    ).lower()
    cleaned = re.sub(r"[^a-z0-9_]+", "_", cleaned).strip("_")
    return cleaned[:60]
