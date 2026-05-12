"""
Calibration endpoint — mirrors the FULL production pipeline (v3) but emits
detailed SSE events at every step showing prompts, responses, and timing.

Steps (same as production v3):
  1. Context Builder (Claude — smart search + context)
  2. Ideological Frame (Claude)
  3. Persona Loading + Geo Filter
  4. Pre-Classification (GPT-4o-mini)
  5. Aggregate Engine (1 GPT-4o call)
  6. Aggregation (final numbers)
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
from arena_analysis.results_aggregator import aggregate_results
from arena_analysis.pre_classifier import (
    SYSTEM_PROMPT as PRE_CLASSIFY_SYSTEM_PROMPT,
    build_disambiguation_block,
)
from arena_analysis.geo_filter import apply_geo_filter
from arena_analysis.context_builder import ContextBuilder, ContextResult
from arena_analysis.web_researcher import ArenaWebResearcher
from arena_analysis.aggregate_engine import analyze as aggregate_analyze, load_profile
from arena_analysis.aggregate_prompt import AGGREGATE_SYSTEM_PROMPT, build_user_prompt


class CalibrationRequest(BaseModel):
    question: str
    context_text: Optional[str] = None
    geo_filter: Optional[dict] = None  # {state, city}


def sse_event(event_type: str, data: dict | list | str) -> str:
    payload = {"type": event_type, "data": data}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _pre_classify_verbose(question: str, context_text: str | None = None) -> dict:
    """Pre-classify with full prompt/response capture."""
    keys = settings.openai_api_keys or ([settings.openai_api_key] if settings.openai_api_key else [])
    if not keys:
        return {
            "result": {"type": "other", "figures": [], "core_position": question,
                       "classification_guide": {"positive_means": "Concorda", "negative_means": "Discorda", "neutral_means": "Neutro"},
                       "relevant_fields": []},
            "system_prompt": PRE_CLASSIFY_SYSTEM_PROMPT,
            "user_prompt": "", "raw_response": "NO_KEYS", "latency_ms": 0, "tokens": 0,
        }

    user_content = f'Pergunta/Afirmacao: "{question}"'
    if context_text:
        user_content += f'\n\nContexto adicional:\n{context_text[:2000]}'

    client = AsyncOpenAI(api_key=keys[0], timeout=30.0)
    start = time.time()

    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": PRE_CLASSIFY_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0, max_tokens=800,
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
        raw = response.choices[0].message.content.strip()
        latency_ms = round((time.time() - start) * 1000)
        tokens = response.usage.total_tokens if response.usage else 0
        result = json.loads(raw)

        for k, v in [("classification_guide", {"positive_means": "Concorda", "negative_means": "Discorda", "neutral_means": "Neutro"}),
                      ("core_position", question), ("type", "other"), ("figures", [])]:
            if k not in result:
                result[k] = v

        return {"result": result, "system_prompt": PRE_CLASSIFY_SYSTEM_PROMPT,
                "user_prompt": user_content, "raw_response": raw,
                "latency_ms": latency_ms, "tokens": tokens}
    except Exception as e:
        return {"result": {"type": "other", "figures": [], "core_position": question,
                           "classification_guide": {"positive_means": "Concorda", "negative_means": "Discorda", "neutral_means": "Neutro"},
                           "relevant_fields": []},
                "system_prompt": PRE_CLASSIFY_SYSTEM_PROMPT,
                "user_prompt": user_content, "raw_response": f"ERROR: {e}",
                "latency_ms": round((time.time() - start) * 1000), "tokens": 0}


async def calibration_analyze(request: CalibrationRequest, raw_request: Request):
    """Full production pipeline (v3) with verbose SSE for calibration."""
    cancelled = asyncio.Event()

    async def _watch_disconnect():
        while not cancelled.is_set():
            if await raw_request.is_disconnected():
                cancelled.set()
                return
            await asyncio.sleep(1)

    disconnect_task = asyncio.create_task(_watch_disconnect())
    context_builder = ContextBuilder()

    async def generate():
        start_time = time.time()

        # -- STEP 1: Start --
        yield sse_event("cal_start", {"question": request.question})

        # -- STEP 2: Contextualizacao IA (smart search + context builder) --
        context = None

        yield sse_event("cal_step", {
            "step": "context_builder", "status": "running",
            "label": "Contextualizacao IA",
            "description": "Claude analisando conteudo e decidindo se precisa buscar na web...",
        })

        ctx_start = time.time()

        search_info = await context_builder.smart_search(
            request.question, request.context_text
        )
        web_context = search_info.get("results", "")

        if search_info.get("searched"):
            yield sse_event("cal_step", {
                "step": "context_builder", "status": "running",
                "label": "Contextualizacao IA",
                "description": f"Buscou na web: {', '.join(search_info.get('queries', []))} — Contextualizando...",
            })

        if request.context_text:
            enriched = await context_builder.build(
                question=request.question,
                web_context=web_context,
            )
            context = ContextResult(
                tema=enriched.tema or "Conteudo de midia",
                contexto=request.context_text,
                figuras=enriched.figuras,
                periodo=enriched.periodo,
                prompt_tokens=enriched.prompt_tokens,
                output_tokens=enriched.output_tokens,
            )
            if enriched.contexto:
                context.contexto += f"\n\n--- Contextualizacao da IA ---\n{enriched.contexto}"
        else:
            context = await context_builder.build(
                question=request.question,
                web_context=web_context,
            )

        ctx_ms = round((time.time() - ctx_start) * 1000)

        yield sse_event("cal_step_detail", {
            "step": "context_builder",
            "status": "complete",
            "latency_ms": ctx_ms,
            "tokens": context.prompt_tokens + context.output_tokens,
            "input": {
                "question": request.question,
                "smart_search": {
                    "searched": search_info.get("searched", False),
                    "reason": search_info.get("reason", ""),
                    "queries": search_info.get("queries", []),
                },
            },
            "output": {
                "tema": context.tema,
                "contexto": context.contexto[:5000],
                "figuras": context.figuras,
                "periodo": context.periodo,
                "web_data": web_context[:2000] if web_context else "",
                "raw_text": context.raw_text[:3000] if context.raw_text else "",
            },
        })

        # -- STEP 3: Ideological Frame --
        ideo_frame = None
        if context and context.contexto:
            yield sse_event("cal_step", {
                "step": "ideological_frame", "status": "running",
                "label": "Mapeamento Ideologico",
                "description": "Claude mapeia vies esquerda/direita para o tema...",
            })

            try:
                ideo_start = time.time()
                ideo_frame = await context_builder.build_ideological_frame(
                    question=request.question, context=context,
                )
                ideo_ms = round((time.time() - ideo_start) * 1000)

                if ideo_frame:
                    context.contexto += ideo_frame

                yield sse_event("cal_step_detail", {
                    "step": "ideological_frame",
                    "status": "complete",
                    "latency_ms": ideo_ms,
                    "output": {
                        "frame": ideo_frame[:2000] if ideo_frame else "Nenhum frame gerado",
                    },
                })
            except Exception as e:
                yield sse_event("cal_step_detail", {
                    "step": "ideological_frame",
                    "status": "error",
                    "output": {"error": str(e)},
                })

        if cancelled.is_set():
            return

        # -- STEP 4: Load + Filter Personas --
        yield sse_event("cal_step", {
            "step": "persona_loader", "status": "running",
            "label": "Carregamento de Personas",
            "description": "Carregando 20.000 personas do Supabase...",
        })

        personas = await asyncio.to_thread(load_personas)
        original_count = len(personas)

        geo_filter_data = request.geo_filter
        geo_cities = []
        if geo_filter_data and geo_filter_data.get("state"):
            class _GF:
                def __init__(self, d):
                    self.state = d.get("state")
                    self.city = d.get("city")
                    self.min_personas = d.get("min_personas", 50)
            gf = _GF(geo_filter_data)
            personas, geo_cities = apply_geo_filter(personas, gf)

        total = len(personas)

        yield sse_event("cal_step_detail", {
            "step": "persona_loader",
            "status": "complete",
            "output": {
                "original_count": original_count,
                "filtered_count": total,
                "geo_filter": geo_filter_data,
                "geo_cities": geo_cities[:10],
            },
        })

        # -- STEP 5: Pre-Classification (Semantic analysis) --
        yield sse_event("cal_step", {
            "step": "pre_classifier", "status": "running",
            "label": "Pre-Classificacao Semantica",
            "description": "GPT-4o-mini analisa semantica da pergunta...",
        })

        pre_result = await _pre_classify_verbose(request.question, request.context_text)
        pre_class = pre_result["result"]
        disambiguation = build_disambiguation_block(pre_class)

        if disambiguation and context:
            context.contexto = disambiguation + "\n" + (context.contexto or "")
        elif disambiguation:
            context = ContextResult(tema="Pre-classificacao", contexto=disambiguation)

        yield sse_event("cal_step_detail", {
            "step": "pre_classifier",
            "status": "complete",
            "latency_ms": pre_result["latency_ms"],
            "tokens": pre_result["tokens"],
            "input": {
                "system_prompt": pre_result["system_prompt"],
                "user_prompt": pre_result["user_prompt"],
            },
            "output": {
                "raw_response": pre_result["raw_response"],
                "parsed": pre_class,
                "disambiguation_block": disambiguation[:3000] if disambiguation else "",
            },
        })

        if cancelled.is_set():
            return

        # -- STEP 6: Aggregate Engine (1 GPT-4o call) --
        yield sse_event("cal_step", {
            "step": "aggregate_engine", "status": "running",
            "label": "Motor de Inferencia Agregada",
            "description": f"GPT-4o analisando sentimento de {total} personas em 1 chamada...",
        })

        # Load profile for metadata display
        try:
            profile = await load_profile()
            profile_meta = {
                "total_personas": profile.get("total_personas", 0),
                "computed_at": profile.get("computed_at", "unknown"),
            }
        except Exception:
            profile_meta = {"total_personas": total, "computed_at": "unknown"}

        # Build the user prompt for display (before the actual call)
        ctx_str = context.contexto if context else ""
        display_user_prompt = build_user_prompt(
            question=request.question,
            context=ctx_str,
            pre_classification=pre_class,
            profile=profile if profile else {},
        )

        # Launch aggregate analysis
        agg_start = time.time()
        aggregate_task = asyncio.create_task(
            aggregate_analyze(
                question=request.question,
                context=context,
                pre_classification=pre_class,
            )
        )

        # Emit synthetic progress events (~60s) while model processes
        progress_steps = [
            (0.05, "Carregando perfis demograficos..."),
            (0.15, "Cruzando dados eleitorais..."),
            (0.27, "Analisando clusters ideologicos..."),
            (0.40, "Processando opiniao tematica..."),
            (0.55, "Avaliando segmentos regionais..."),
            (0.70, "Calculando intensidade por grupo..."),
            (0.85, "Consolidando sentimento geral..."),
            (0.97, "Finalizando analise..."),
        ]

        step_duration = 60.0 / len(progress_steps)
        for i, (pct, msg) in enumerate(progress_steps):
            if cancelled.is_set():
                aggregate_task.cancel()
                return

            processed = int(total * pct)
            yield sse_event("cal_progress", {
                "processed": processed,
                "total": total,
                "positive": 0,
                "negative": 0,
                "neutral": 0,
                "avgScore": 5.0,
                "scoreSum": 0,
                "phase_message": msg,
            })

            try:
                await asyncio.wait_for(asyncio.shield(aggregate_task), timeout=step_duration)
                break  # Model finished early
            except asyncio.TimeoutError:
                pass
            except Exception:
                break  # Error — will be caught below

        # Await final result
        try:
            final_results = await aggregate_task
        except Exception as e:
            print(f"[Calibration] Aggregate engine error: {e}")
            import traceback
            traceback.print_exc()
            final_results = {
                "total": total, "positive": 0, "negative": 0, "neutral": 0,
                "avgScore": 5.0, "processingTime": 0, "segments": {},
                "comments": [], "clusterResults": [], "archetypes": [],
            }

        agg_ms = round((time.time() - agg_start) * 1000)

        # Emit aggregate engine detail with prompts
        yield sse_event("cal_step_detail", {
            "step": "aggregate_engine",
            "status": "complete",
            "latency_ms": agg_ms,
            "input": {
                "system_prompt": AGGREGATE_SYSTEM_PROMPT[:5000],
                "user_prompt": display_user_prompt[:8000],
                "model": settings.aggregate_model,
                "profile_meta": profile_meta,
            },
            "output": {
                "total": final_results.get("total", total),
                "positive": final_results.get("positive", 0),
                "negative": final_results.get("negative", 0),
                "neutral": final_results.get("neutral", 0),
                "avgScore": final_results.get("avgScore", 5.0),
                "segments_preview": {k: v[:3] if isinstance(v, list) else v for k, v in (final_results.get("segments") or {}).items()},
                "comments_count": len(final_results.get("comments", [])),
                "cluster_count": len(final_results.get("clusterResults", [])),
            },
        })

        # -- STEP 7: Aggregation (final numbers) --
        pos = final_results.get("positive", 0)
        neg = final_results.get("negative", 0)
        neu = final_results.get("neutral", 0)
        avg_score = final_results.get("avgScore", 5.0)
        segments = final_results.get("segments")

        yield sse_event("cal_step", {
            "step": "aggregation", "status": "running",
            "label": "Agregacao de Resultados",
            "description": "Consolidando segmentos demograficos...",
        })

        yield sse_event("cal_step_detail", {
            "step": "aggregation", "status": "complete",
            "output": {
                "total": total,
                "positive": pos, "negative": neg, "neutral": neu,
                "avgScore": avg_score,
                "segments": segments,
            },
        })

        # -- STEP 8: Emit results --
        elapsed = time.time() - start_time

        yield sse_event("cal_results", {
            "total": total,
            "positive": pos, "negative": neg, "neutral": neu,
            "avgScore": avg_score,
            "processing_time_ms": round(elapsed * 1000),
            "segments": segments,
        })

        # -- STEP 9: Done (backend phase) --
        # Cost estimation for aggregate engine
        # GPT-4o: $2.50/1M input, $10/1M output (estimated ~15k input, ~10k output)
        agg_input_est = 15000
        agg_output_est = 10000
        agg_cost = (agg_input_est / 1_000_000) * 2.50 + (agg_output_est / 1_000_000) * 10.0
        # Claude context builder + ideological frame
        claude_est = (5000 / 1_000_000) * 3.0 + (1000 / 1_000_000) * 15.0
        # Pre-classifier GPT-4o-mini
        pre_class_est = (2000 / 1_000_000) * 0.15 + (300 / 1_000_000) * 0.60
        total_cost = agg_cost + claude_est + pre_class_est

        yield sse_event("cal_done", {
            "total_personas": total,
            "processing_time_ms": round(elapsed * 1000),
            "avgScore": avg_score,
            "cost": {
                "aggregate_engine": {
                    "model": settings.aggregate_model,
                    "estimated_input_tokens": agg_input_est,
                    "estimated_output_tokens": agg_output_est,
                    "cost_usd": round(agg_cost, 4),
                },
                "claude_estimated_usd": round(claude_est, 4),
                "pre_classifier_estimated_usd": round(pre_class_est, 4),
                "total_usd": round(total_cost, 4),
            },
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
