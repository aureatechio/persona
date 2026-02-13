"""
Persona Loop — processa TODAS as personas em batches paralelos.

Divide 2000+ personas entre Claude Haiku e GPT-4o Mini em paralelo,
colhe sentimento + comentário de cada uma.
"""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator

import anthropic
import openai

from arena_analysis.config import settings
from arena_analysis.context_builder import ContextResult
from arena_analysis.comment_prompt import ARENA_SYSTEM_PROMPT, build_batch_prompt


@dataclass
class PersonaResult:
    persona_id: str
    sentiment: str  # "positive" | "negative" | "neutral"
    comment: str


@dataclass
class BatchProgress:
    """Emitido a cada batch completado."""
    processed: int
    total: int
    positive: int
    negative: int
    neutral: int
    results: list[PersonaResult]


def _chunk_list(lst: list, size: int) -> list[list]:
    """Divide lista em chunks de tamanho N."""
    return [lst[i : i + size] for i in range(0, len(lst), size)]


def _parse_response(raw: str, personas: list[dict[str, Any]]) -> list[PersonaResult]:
    """Parse JSON da resposta e retorna PersonaResult para cada persona."""
    # Limpa markdown
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```json?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

    parsed = json.loads(text)
    results = []

    for i, item in enumerate(parsed):
        if i >= len(personas):
            break
        persona = personas[i]
        pid = str(persona.get("id", persona.get("name", f"unknown_{i}")))
        sentiment = item.get("sentiment", "neutral")

        if sentiment not in ("positive", "negative", "neutral"):
            sentiment = "neutral"

        results.append(
            PersonaResult(
                persona_id=pid,
                sentiment=sentiment,
                comment=item.get("comment", ""),
            )
        )

    # Preenche faltantes com neutral
    for i in range(len(results), len(personas)):
        persona = personas[i]
        pid = str(persona.get("id", persona.get("name", f"unknown_{i}")))
        results.append(
            PersonaResult(persona_id=pid, sentiment="neutral", comment="...")
        )

    return results


def _fallback_results(personas: list[dict[str, Any]]) -> list[PersonaResult]:
    """Fallback: retorna neutral com comentário genérico."""
    return [
        PersonaResult(
            persona_id=str(p.get("id", p.get("name", "unknown"))),
            sentiment="neutral",
            comment="sei la",
        )
        for p in personas
    ]


class PersonaLoop:
    """
    Processa TODAS as personas dividindo batches entre Claude + GPT em paralelo.
    """

    def __init__(self):
        self._claude = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self._openai = openai.OpenAI(api_key=settings.openai_api_key)
        self._has_openai = bool(settings.openai_api_key)

    # ── Claude batch ─────────────────────────────────────────────────────
    async def _process_claude(
        self,
        question: str,
        context: ContextResult,
        personas: list[dict[str, Any]],
        semaphore: asyncio.Semaphore,
        retry: int = 0,
    ) -> list[PersonaResult]:
        async with semaphore:
            user_prompt = build_batch_prompt(question, context, personas)
            try:
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self._claude.messages.create(
                        model=settings.model,
                        max_tokens=settings.max_tokens_per_batch,
                        system=ARENA_SYSTEM_PROMPT,
                        messages=[{"role": "user", "content": user_prompt}],
                        temperature=1.0,
                    ),
                )
                text_block = next(
                    (b for b in response.content if b.type == "text"), None
                )
                if not text_block:
                    raise ValueError("No text block in response")
                return _parse_response(text_block.text, personas)

            except json.JSONDecodeError as e:
                if retry < 2:
                    print(f"[Claude] JSON error, retry {retry+1}/2...")
                    await asyncio.sleep(2)
                    return await self._process_claude(
                        question, context, personas, semaphore, retry + 1
                    )
                print(f"[Claude] JSON error after retries, fallback")
                return _fallback_results(personas)

            except Exception as e:
                is_rate = "rate_limit" in str(e) or "429" in str(e)
                max_r = 3 if is_rate else 1
                if retry < max_r:
                    wait = (retry + 1) * 5 if is_rate else 2
                    print(f"[Claude] {'Rate limit' if is_rate else 'Error'}, retry {retry+1}/{max_r} in {wait}s...")
                    await asyncio.sleep(wait)
                    return await self._process_claude(
                        question, context, personas, semaphore, retry + 1
                    )
                print(f"[Claude] Error after retries, fallback: {e}")
                return _fallback_results(personas)

    # ── OpenAI batch ─────────────────────────────────────────────────────
    async def _process_openai(
        self,
        question: str,
        context: ContextResult,
        personas: list[dict[str, Any]],
        semaphore: asyncio.Semaphore,
        retry: int = 0,
    ) -> list[PersonaResult]:
        async with semaphore:
            user_prompt = build_batch_prompt(question, context, personas)
            try:
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self._openai.chat.completions.create(
                        model=settings.openai_model,
                        max_tokens=settings.max_tokens_per_batch,
                        messages=[
                            {"role": "system", "content": ARENA_SYSTEM_PROMPT},
                            {"role": "user", "content": user_prompt},
                        ],
                        temperature=1.0,
                    ),
                )
                raw = response.choices[0].message.content or ""
                return _parse_response(raw, personas)

            except json.JSONDecodeError as e:
                if retry < 2:
                    print(f"[GPT] JSON error, retry {retry+1}/2...")
                    await asyncio.sleep(2)
                    return await self._process_openai(
                        question, context, personas, semaphore, retry + 1
                    )
                print(f"[GPT] JSON error after retries, fallback")
                return _fallback_results(personas)

            except Exception as e:
                is_rate = "rate_limit" in str(e) or "429" in str(e)
                max_r = 3 if is_rate else 1
                if retry < max_r:
                    wait = (retry + 1) * 3 if is_rate else 2
                    print(f"[GPT] {'Rate limit' if is_rate else 'Error'}, retry {retry+1}/{max_r} in {wait}s...")
                    await asyncio.sleep(wait)
                    return await self._process_openai(
                        question, context, personas, semaphore, retry + 1
                    )
                print(f"[GPT] Error after retries, fallback: {e}")
                return _fallback_results(personas)

    # ── Run principal ────────────────────────────────────────────────────
    async def run(
        self,
        question: str,
        context: ContextResult,
        personas: list[dict[str, Any]],
    ) -> AsyncGenerator[BatchProgress, None]:
        """
        Divide personas entre Claude e GPT-4o Mini em paralelo.
        Yield BatchProgress a cada batch completado.
        """
        total = len(personas)
        batches = _chunk_list(personas, settings.batch_size)

        # Divide batches: 30% Claude, 70% GPT (GPT tem rate limit maior)
        if self._has_openai:
            split = max(1, int(len(batches) * settings.claude_share))
            claude_batches = batches[:split]
            openai_batches = batches[split:]
            print(
                f"[PersonaLoop] {total} personas, {len(batches)} batches | "
                f"Claude: {len(claude_batches)} batches (max {settings.max_parallel_claude}p) | "
                f"GPT: {len(openai_batches)} batches (max {settings.max_parallel_openai}p)"
            )
        else:
            claude_batches = batches
            openai_batches = []
            print(
                f"[PersonaLoop] {total} personas, {len(batches)} batches | "
                f"Claude only (max {settings.max_parallel_claude}p)"
            )

        sem_claude = asyncio.Semaphore(settings.max_parallel_claude)
        sem_openai = asyncio.Semaphore(settings.max_parallel_openai)

        processed = 0
        positive = 0
        negative = 0
        neutral = 0

        # Lança TODOS os batches de ambos providers de uma vez
        all_tasks = []
        for batch in claude_batches:
            all_tasks.append(
                self._process_claude(question, context, batch, sem_claude)
            )
        for batch in openai_batches:
            all_tasks.append(
                self._process_openai(question, context, batch, sem_openai)
            )

        # Colhe resultados conforme completam
        for coro in asyncio.as_completed(all_tasks):
            batch_results = await coro

            for r in batch_results:
                processed += 1
                if r.sentiment == "positive":
                    positive += 1
                elif r.sentiment == "negative":
                    negative += 1
                else:
                    neutral += 1

            yield BatchProgress(
                processed=processed,
                total=total,
                positive=positive,
                negative=negative,
                neutral=neutral,
                results=batch_results,
            )

        print(
            f"[PersonaLoop] Concluido: {processed}/{total} personas. "
            f"P={positive} N={negative} U={neutral}"
        )
