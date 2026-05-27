"""Classifica a transcrição do depoimento em uma categoria (1 palavra
snake_case sem acento) e normaliza o primeiro nome do eleitor para uso
como chave de cache.

Sem taxonomia fechada — a categoria emerge naturalmente conforme novos
temas aparecem. O prompt força convenção forte (lowercase, sem acento,
substantivo singular, sem espaço) pra maximizar hit rate.
"""

from __future__ import annotations

import logging
import re
import unicodedata

from openai import OpenAI

from config import OPENAI_API_KEY

logger = logging.getLogger("worker.classify")

_client = OpenAI(api_key=OPENAI_API_KEY)

_SYSTEM_PROMPT = (
    "Você é um classificador de temas políticos. Lê o depoimento de um "
    "eleitor e responde com UMA ÚNICA palavra que representa o tema "
    "principal do que ele falou.\n\n"
    "REGRAS ESTRITAS:\n"
    "- Responda APENAS a palavra, sem pontuação, sem aspas, sem explicação.\n"
    "- Use lowercase.\n"
    "- Sem acento (educacao, não educação).\n"
    "- Substantivo no singular (saude, não saudaveis).\n"
    "- Sem espaço — se precisar de duas palavras, use snake_case (meio_ambiente).\n"
    "- Use palavras simples e amplas (educacao, saude, seguranca, economia, "
    "emprego, infraestrutura, corrupcao, meio_ambiente, transporte, cultura, "
    "habitacao, agronegocio, familia, religiao).\n"
    "- Se o eleitor não falou de nenhum tema político claro, responda: outros.\n\n"
    "Exemplos:\n"
    "Depoimento: 'as escolas da minha cidade estão um lixo' → educacao\n"
    "Depoimento: 'tô sem emprego há 6 meses' → emprego\n"
    "Depoimento: 'a violência aqui no bairro tá demais' → seguranca\n"
    "Depoimento: 'oi tudo bem? gostaria de saber mais' → outros"
)


def classify_category(transcription: str) -> str:
    """
    Classifica o depoimento em uma palavra-chave de categoria.
    Fallback "outros" se o LLM falhar ou retornar formato inválido.
    """
    text = (transcription or "").strip()
    if not text:
        return "outros"

    try:
        resp = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"Depoimento: '{text}'"},
            ],
            max_tokens=10,
            temperature=0,
        )
        raw = (resp.choices[0].message.content or "").strip()
    except Exception as e:
        logger.warning("Classify call failed (%s) — falling back to 'outros'", e)
        return "outros"

    # Defensive normalize — o LLM pode escapar das regras
    category = _normalize_token(raw)
    if not category:
        logger.warning("Classifier returned empty/invalid token: %r — using 'outros'", raw)
        return "outros"

    logger.info("Classified as: %s", category)
    return category


def normalize_first_name(full_name: str) -> str:
    """
    Pega só o primeiro nome (split por espaço), em lowercase, sem acentos.
    'João Carlos' → 'joao'. Usado como chave de cache.
    """
    if not full_name:
        return ""
    first = full_name.strip().split()[0] if full_name.strip() else ""
    return _strip_accents(first).lower()


def _normalize_token(raw: str) -> str:
    """Limpa o output do LLM: pega 1ª palavra/token, lowercase, sem acento,
    só [a-z0-9_]. Retorna '' se inválido."""
    if not raw:
        return ""
    # Tira aspas, pontuação envolta, quebras de linha
    cleaned = raw.strip().strip("\"'`.,;:!?\n\r ")
    # Se vier "categoria: educacao", pega só a parte depois do ':'
    if ":" in cleaned:
        cleaned = cleaned.split(":", 1)[1].strip()
    cleaned = _strip_accents(cleaned).lower()
    # Mantém só letras, dígitos e underscore
    cleaned = re.sub(r"[^a-z0-9_]+", "_", cleaned).strip("_")
    return cleaned[:40]  # cap de segurança


def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )
