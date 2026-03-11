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
    batch_meta: dict | None = None


def _chunk_list(lst: list, size: int) -> list[list]:
    """Divide lista em chunks de tamanho N."""
    return [lst[i : i + size] for i in range(0, len(lst), size)]


def _recover_truncated_json(text: str) -> str:
    """
    Attempt to recover truncated JSON arrays.
    Common issues: model hits max_tokens and output is cut mid-array.
    """
    text = text.strip()
    # Remove markdown fences
    if text.startswith("```"):
        text = re.sub(r"^```json?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()

    # Handle {"results": [...]} wrapper
    if text.startswith("{"):
        # Try to extract the array from inside
        match = re.search(r'\[\s*\{', text)
        if match:
            start = match.start()
            text = text[start:]

    # If it doesn't start with [, wrap it
    if not text.startswith("["):
        text = "[" + text

    # Remove trailing comma before attempting to close
    text = re.sub(r',\s*$', '', text)

    # Try parsing as-is
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    # Try closing truncated objects and array
    # Find the last complete object (ending with })
    last_brace = text.rfind("}")
    if last_brace > 0:
        truncated = text[:last_brace + 1]
        # Remove any trailing comma
        truncated = re.sub(r',\s*$', '', truncated)
        # Close the array
        truncated += "]"
        try:
            json.loads(truncated)
            return truncated
        except json.JSONDecodeError:
            pass

    # Last resort: extract individual objects with regex
    objects = re.findall(r'\{[^{}]*\}', text)
    if objects:
        return "[" + ",".join(objects) + "]"

    raise json.JSONDecodeError("Cannot recover JSON", text, 0)


def _parse_response(raw: str, personas: list[dict[str, Any]], tag: str = "") -> list[PersonaResult]:
    """
    Parse JSON da resposta com recuperação robusta de JSON truncado/malformado.
    """
    text = raw.strip()
    if not text:
        print(f"[{tag}] Empty response, fallback")
        return _fallback_results(personas)

    try:
        text = _recover_truncated_json(text)
        parsed = json.loads(text)
    except (json.JSONDecodeError, ValueError) as e:
        # Log first 200 chars for debugging
        preview = raw[:200].replace('\n', ' ')
        print(f"[{tag}] JSON parse failed even after recovery: {e}")
        print(f"[{tag}] Response preview: {preview}")
        raise

    # Handle both array and {"results": [...]} formats
    if isinstance(parsed, dict):
        parsed = parsed.get("results", parsed.get("data", []))
    if not isinstance(parsed, list):
        parsed = [parsed]

    results = []
    for i, item in enumerate(parsed):
        if i >= len(personas):
            break
        if not isinstance(item, dict):
            continue
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

    # Fill remaining personas with neutral
    for i in range(len(results), len(personas)):
        persona = personas[i]
        pid = str(persona.get("id", persona.get("name", f"unknown_{i}")))
        results.append(
            PersonaResult(persona_id=pid, sentiment="neutral", comment="...")
        )

    if len(results) < len(personas):
        print(f"[{tag}] Partial parse: {len(results)}/{len(personas)} recovered")

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
    ) -> tuple[list[PersonaResult], str, list[dict[str, Any]]]:
        tag = f"Claude-{key_id+1}"
        max_retries = 2
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
                    return (_parse_response(text_block.text, personas, tag), tag, personas)

                except json.JSONDecodeError:
                    if attempt < max_retries:
                        print(f"[{tag}] JSON error, retry {attempt+1}/{max_retries}...")
                        await asyncio.sleep(1)
                        continue
                    print(f"[{tag}] JSON error after {max_retries} retries, fallback")
                    return (_fallback_results(personas), tag, personas)

                except Exception as e:
                    is_rate = "rate_limit" in str(e).lower() or "429" in str(e)
                    max_r = 3 if is_rate else 1
                    if attempt < max_r:
                        wait = (attempt + 1) * 5 if is_rate else 2
                        print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r} in {wait}s: {str(e)[:100]}")
                        await asyncio.sleep(wait)
                        continue
                    print(f"[{tag}] Error after retries, fallback: {str(e)[:200]}")
                    return (_fallback_results(personas), tag, personas)
        return (_fallback_results(personas), tag, personas)

    # ── OpenAI batch ─────────────────────────────────────────────────────
    async def _process_openai(
        self,
        question: str,
        context: ContextResult,
        personas: list[dict[str, Any]],
        semaphore: asyncio.Semaphore,
        client: openai.AsyncOpenAI,
        key_id: int = 0,
    ) -> tuple[list[PersonaResult], str, list[dict[str, Any]]]:
        tag = f"GPT-{key_id+1}"
        max_retries = 2
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
                        response_format={"type": "json_object"},
                    )
                    raw = response.choices[0].message.content or ""
                    return (_parse_response(raw, personas, tag), tag, personas)

                except json.JSONDecodeError:
                    if attempt < max_retries:
                        print(f"[{tag}] JSON error, retry {attempt+1}/{max_retries}...")
                        await asyncio.sleep(1)
                        continue
                    print(f"[{tag}] JSON error after {max_retries} retries, fallback")
                    return (_fallback_results(personas), tag, personas)

                except Exception as e:
                    is_rate = "rate_limit" in str(e).lower() or "429" in str(e)
                    max_r = 3 if is_rate else 1
                    if attempt < max_r:
                        wait = (attempt + 1) * 3 if is_rate else 2
                        print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r} in {wait}s: {str(e)[:100]}")
                        await asyncio.sleep(wait)
                        continue
                    print(f"[{tag}] Error after retries, fallback: {str(e)[:200]}")
                    return (_fallback_results(personas), tag, personas)
        return (_fallback_results(personas), tag, personas)

    # ── Run principal ────────────────────────────────────────────────────
    async def run(
        self,
        question: str,
        context: ContextResult | None,
        personas: list[dict[str, Any]],
        verbose: bool = False,
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

        # Emit the full prompt of the first batch as sample (verbose only)
        if verbose and batches:
            sample_prompt = build_batch_prompt(question, context, batches[0])
            yield BatchProgress(
                processed=0, total=total,
                positive=0, negative=0, neutral=0,
                results=[],
                batch_meta={
                    "type": "prompt_sample",
                    "system_prompt": ARENA_SYSTEM_PROMPT[:500] + "..." if len(ARENA_SYSTEM_PROMPT) > 500 else ARENA_SYSTEM_PROMPT,
                    "user_prompt": sample_prompt,
                    "persona_count": len(batches[0]),
                    "note": "Prompt completo do 1o batch (amostra). Todos os batches seguem o mesmo formato.",
                },
            )

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
            batch_results, model_tag, batch_personas = await coro

            for r in batch_results:
                processed += 1
                if r.sentiment == "positive":
                    positive += 1
                elif r.sentiment == "negative":
                    negative += 1
                else:
                    neutral += 1

            # Build batch_meta when verbose
            meta = None
            if verbose:
                personas_summary = []
                for i, r in enumerate(batch_results):
                    p = batch_personas[i] if i < len(batch_personas) else {}
                    personas_summary.append({
                        "id": r.persona_id,
                        "name": str(p.get("name", r.persona_id)),
                        "state": str(p.get("state", "")),
                        "age": p.get("age", 0),
                        "sentiment": r.sentiment,
                        "comment": r.comment[:200] if r.comment else "",
                    })
                meta = {
                    "model": model_tag,
                    "persona_count": len(batch_results),
                    "personas_summary": personas_summary,
                }

            yield BatchProgress(
                processed=processed,
                total=total,
                positive=positive,
                negative=negative,
                neutral=neutral,
                results=batch_results,
                batch_meta=meta,
            )

        print(
            f"[PersonaLoop] Concluido: {processed}/{total} personas. "
            f"P={positive} N={negative} U={neutral}"
        )
