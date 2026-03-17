"""
Persona Loop — processa TODAS as personas INDIVIDUALMENTE.

Cada persona recebe 100% da atenção do modelo (batch_size=1).
Divide entre Claude Sonnet e GPT-4o em paralelo com rate limiting por chave.

Suporta N chaves Anthropic + N chaves OpenAI com round-robin.
Usa clients async nativos (sem thread pool).
"""
from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator

import anthropic
import openai

from arena_analysis.config import settings
from arena_analysis.context_builder import ContextResult
from arena_analysis.comment_prompt import ARENA_SYSTEM_PROMPT, build_batch_prompt, build_single_prompt


@dataclass
class PersonaResult:
    persona_id: str
    sentiment: str  # "positive" | "negative" | "neutral"
    comment: str
    score: float = 5.0  # 0-10 impact score from AI


@dataclass
class BatchProgress:
    """Emitido a cada N personas completadas."""
    processed: int
    total: int
    positive: int
    negative: int
    neutral: int
    results: list[PersonaResult]
    score_sum: float = 0.0
    batch_meta: dict | None = None
    personas: list[dict[str, Any]] = field(default_factory=list)


def _chunk_list(lst: list, size: int) -> list[list]:
    """Divide lista em chunks de tamanho N."""
    return [lst[i : i + size] for i in range(0, len(lst), size)]


class KeyRateLimiter:
    """
    Rate limiter por chave de API.
    Garante no máximo `rpm` requests por janela de 60 segundos.
    """

    def __init__(self, rpm: int = 45):
        self.rpm = rpm
        self._timestamps: list[float] = []
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Espera até ter slot disponível na janela de 60s."""
        while True:
            async with self._lock:
                now = time.monotonic()
                # Remove timestamps fora da janela de 60s
                self._timestamps = [t for t in self._timestamps if now - t < 60.0]
                if len(self._timestamps) < self.rpm:
                    self._timestamps.append(now)
                    return
            # Sem slot — espera um pouco e tenta de novo
            await asyncio.sleep(0.5)


def _clean_json_text(text: str) -> str:
    """Remove markdown fences e whitespace de respostas JSON."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```json?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()
    return text


def _parse_single_response(raw: str, persona: dict[str, Any], tag: str = "") -> PersonaResult:
    """
    Parse JSON de resposta para 1 persona.
    Espera: {"sentiment": "...", "comment": "..."}
    """
    pid = str(persona.get("id", persona.get("name", "unknown")))
    text = _clean_json_text(raw)
    if not text:
        print(f"[{tag}] Empty response for {pid}, fallback")
        return PersonaResult(persona_id=pid, sentiment="neutral", comment="sei la")

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        preview = raw[:200].replace('\n', ' ')
        print(f"[{tag}] JSON parse failed for {pid}: {e}")
        print(f"[{tag}] Response preview: {preview}")
        raise

    # Handle {"results": [...]} wrapper (model might still return array)
    if isinstance(parsed, dict) and "results" in parsed:
        arr = parsed["results"]
        if isinstance(arr, list) and arr:
            parsed = arr[0]

    # Handle array response
    if isinstance(parsed, list) and parsed:
        parsed = parsed[0]

    if not isinstance(parsed, dict):
        return PersonaResult(persona_id=pid, sentiment="neutral", comment="sei la", score=5.0)

    # Extract and clamp score
    raw_score = parsed.get("score")
    try:
        score = float(raw_score) if raw_score is not None else 5.0
    except (TypeError, ValueError):
        score = 5.0
    score = max(0.0, min(10.0, score))

    # Derive sentiment from score (ensures coherence)
    # Narrower neutral band (4.0-6.0) — Brazilians are opinionated
    if score >= 6.0:
        sentiment = "positive"
    elif score <= 4.0:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    return PersonaResult(
        persona_id=pid,
        sentiment=sentiment,
        comment=parsed.get("comment", ""),
        score=score,
    )


def _recover_truncated_json(text: str) -> str:
    """
    Attempt to recover truncated JSON arrays (kept for batch mode / electoral).
    """
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```json?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()

    if text.startswith("{"):
        match = re.search(r'\[\s*\{', text)
        if match:
            start = match.start()
            text = text[start:]

    if not text.startswith("["):
        text = "[" + text

    text = re.sub(r',\s*$', '', text)

    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    last_brace = text.rfind("}")
    if last_brace > 0:
        truncated = text[:last_brace + 1]
        truncated = re.sub(r',\s*$', '', truncated)
        truncated += "]"
        try:
            json.loads(truncated)
            return truncated
        except json.JSONDecodeError:
            pass

    objects = re.findall(r'\{[^{}]*\}', text)
    if objects:
        return "[" + ",".join(objects) + "]"

    raise json.JSONDecodeError("Cannot recover JSON", text, 0)


def _parse_response(raw: str, personas: list[dict[str, Any]], tag: str = "") -> list[PersonaResult]:
    """
    Parse JSON da resposta em batch (mantido para electoral engine / backward compat).
    """
    text = raw.strip()
    if not text:
        print(f"[{tag}] Empty response, fallback")
        return _fallback_results(personas)

    try:
        text = _recover_truncated_json(text)
        parsed = json.loads(text)
    except (json.JSONDecodeError, ValueError) as e:
        preview = raw[:200].replace('\n', ' ')
        print(f"[{tag}] JSON parse failed even after recovery: {e}")
        print(f"[{tag}] Response preview: {preview}")
        raise

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

        # Extract and clamp score
        raw_score = item.get("score")
        try:
            score = float(raw_score) if raw_score is not None else 5.0
        except (TypeError, ValueError):
            score = 5.0
        score = max(0.0, min(10.0, score))

        # Derive sentiment from score (ensures coherence)
        if score >= 6.5:
            sentiment = "positive"
        elif score <= 3.5:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        results.append(
            PersonaResult(
                persona_id=pid,
                sentiment=sentiment,
                comment=item.get("comment", ""),
                score=score,
            )
        )

    for i in range(len(results), len(personas)):
        persona = personas[i]
        pid = str(persona.get("id", persona.get("name", f"unknown_{i}")))
        results.append(
            PersonaResult(persona_id=pid, sentiment="neutral", comment="...", score=5.0)
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
            score=5.0,
        )
        for p in personas
    ]


def _fallback_single(persona: dict[str, Any]) -> PersonaResult:
    """Fallback para 1 persona."""
    return PersonaResult(
        persona_id=str(persona.get("id", persona.get("name", "unknown"))),
        sentiment="neutral",
        comment="sei la",
        score=5.0,
    )


class PersonaLoop:
    """
    Processa personas em BATCHES com concorrência controlada por semaphore.

    batch_size=10: 20k personas → 2000 API calls (10x fewer connections).
    Semaphore(40): max 40 concurrent HTTPS connections (safe for 1vCPU/1GB).
    Distribui entre Claude Sonnet + GPT-4o com rate limiting por chave.
    """

    def __init__(self):
        # Claude async clients — 1 por chave
        self._claude_clients: list[anthropic.AsyncAnthropic] = [
            anthropic.AsyncAnthropic(api_key=key)
            for key in settings.anthropic_api_keys
        ]
        self._has_claude = len(self._claude_clients) > 0

        # Rate limiters — 1 por chave Claude
        self._claude_limiters: list[KeyRateLimiter] = [
            KeyRateLimiter(rpm=45) for _ in self._claude_clients
        ]

        # OpenAI async clients — 1 por chave
        self._openai_clients: list[openai.AsyncOpenAI] = [
            openai.AsyncOpenAI(api_key=key)
            for key in settings.openai_api_keys
        ]
        self._has_openai = len(self._openai_clients) > 0

        # Rate limiters — 1 por chave OpenAI
        self._openai_limiters: list[KeyRateLimiter] = [
            KeyRateLimiter(rpm=450) for _ in self._openai_clients
        ]

    # ── Claude — batch of personas ────────────────────────────────────────
    async def _process_claude_batch(
        self,
        question: str,
        context: ContextResult,
        personas: list[dict[str, Any]],
        rate_limiter: KeyRateLimiter,
        client: anthropic.AsyncAnthropic,
        semaphore: asyncio.Semaphore,
        key_id: int = 0,
    ) -> list[PersonaResult]:
        tag = f"Claude-{key_id+1}"
        max_retries = settings.max_retries
        user_prompt = build_batch_prompt(question, context, personas)

        async with semaphore:
            for attempt in range(max_retries + 1):
                await rate_limiter.acquire()
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
                    return _parse_response(text_block.text, personas, tag)

                except json.JSONDecodeError:
                    if attempt < max_retries:
                        print(f"[{tag}] JSON error, retry {attempt+1}/{max_retries}...")
                        await asyncio.sleep(1)
                        continue
                    print(f"[{tag}] JSON error after retries, fallback")
                    return _fallback_results(personas)

                except Exception as e:
                    is_rate = "rate_limit" in str(e).lower() or "429" in str(e)
                    max_r = 3 if is_rate else max_retries
                    if attempt < max_r:
                        wait = (attempt + 1) * 5 if is_rate else 2
                        print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r} in {wait}s: {str(e)[:80]}")
                        await asyncio.sleep(wait)
                        continue
                    print(f"[{tag}] Error after retries, fallback: {str(e)[:150]}")
                    return _fallback_results(personas)

            return _fallback_results(personas)

    # ── OpenAI — batch of personas ────────────────────────────────────────
    async def _process_openai_batch(
        self,
        question: str,
        context: ContextResult,
        personas: list[dict[str, Any]],
        rate_limiter: KeyRateLimiter,
        client: openai.AsyncOpenAI,
        semaphore: asyncio.Semaphore,
        key_id: int = 0,
    ) -> list[PersonaResult]:
        tag = f"GPT-{key_id+1}"
        max_retries = settings.max_retries
        user_prompt = build_batch_prompt(question, context, personas)

        async with semaphore:
            for attempt in range(max_retries + 1):
                await rate_limiter.acquire()
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
                    return _parse_response(raw, personas, tag)

                except json.JSONDecodeError:
                    if attempt < max_retries:
                        print(f"[{tag}] JSON error, retry {attempt+1}/{max_retries}...")
                        await asyncio.sleep(1)
                        continue
                    print(f"[{tag}] JSON error after retries, fallback")
                    return _fallback_results(personas)

                except Exception as e:
                    is_rate = "rate_limit" in str(e).lower() or "429" in str(e)
                    max_r = 3 if is_rate else max_retries
                    if attempt < max_r:
                        wait = (attempt + 1) * 3 if is_rate else 2
                        print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r} in {wait}s: {str(e)[:80]}")
                        await asyncio.sleep(wait)
                        continue
                    print(f"[{tag}] Error after retries, fallback: {str(e)[:150]}")
                    return _fallback_results(personas)

            return _fallback_results(personas)

    # ── Run principal ────────────────────────────────────────────────────
    async def run(
        self,
        question: str,
        context: ContextResult | None,
        personas: list[dict[str, Any]],
        verbose: bool = False,
        cancelled: asyncio.Event | None = None,
    ) -> AsyncGenerator[BatchProgress, None]:
        """
        Processa personas em BATCHES (batch_size por chamada).
        Semaphore limita conexões simultâneas para não sobrecarregar o servidor.
        Yield BatchProgress a cada batch completado.
        """
        total = len(personas)
        batch_size = settings.batch_size
        num_claude_keys = len(self._claude_clients)
        num_gpt_keys = len(self._openai_clients)

        # Dividir personas entre Claude e GPT
        if self._has_openai:
            split_idx = max(1, int(total * settings.claude_share))
            claude_personas = personas[:split_idx]
            gpt_personas = personas[split_idx:]
        else:
            claude_personas = personas
            gpt_personas = []

        # Chunk into batches
        claude_batches = _chunk_list(claude_personas, batch_size)
        gpt_batches = _chunk_list(gpt_personas, batch_size)
        total_calls = len(claude_batches) + len(gpt_batches)

        print(
            f"[PersonaLoop] {total} personas | batch_size={batch_size} → {total_calls} API calls | "
            f"Claude: {len(claude_batches)} calls ({num_claude_keys} keys) | "
            f"GPT: {len(gpt_batches)} calls ({num_gpt_keys} keys)"
        )

        # Semaphores to limit concurrent connections (safe for 1vCPU/1GB)
        claude_sem = asyncio.Semaphore(min(settings.max_parallel_claude, len(claude_batches) or 1))
        gpt_sem = asyncio.Semaphore(min(settings.max_parallel_openai, len(gpt_batches) or 1))

        # Build metadata for each batch (model name + personas) for verbose mode
        batch_info: list[tuple[str, list[dict[str, Any]]]] = []

        # Wrapper to tag each coroutine with its index
        async def _tagged(idx: int, coro):
            result = await coro
            return idx, result

        # Create all tasks — round-robin by key
        all_tasks = []
        for i, batch in enumerate(claude_batches):
            key_id = i % num_claude_keys
            idx = len(all_tasks)
            all_tasks.append(
                _tagged(idx, self._process_claude_batch(
                    question, context, batch,
                    self._claude_limiters[key_id],
                    self._claude_clients[key_id],
                    claude_sem, key_id,
                ))
            )
            batch_info.append(("Claude Sonnet 4", batch))
        for i, batch in enumerate(gpt_batches):
            key_id = i % num_gpt_keys
            idx = len(all_tasks)
            all_tasks.append(
                _tagged(idx, self._process_openai_batch(
                    question, context, batch,
                    self._openai_limiters[key_id],
                    self._openai_clients[key_id],
                    gpt_sem, key_id,
                ))
            )
            batch_info.append(("GPT-4o", batch))

        # Process and emit progress as batches complete
        processed = 0
        positive = 0
        negative = 0
        neutral = 0
        score_sum = 0.0

        for coro in asyncio.as_completed(all_tasks):
            # Check cancellation before awaiting next batch
            if cancelled and cancelled.is_set():
                print(f"[PersonaLoop] Cancelled — stopping after {processed}/{total} personas")
                # Cancel remaining tasks
                for t in all_tasks:
                    if hasattr(t, 'cancel'):
                        t.cancel()
                return

            task_idx, batch_results = await coro

            for r in batch_results:
                processed += 1
                score_sum += r.score
                if r.sentiment == "positive":
                    positive += 1
                elif r.sentiment == "negative":
                    negative += 1
                else:
                    neutral += 1

            # Build verbose batch metadata
            batch_meta = None
            if verbose:
                model_name, batch_personas = batch_info[task_idx]
                batch_meta = {
                    "model": model_name,
                    "persona_count": len(batch_results),
                    "personas_summary": [
                        {
                            "id": str(p.get("id", p.get("name", "?"))),
                            "name": str(p.get("name", "?")),
                            "state": str(p.get("state", "?")),
                            "age": int(p.get("age", 0)),
                            "sentiment": r.sentiment,
                            "score": r.score,
                            "comment": r.comment[:300],
                        }
                        for p, r in zip(batch_personas, batch_results)
                    ],
                }

            _, batch_personas_for_progress = batch_info[task_idx]
            yield BatchProgress(
                processed=processed,
                total=total,
                positive=positive,
                negative=negative,
                neutral=neutral,
                results=batch_results,
                score_sum=score_sum,
                batch_meta=batch_meta,
                personas=batch_personas_for_progress,
            )

        avg_score = round(score_sum / processed, 2) if processed > 0 else 5.0
        print(
            f"[PersonaLoop] Concluido: {processed}/{total} personas. "
            f"P={positive} N={negative} U={neutral} | avgScore={avg_score}"
        )
