"""
Calibration endpoint — mirrors the FULL production pipeline but emits
detailed SSE events at every step showing prompts, responses, and timing.

Steps (same as production):
  1. Web Research (Tavily)
  2. Context Builder (Claude)
  3. Ideological Frame (Claude)
  4. Pre-Classification (GPT-4o-mini)
  5. Persona Loading + Geo Filter
  6. Prompt Sample Preview
  7. Persona Loop (Claude + GPT batches)
  8. Aggregation
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
from arena_analysis.comment_prompt import (
    ARENA_SYSTEM_PROMPT, build_batch_prompt, build_single_prompt,
    get_arena_system_prompt, load_bias_config, classify_question,
)
from arena_analysis.pre_classifier import (
    SYSTEM_PROMPT as PRE_CLASSIFY_SYSTEM_PROMPT,
    build_disambiguation_block,
)
from arena_analysis.geo_filter import apply_geo_filter
from arena_analysis.context_builder import ContextBuilder, ContextResult
from arena_analysis.web_researcher import ArenaWebResearcher


class CalibrationRequest(BaseModel):
    question: str
    context_text: Optional[str] = None
    geo_filter: Optional[dict] = None  # {state, city}
    mode: str = "batch"  # "batch" (production) or "individual" (1 per call, GPT-only)


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

    client = AsyncOpenAI(api_key=keys[0])
    start = time.time()

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": PRE_CLASSIFY_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0, max_tokens=800,
            response_format={"type": "json_object"},
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
    """Full production pipeline with verbose SSE for calibration."""
    cancelled = asyncio.Event()

    async def _watch_disconnect():
        while not cancelled.is_set():
            if await raw_request.is_disconnected():
                cancelled.set()
                return
            await asyncio.sleep(1)

    disconnect_task = asyncio.create_task(_watch_disconnect())
    web_researcher = ArenaWebResearcher()
    context_builder = ContextBuilder()
    persona_loop = PersonaLoop()

    async def generate():
        start_time = time.time()

        # ── STEP 1: Start ──
        yield sse_event("cal_start", {"question": request.question})

        # ── STEP 2: Web Research (ALWAYS, same as production) ──
        yield sse_event("cal_step", {
            "step": "web_research", "status": "running",
            "label": "Pesquisa na Web",
            "description": "Buscando contexto factual via Tavily Search...",
        })

        web_start = time.time()
        web_result = await web_researcher.research(request.question)
        web_ms = round((time.time() - web_start) * 1000)

        yield sse_event("cal_step_detail", {
            "step": "web_research",
            "status": "complete",
            "latency_ms": web_ms,
            "input": {
                "queries": web_result.queries,
            },
            "output": {
                "snippets": web_result.snippets,
                "sources": web_result.sources,
                "combined_context": web_result.combined_context[:5000],
            },
        })

        # ── STEP 3: Context Builder (Claude builds factual context) ──
        context = None

        if request.context_text:
            # Media context provided — use directly
            context = ContextResult(
                tema="Contexto de midia",
                contexto=request.context_text,
            )
            # Still do web research to complement
            if web_result.combined_context:
                ctx_start = time.time()
                web_ctx = await context_builder.build(
                    question=request.question,
                    web_context=web_result.combined_context,
                )
                if web_ctx.contexto:
                    context.contexto += f"\n\n--- Contexto web complementar ---\n{web_ctx.contexto}"

            yield sse_event("cal_step", {
                "step": "context_builder", "status": "complete",
                "label": "Construcao de Contexto",
                "description": "Contexto de midia recebido + web complementar",
            })
            yield sse_event("cal_step_detail", {
                "step": "context_builder",
                "status": "complete",
                "output": {
                    "tema": context.tema,
                    "contexto": context.contexto[:5000],
                    "figuras": context.figuras,
                    "periodo": context.periodo,
                },
            })
        else:
            # Build context from web research (production flow)
            yield sse_event("cal_step", {
                "step": "context_builder", "status": "running",
                "label": "Construcao de Contexto",
                "description": "Claude esta gerando contexto factual a partir da pesquisa web...",
            })

            ctx_start = time.time()
            context = await context_builder.build(
                question=request.question,
                web_context=web_result.combined_context,
            )
            ctx_ms = round((time.time() - ctx_start) * 1000)

            yield sse_event("cal_step_detail", {
                "step": "context_builder",
                "status": "complete",
                "latency_ms": ctx_ms,
                "tokens": context.prompt_tokens + context.output_tokens,
                "input": {
                    "question": request.question,
                    "web_context": web_result.combined_context[:3000],
                },
                "output": {
                    "tema": context.tema,
                    "contexto": context.contexto[:5000],
                    "figuras": context.figuras,
                    "periodo": context.periodo,
                    "raw_text": context.raw_text[:3000],
                },
            })

        # ── STEP 4: Ideological Frame ──
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

        # ── STEP 5: Load + Filter Personas ──
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

        # ── STEP 6: Pre-Classification (Semantic analysis) ──
        yield sse_event("cal_step", {
            "step": "pre_classifier", "status": "running",
            "label": "Pre-Classificacao Semantica",
            "description": "GPT-4o-mini analisa semantica da pergunta...",
        })

        pre_result = await _pre_classify_verbose(request.question, request.context_text)
        pre_class = pre_result["result"]
        disambiguation = build_disambiguation_block(pre_class)

        # Inject disambiguation into context
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

        # ── STEP 7: Prompt Sample Preview ──
        system_prompt = await get_arena_system_prompt()
        bias = await load_bias_config()

        if total > 0:
            sample_batch = personas[:min(settings.batch_size, total)]
            sample_user_prompt = build_batch_prompt(request.question, context, sample_batch, bias=bias)

            yield sse_event("cal_step", {
                "step": "prompt_preview", "status": "complete",
                "label": "Preview do Prompt",
                "description": f"Prompt real que sera enviado para cada batch de {settings.batch_size} personas",
            })
            yield sse_event("cal_step_detail", {
                "step": "prompt_preview",
                "status": "complete",
                "input": {
                    "system_prompt": system_prompt[:8000],
                    "user_prompt": sample_user_prompt[:15000],
                    "persona_count": len(sample_batch),
                    "batch_size": settings.batch_size,
                    "model_split": f"{int(settings.claude_share*100)}% Claude / {int((1-settings.claude_share)*100)}% GPT",
                },
            })

        if cancelled.is_set():
            return

        # ── STEP 8: Persona Processing Loop ──
        has_political_figures = any(
            f.get("stance") in ("attack", "defense")
            for f in pre_class.get("figures", [])
        )

        mode_desc = f"individual (1 por call, GPT-only, 3 chaves)" if is_individual else f"batch de {settings.batch_size}"
        yield sse_event("cal_step", {
            "step": "persona_loop", "status": "running",
            "label": "Processamento de Personas",
            "description": f"Processando {total} personas — modo {mode_desc}",
        })

        all_results = []
        inc_personas = []
        inc_results = []
        batch_index = 0
        last_segment_count = 0

        is_individual = request.mode == "individual"

        async for progress in persona_loop.run(
            request.question, context, personas,
            verbose=True, cancelled=cancelled,
            skip_political_enforcement=has_political_figures,
            individual_mode=is_individual,
        ):
            all_results.extend(progress.results)
            inc_personas.extend(progress.personas)
            inc_results.extend(progress.results)

            # Batch detail with per-persona results + full profile
            persona_details = []
            batch_personas_raw = progress.personas  # full persona dicts from DB
            if progress.batch_meta:
                summaries = progress.batch_meta.get("personas_summary", [])
                for idx_p, ps in enumerate(summaries):
                    # Get full profile from the raw persona data
                    full_profile = batch_personas_raw[idx_p] if idx_p < len(batch_personas_raw) else {}
                    persona_details.append({
                        "id": ps.get("id", "?"),
                        "name": ps.get("name", "?"),
                        "state": full_profile.get("state", ps.get("state", "?")),
                        "age": full_profile.get("age", ps.get("age", 0)),
                        "sentiment": ps.get("sentiment", "neutral"),
                        "score": ps.get("score", 5.0),
                        "comment": ps.get("comment", "")[:300],
                        # Full profile for drill-down
                        "profile": {
                            "gender": full_profile.get("gender_identity") or full_profile.get("gender"),
                            "region": full_profile.get("region_br"),
                            "city": full_profile.get("city"),
                            "education": full_profile.get("education_level"),
                            "generation": full_profile.get("generation"),
                            "social_class": full_profile.get("social_class"),
                            "religion": full_profile.get("macro_religion"),
                            "race": full_profile.get("raca_cor"),
                            "political_leaning": full_profile.get("political_leaning"),
                            "archetype": full_profile.get("archetype_primary"),
                            "cluster": full_profile.get("cluster_id"),
                            "cluster_name": full_profile.get("nome_grupo"),
                            "score_eco": full_profile.get("score_economico"),
                            "score_cost": full_profile.get("score_costumes"),
                            "voto_2022": full_profile.get("voto_2022"),
                            "voto_2026": full_profile.get("voto_2026"),
                            "aprovacao_lula": full_profile.get("aprovacao_lula"),
                            "avaliacao_bolsonaro": full_profile.get("q_avaliacao_bolsonaro"),
                            # All career/demographic/psychology/beliefs JSON
                            "career": full_profile.get("career_json"),
                            "demographic": full_profile.get("demographic_json"),
                            "psychology": full_profile.get("psychology_json"),
                            "beliefs": full_profile.get("beliefs_json"),
                        },
                    })

            batch_total = (total + settings.batch_size - 1) // settings.batch_size

            yield sse_event("cal_batch", {
                "batch_index": batch_index,
                "batch_total": batch_total,
                "model": progress.batch_meta.get("model", "?") if progress.batch_meta else "?",
                "persona_count": progress.batch_meta.get("persona_count", 0) if progress.batch_meta else len(progress.results),
                "personas": persona_details,
            })

            # Progress with scores
            avg_score = round(progress.score_sum / progress.processed, 1) if progress.processed > 0 else 5.0

            # Segments periodically
            segments = None
            threshold = 50 if last_segment_count == 0 else 200
            if progress.processed - last_segment_count >= threshold or progress.processed == progress.total:
                try:
                    agg = await asyncio.to_thread(
                        aggregate_results, inc_personas, inc_results, request.question
                    )
                    segments = agg.get("segments")
                    last_segment_count = progress.processed
                except Exception:
                    pass

            yield sse_event("cal_progress", {
                "processed": progress.processed,
                "total": progress.total,
                "positive": progress.positive,
                "negative": progress.negative,
                "neutral": progress.neutral,
                "avgScore": avg_score,
                "scoreSum": progress.score_sum,
                "segments": segments,
            })

            batch_index += 1
            if cancelled.is_set():
                break

        # ── STEP 9: Aggregation ──
        yield sse_event("cal_step", {
            "step": "aggregation", "status": "running",
            "label": "Agregacao de Resultados",
            "description": "Agregando sentimentos, segmentos e comentarios...",
        })

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
        avg_score = round(sum(r.score for r in all_results) / len(all_results), 2) if all_results else 5.0

        yield sse_event("cal_step_detail", {
            "step": "aggregation", "status": "complete",
            "output": {
                "total": len(all_results),
                "positive": pos, "negative": neg, "neutral": neu,
                "avgScore": avg_score,
                "segments": segments,
            },
        })

        # ── STEP 10: Done ──
        yield sse_event("cal_results", {
            "total": len(all_results),
            "positive": pos, "negative": neg, "neutral": neu,
            "avgScore": avg_score,
            "processing_time_ms": round(elapsed * 1000),
            "segments": segments,
        })

        yield sse_event("cal_done", {
            "total_personas": len(all_results),
            "processing_time_ms": round(elapsed * 1000),
            "avgScore": avg_score,
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
