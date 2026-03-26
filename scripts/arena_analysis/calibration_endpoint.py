"""
Calibration endpoint — verbose pipeline for testing/tuning personas.

Reuses the production pipeline (PersonaLoop, pre_classify, geo_filter)
but emits much richer SSE events with full prompts, raw AI responses,
and per-persona details for debugging.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Optional

from fastapi import Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

from arena_analysis.config import settings
from arena_analysis.persona_loader import load_personas
from arena_analysis.persona_loop import PersonaLoop
from arena_analysis.results_aggregator import aggregate_results
from arena_analysis.comment_prompt import ARENA_SYSTEM_PROMPT, build_batch_prompt, get_arena_system_prompt, load_bias_config
from arena_analysis.pre_classifier import SYSTEM_PROMPT as PRE_CLASSIFY_SYSTEM_PROMPT, build_disambiguation_block
from arena_analysis.geo_filter import apply_geo_filter
from arena_analysis.context_builder import ContextResult


class CalibrationRequest(BaseModel):
    question: str
    context_text: Optional[str] = None
    geo_filter: Optional[dict] = None  # {state, city}


def sse_event(event_type: str, data: dict | list | str) -> str:
    payload = {"type": event_type}
    payload["data"] = data
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _pre_classify_verbose(question: str, context_text: str | None = None) -> dict:
    """Pre-classify with full prompt/response capture for calibration UI."""
    keys = settings.openai_api_keys or ([settings.openai_api_key] if settings.openai_api_key else [])
    if not keys:
        return {
            "result": {"type": "other", "figures": [], "core_position": question,
                       "classification_guide": {"positive_means": "Concorda", "negative_means": "Discorda", "neutral_means": "Neutro"},
                       "relevant_fields": []},
            "system_prompt": PRE_CLASSIFY_SYSTEM_PROMPT,
            "user_prompt": "",
            "raw_response": "NO_KEYS",
            "latency_ms": 0,
            "tokens": 0,
        }

    user_content = f'Pergunta/Afirmacao: "{question}"'
    if context_text:
        user_content += f'\n\nContexto adicional:\n{context_text[:2000]}'

    client = AsyncOpenAI(api_key=keys[0])
    start = time.time()

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": PRE_CLASSIFY_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0,
            max_tokens=800,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
        latency_ms = round((time.time() - start) * 1000)
        tokens = response.usage.total_tokens if response.usage else 0
        result = json.loads(raw)

        # Fill defaults
        if "classification_guide" not in result:
            result["classification_guide"] = {"positive_means": "Concorda", "negative_means": "Discorda", "neutral_means": "Neutro"}
        if "core_position" not in result:
            result["core_position"] = question
        if "type" not in result:
            result["type"] = "other"
        if "figures" not in result:
            result["figures"] = []

        return {
            "result": result,
            "system_prompt": PRE_CLASSIFY_SYSTEM_PROMPT,
            "user_prompt": user_content,
            "raw_response": raw,
            "latency_ms": latency_ms,
            "tokens": tokens,
        }
    except Exception as e:
        return {
            "result": {"type": "other", "figures": [], "core_position": question,
                       "classification_guide": {"positive_means": "Concorda", "negative_means": "Discorda", "neutral_means": "Neutro"},
                       "relevant_fields": []},
            "system_prompt": PRE_CLASSIFY_SYSTEM_PROMPT,
            "user_prompt": user_content,
            "raw_response": f"ERROR: {e}",
            "latency_ms": round((time.time() - start) * 1000),
            "tokens": 0,
        }


async def calibration_analyze(request: CalibrationRequest, raw_request: Request):
    """Calibration endpoint — verbose SSE stream for pipeline debugging."""

    cancelled = asyncio.Event()

    async def _watch_disconnect():
        while not cancelled.is_set():
            if await raw_request.is_disconnected():
                cancelled.set()
                return
            await asyncio.sleep(1)

    disconnect_task = asyncio.create_task(_watch_disconnect())
    persona_loop = PersonaLoop()

    async def generate():
        start_time = time.time()

        # 1. Start
        yield sse_event("cal_start", {"question": request.question})

        # 2. Load + filter personas
        personas = await asyncio.to_thread(load_personas)
        original_count = len(personas)

        geo_filter_data = request.geo_filter
        if geo_filter_data and geo_filter_data.get("state"):
            # Build a simple GeoFilter-like object
            class _GF:
                def __init__(self, d):
                    self.state = d.get("state")
                    self.city = d.get("city")
                    self.min_personas = d.get("min_personas", 50)
            gf = _GF(geo_filter_data)
            personas, geo_cities = apply_geo_filter(personas, gf)

            yield sse_event("cal_geo_filter", {
                "original_count": original_count,
                "filtered_count": len(personas),
                "criteria": {"state": gf.state, "city": gf.city},
                "sample_removed": [],
            })
        else:
            yield sse_event("cal_geo_filter", {
                "original_count": original_count,
                "filtered_count": original_count,
                "criteria": None,
                "sample_removed": [],
            })

        total = len(personas)

        # 3. Pre-classify verbose
        pre_result = await _pre_classify_verbose(request.question, request.context_text)
        pre_class = pre_result["result"]

        yield sse_event("cal_pre_classify", {
            "system_prompt": pre_result["system_prompt"],
            "user_prompt": pre_result["user_prompt"],
            "raw_response": pre_result["raw_response"],
            "parsed": pre_class,
            "latency_ms": pre_result["latency_ms"],
            "tokens": pre_result["tokens"],
        })

        # Build disambiguation + context
        disambiguation = build_disambiguation_block(pre_class)
        context = None
        if disambiguation:
            context = ContextResult(tema="Pre-classificacao", contexto=disambiguation)
        if request.context_text:
            if context:
                context.contexto += "\n" + request.context_text
            else:
                context = ContextResult(tema="Contexto do usuario", contexto=request.context_text)

        # 4. Emit prompt sample (first batch)
        if total > 0:
            sample_batch = personas[:min(settings.batch_size, total)]
            sample_prompt = build_batch_prompt(request.question, context, sample_batch)
            system_prompt = await get_arena_system_prompt()

            yield sse_event("cal_prompt_sample", {
                "system_prompt": system_prompt[:5000],
                "user_prompt": sample_prompt[:10000],
                "persona_count": len(sample_batch),
            })

        # Check cancellation
        if cancelled.is_set():
            return

        # 5. Run persona loop (verbose=True for batch_meta)
        has_political_figures = any(
            f.get("stance") in ("attack", "defense")
            for f in pre_class.get("figures", [])
        )

        all_results = []
        inc_personas = []
        inc_results = []
        batch_index = 0

        async for progress in persona_loop.run(
            request.question, context, personas,
            verbose=True, cancelled=cancelled,
            skip_political_enforcement=has_political_figures,
        ):
            all_results.extend(progress.results)
            inc_personas.extend(progress.personas)
            inc_results.extend(progress.results)

            # Emit batch result with details
            persona_details = []
            if progress.batch_meta:
                for ps in progress.batch_meta.get("personas_summary", []):
                    persona_details.append({
                        "id": ps.get("id", "?"),
                        "name": ps.get("name", "?"),
                        "state": ps.get("state", "?"),
                        "age": ps.get("age", 0),
                        "political_leaning": "",
                        "sentiment": ps.get("sentiment", "neutral"),
                        "summary": f"score={ps.get('score', 5.0)} | {ps.get('comment', '')[:100]}",
                    })

            batch_total = (total + settings.batch_size - 1) // settings.batch_size

            yield sse_event("cal_batch_result", {
                "batch_index": batch_index,
                "batch_total": batch_total,
                "prompt": "(use prompt_sample event for full prompt)",
                "raw_response": "",
                "sentiments": [r.sentiment for r in progress.results],
                "personas": persona_details,
                "latency_ms": 0,
                "tokens": 0,
            })

            # Emit progress
            avg_score = round(progress.score_sum / progress.processed, 1) if progress.processed > 0 else 5.0

            # Build segments periodically
            segments = None
            if progress.processed == progress.total or progress.processed % 200 < settings.batch_size:
                try:
                    agg = await asyncio.to_thread(
                        aggregate_results, inc_personas, inc_results, request.question
                    )
                    segments = agg.get("segments")
                except Exception:
                    pass

            yield sse_event("cal_progress", {
                "processed": progress.processed,
                "total": progress.total,
                "positive": progress.positive,
                "negative": progress.negative,
                "neutral": progress.neutral,
                "avgScore": avg_score,
                "segments": segments,
            })

            batch_index += 1

            if cancelled.is_set():
                break

        # 6. Final aggregation
        elapsed = time.time() - start_time
        try:
            final_agg = await asyncio.to_thread(
                aggregate_results, inc_personas, inc_results, request.question
            )
            segments = final_agg.get("segments")
        except Exception:
            segments = None

        pos = sum(1 for r in all_results if r.sentiment == "positive")
        neg = sum(1 for r in all_results if r.sentiment == "negative")
        neu = len(all_results) - pos - neg

        yield sse_event("cal_results", {
            "total": len(all_results),
            "positive": pos,
            "negative": neg,
            "neutral": neu,
            "processing_time_ms": round(elapsed * 1000),
            "segments": segments,
        })

        yield sse_event("cal_done", {
            "total_personas": len(all_results),
            "processing_time_ms": round(elapsed * 1000),
        })

    async def generate_with_cleanup():
        try:
            async for event in generate():
                yield event
        finally:
            cancelled.set()
            disconnect_task.cancel()

    return StreamingResponse(
        generate_with_cleanup(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        },
    )
