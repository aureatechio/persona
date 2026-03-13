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


@dataclass
class BatchProgress:
    """Emitido a cada N personas completadas."""
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
        return PersonaResult(persona_id=pid, sentiment="neutral", comment="sei la")

    sentiment = parsed.get("sentiment", "neutral")
    if sentiment not in ("positive", "negative", "neutral"):
        sentiment = "neutral"

    return PersonaResult(
        persona_id=pid,
        sentiment=sentiment,
        comment=parsed.get("comment", ""),
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


def _fallback_single(persona: dict[str, Any]) -> PersonaResult:
    """Fallback para 1 persona."""
    return PersonaResult(
        persona_id=str(persona.get("id", persona.get("name", "unknown"))),
        sentiment="neutral",
        comment="sei la",
    )


class PersonaLoop:
    """
    Processa TODAS as personas INDIVIDUALMENTE (1 por chamada de API).
    Cada persona recebe 100% da atenção do modelo.

    Distribui entre Claude Sonnet (N chaves) + GPT-4o (N chaves) em paralelo
    com rate limiting por chave.
    """

    def __init__(self):
        # Claude async clients — 1 por chave
        self._claude_clients: list[anthropic.AsyncAnthropic] = [
            anthropic.AsyncAnthropic(api_key=key)
            for key in settings.anthropic_api_keys
        ]
        self._has_claude = len(self._claude_clients) > 0

        # Rate limiters — 1 por chave Claude (45 RPM com margem vs 50 RPM limit)
        self._claude_limiters: list[KeyRateLimiter] = [
            KeyRateLimiter(rpm=45) for _ in self._claude_clients
        ]

        # OpenAI async clients — 1 por chave
        self._openai_clients: list[openai.AsyncOpenAI] = [
            openai.AsyncOpenAI(api_key=key)
            for key in settings.openai_api_keys
        ]
        self._has_openai = len(self._openai_clients) > 0

        # Rate limiters — 1 por chave OpenAI (450 RPM com margem vs 500 RPM limit)
        self._openai_limiters: list[KeyRateLimiter] = [
            KeyRateLimiter(rpm=450) for _ in self._openai_clients
        ]

    # ── Claude — 1 persona ─────────────────────────────────────────────────
    async def _process_claude_single(
        self,
        question: str,
        context: ContextResult,
        persona: dict[str, Any],
        rate_limiter: KeyRateLimiter,
        client: anthropic.AsyncAnthropic,
        key_id: int = 0,
    ) -> tuple[PersonaResult, str, dict[str, Any]]:
        tag = f"Claude-{key_id+1}"
        max_retries = settings.max_retries
        user_prompt = build_single_prompt(question, context, persona)

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
                return (_parse_single_response(text_block.text, persona, tag), tag, persona)

            except json.JSONDecodeError:
                if attempt < max_retries:
                    print(f"[{tag}] JSON error, retry {attempt+1}/{max_retries}...")
                    await asyncio.sleep(1)
                    continue
                print(f"[{tag}] JSON error after {max_retries} retries, fallback")
                return (_fallback_single(persona), tag, persona)

            except Exception as e:
                is_rate = "rate_limit" in str(e).lower() or "429" in str(e)
                max_r = 3 if is_rate else max_retries
                if attempt < max_r:
                    wait = (attempt + 1) * 5 if is_rate else 2
                    print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r} in {wait}s: {str(e)[:100]}")
                    await asyncio.sleep(wait)
                    continue
                print(f"[{tag}] Error after retries, fallback: {str(e)[:200]}")
                return (_fallback_single(persona), tag, persona)

        return (_fallback_single(persona), tag, persona)

    # ── OpenAI — 1 persona ─────────────────────────────────────────────────
    async def _process_openai_single(
        self,
        question: str,
        context: ContextResult,
        persona: dict[str, Any],
        rate_limiter: KeyRateLimiter,
        client: openai.AsyncOpenAI,
        key_id: int = 0,
    ) -> tuple[PersonaResult, str, dict[str, Any]]:
        tag = f"GPT-{key_id+1}"
        max_retries = settings.max_retries
        user_prompt = build_single_prompt(question, context, persona)

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
                return (_parse_single_response(raw, persona, tag), tag, persona)

            except json.JSONDecodeError:
                if attempt < max_retries:
                    print(f"[{tag}] JSON error, retry {attempt+1}/{max_retries}...")
                    await asyncio.sleep(1)
                    continue
                print(f"[{tag}] JSON error after {max_retries} retries, fallback")
                return (_fallback_single(persona), tag, persona)

            except Exception as e:
                is_rate = "rate_limit" in str(e).lower() or "429" in str(e)
                max_r = 3 if is_rate else max_retries
                if attempt < max_r:
                    wait = (attempt + 1) * 3 if is_rate else 2
                    print(f"[{tag}] {'Rate limit' if is_rate else 'Error'}, retry {attempt+1}/{max_r} in {wait}s: {str(e)[:100]}")
                    await asyncio.sleep(wait)
                    continue
                print(f"[{tag}] Error after retries, fallback: {str(e)[:200]}")
                return (_fallback_single(persona), tag, persona)

        return (_fallback_single(persona), tag, persona)

    # ── Run principal ────────────────────────────────────────────────────
    async def run(
        self,
        question: str,
        context: ContextResult | None,
        personas: list[dict[str, Any]],
        verbose: bool = False,
    ) -> AsyncGenerator[BatchProgress, None]:
        """
        Processa CADA persona individualmente (1 por chamada de API).
        Distribui round-robin entre chaves Claude e GPT.
        Yield BatchProgress a cada ~50 personas para não sobrecarregar SSE.
        """
        total = len(personas)
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

        print(
            f"[PersonaLoop] {total} personas (1 por chamada) | "
            f"Claude Sonnet: {len(claude_personas)} ({num_claude_keys} keys, 45 RPM/key) | "
            f"GPT-4o: {len(gpt_personas)} ({num_gpt_keys} keys, 450 RPM/key)"
        )

        # Emit sample prompt (verbose only)
        if verbose and personas:
            sample_prompt = build_single_prompt(question, context, personas[0])
            yield BatchProgress(
                processed=0, total=total,
                positive=0, negative=0, neutral=0,
                results=[],
                batch_meta={
                    "type": "prompt_sample",
                    "system_prompt": ARENA_SYSTEM_PROMPT[:500] + "..." if len(ARENA_SYSTEM_PROMPT) > 500 else ARENA_SYSTEM_PROMPT,
                    "user_prompt": sample_prompt,
                    "persona_count": 1,
                    "note": "Prompt de 1 persona (modo qualidade máxima). Cada persona recebe atenção 100% dedicada.",
                },
            )

        # Criar todas as tasks — round-robin por chave
        all_tasks = []
        for i, persona in enumerate(claude_personas):
            key_id = i % num_claude_keys
            all_tasks.append(
                self._process_claude_single(
                    question, context, persona,
                    self._claude_limiters[key_id],
                    self._claude_clients[key_id], key_id,
                )
            )
        for i, persona in enumerate(gpt_personas):
            key_id = i % num_gpt_keys
            all_tasks.append(
                self._process_openai_single(
                    question, context, persona,
                    self._openai_limiters[key_id],
                    self._openai_clients[key_id], key_id,
                )
            )

        # Processar e emitir progresso a cada emit_every personas
        emit_every = max(50, total // 100)  # ~100 progress events no máximo
        processed = 0
        positive = 0
        negative = 0
        neutral = 0
        pending_results: list[PersonaResult] = []
        pending_meta: list[dict] = []

        for coro in asyncio.as_completed(all_tasks):
            result, model_tag, persona_data = await coro

            processed += 1
            if result.sentiment == "positive":
                positive += 1
            elif result.sentiment == "negative":
                negative += 1
            else:
                neutral += 1

            pending_results.append(result)

            if verbose:
                pending_meta.append({
                    "id": result.persona_id,
                    "name": str(persona_data.get("name", result.persona_id)),
                    "state": str(persona_data.get("state", "")),
                    "age": persona_data.get("age", 0),
                    "sentiment": result.sentiment,
                    "comment": result.comment[:200] if result.comment else "",
                    "model": model_tag,
                })

            # Emitir progresso a cada emit_every ou no final
            if len(pending_results) >= emit_every or processed == total:
                meta = None
                if verbose:
                    meta = {
                        "model": "mixed",
                        "persona_count": len(pending_results),
                        "personas_summary": pending_meta,
                    }

                yield BatchProgress(
                    processed=processed,
                    total=total,
                    positive=positive,
                    negative=negative,
                    neutral=neutral,
                    results=pending_results,
                    batch_meta=meta,
                )
                pending_results = []
                pending_meta = []

        print(
            f"[PersonaLoop] Concluido: {processed}/{total} personas. "
            f"P={positive} N={negative} U={neutral}"
        )
