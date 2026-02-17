"""
Persona Loop — processa TODAS as personas em batches paralelos.

Divide 2000+ personas entre Claude Haiku e GPT-4o Mini em paralelo,
colhe sentimento + comentário de cada uma.

Suporta N chaves Anthropic + N chaves OpenAI com round-robin.
Usa clients async nativos (sem thread pool).
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
    Processa TODAS as personas dividindo batches entre Claude (N chaves)
    + GPT (N chaves) em paralelo com round-robin.
    Usa AsyncAnthropic + AsyncOpenAI (async nativo, sem thread pool).
    """

    def __init__(self):
        # Claude async clients — 1 por chave
        self._claude_clients: list[anthropic.AsyncAnthropic] = [
            anthropic.AsyncAnthropic(api_key=key)
            for key in settings.anthropic_api_keys
        ]
        self._has_claude = len(self._claude_clients) > 0

        # OpenAI async clients — 1 por chave
        self._openai_clients: list[openai.AsyncOpenAI] = [
            openai.AsyncOpenAI(api_key=key)
            for key in settings.openai_api_keys
        ]
        self._has_openai = len(self._openai_clients) > 0

    # ── Claude batch ─────────────────────────────────────────────────────
    async def _process_claude(
        self,
        question: str,
        context: ContextResult,
        personas: list[dict[str, Any]],
        semaphore: asyncio.Semaphore,
        client: anthropic.AsyncAnthropic,
        key_id: int = 0,
    ) -> list[PersonaResult]:
        tag = f"Claude-{key_id+1}"
        max_retries = 3
        async with semaphore:
            user_prompt = build_batch_prompt(question, context, personas)
            for attempt in range(max_retries + 1):
                try:
                    response = await client.messages.create(
                        model=settings.model,
                        max_tokens=settings.max_tokens_per_batch,
                        system=ARENA_SYSTEM_PROMPT,
                        messages=[{"role": "user", "content": user_prompt}],
                        temperature=1.0,
                    )
                    text_block = next(
                        (b for b in response.content if b.type == "text"), None
                    )
                    if not text_block:
                        raise ValueError("No text block in response")
                    return _parse_response(text_block.text, personas)

                except json.JSONDecodeError:
                    if attempt < 2:
                        print(f"[{tag}] JSON error, retry {attempt+1}/2...")
                        await asyncio.sleep(2)
                        continue
                    print(f"[{tag}] JSON error after retries, fallback")
                    return _fallback_results(personas)

                except Exception as e:
                    is_rate = "rate_limit" in str(e) or "429" in str(e)
                    max_r = 3 if is_rate else 1
                    if attempt < max_r:
                        wait = (attempt + 1) * 5 if is_rate else 2
                        print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r} in {wait}s...")
                        await asyncio.sleep(wait)
                        continue
                    print(f"[{tag}] Error after retries, fallback: {e}")
                    return _fallback_results(personas)
        return _fallback_results(personas)

    # ── OpenAI batch ─────────────────────────────────────────────────────
    async def _process_openai(
        self,
        question: str,
        context: ContextResult,
        personas: list[dict[str, Any]],
        semaphore: asyncio.Semaphore,
        client: openai.AsyncOpenAI,
        key_id: int = 0,
    ) -> list[PersonaResult]:
        tag = f"GPT-{key_id+1}"
        max_retries = 3
        async with semaphore:
            user_prompt = build_batch_prompt(question, context, personas)
            for attempt in range(max_retries + 1):
                try:
                    response = await client.chat.completions.create(
                        model=settings.openai_model,
                        max_tokens=settings.max_tokens_per_batch,
                        messages=[
                            {"role": "system", "content": ARENA_SYSTEM_PROMPT},
                            {"role": "user", "content": user_prompt},
                        ],
                        temperature=1.0,
                    )
                    raw = response.choices[0].message.content or ""
                    return _parse_response(raw, personas)

                except json.JSONDecodeError:
                    if attempt < 2:
                        print(f"[{tag}] JSON error, retry {attempt+1}/2...")
                        await asyncio.sleep(2)
                        continue
                    print(f"[{tag}] JSON error after retries, fallback")
                    return _fallback_results(personas)

                except Exception as e:
                    is_rate = "rate_limit" in str(e) or "429" in str(e)
                    max_r = 3 if is_rate else 1
                    if attempt < max_r:
                        wait = (attempt + 1) * 3 if is_rate else 2
                        print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r} in {wait}s...")
                        await asyncio.sleep(wait)
                        continue
                    print(f"[{tag}] Error after retries, fallback: {e}")
                    return _fallback_results(personas)
        return _fallback_results(personas)

    # ── Run principal ────────────────────────────────────────────────────
    async def run(
        self,
        question: str,
        context: ContextResult | None,
        personas: list[dict[str, Any]],
    ) -> AsyncGenerator[BatchProgress, None]:
        """
        Divide personas entre Claude (N chaves) e GPT (N chaves) em paralelo.
        Yield BatchProgress a cada batch completado.
        """
        total = len(personas)
        batches = _chunk_list(personas, settings.batch_size)
        num_claude_keys = len(self._claude_clients)
        num_gpt_keys = len(self._openai_clients)

        if self._has_openai:
            split = max(1, int(len(batches) * settings.claude_share))
            claude_batches = batches[:split]
            gpt_batches = batches[split:]

            claude_groups: list[list[list]] = [[] for _ in range(num_claude_keys)]
            for i, batch in enumerate(claude_batches):
                claude_groups[i % num_claude_keys].append(batch)

            gpt_groups: list[list[list]] = [[] for _ in range(num_gpt_keys)]
            for i, batch in enumerate(gpt_batches):
                gpt_groups[i % num_gpt_keys].append(batch)

            claude_info = " + ".join(
                f"Claude-{i+1}: {len(g)}b" for i, g in enumerate(claude_groups)
            )
            gpt_info = " + ".join(
                f"GPT-{i+1}: {len(g)}b" for i, g in enumerate(gpt_groups)
            )
            print(
                f"[PersonaLoop] {total} personas, {len(batches)} batches | "
                f"{claude_info} (max {settings.max_parallel_claude}p) | "
                f"{gpt_info} (max {settings.max_parallel_openai}p)"
            )
        else:
            claude_groups = [[] for _ in range(num_claude_keys)]
            for i, batch in enumerate(batches):
                claude_groups[i % num_claude_keys].append(batch)
            gpt_groups = []
            claude_info = " + ".join(
                f"Claude-{i+1}: {len(g)}b" for i, g in enumerate(claude_groups)
            )
            print(
                f"[PersonaLoop] {total} personas, {len(batches)} batches | "
                f"{claude_info} (max {settings.max_parallel_claude}p) | Claude only"
            )

        sem_claude = asyncio.Semaphore(settings.max_parallel_claude)
        sem_openai = asyncio.Semaphore(settings.max_parallel_openai)

        processed = 0
        positive = 0
        negative = 0
        neutral = 0

        all_tasks = []
        for key_id, group in enumerate(claude_groups):
            client = self._claude_clients[key_id]
            for batch in group:
                all_tasks.append(
                    self._process_claude(question, context, batch, sem_claude, client, key_id)
                )
        for key_id, group in enumerate(gpt_groups):
            client = self._openai_clients[key_id]
            for batch in group:
                all_tasks.append(
                    self._process_openai(question, context, batch, sem_openai, client, key_id)
                )

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
