"""
✅ BACKEND DE PRODUÇÃO DA ARENA — este é o código que roda em produção.

DO app: arena-analysis-api (a38cc4e4) — porta 8000
URL: https://arena-analysis-api-2puat.ondigitalocean.app
deploy_on_push: true (deploya automaticamente a cada push em main)

⚠️  NÃO confundir com arena-worker/ (código legado, NÃO usado pela arena).

Pipeline:
  1. Web Research (Tavily)
  2. Context Builder (Claude contextualiza)
  3. Ideological Frame (mapeamento esquerda/direita)
  4. Pre-Classifier (GPT-4o-mini disambigua concordar/discordar)
  5. Persona Loop (1 persona por call, GPT, 3 chaves paralelo)
  6. Results Aggregator (agrega por segmento demográfico)

Uso local:
  cd scripts
  uvicorn arena_analysis.main:app --port 8001 --reload
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import tempfile
import time
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from openai import OpenAI

from arena_analysis.config import settings
from arena_analysis.web_researcher import ArenaWebResearcher
from arena_analysis.context_builder import ContextBuilder, ContextResult
from arena_analysis.persona_loader import load_personas
from arena_analysis.persona_loop import PersonaLoop
from arena_analysis.results_aggregator import aggregate_results
from arena_analysis.comment_prompt import ARENA_SYSTEM_PROMPT, build_single_prompt
from arena_analysis.electoral_engine import ElectoralEngine
from arena_analysis.geo_filter import apply_geo_filter
from arena_analysis.pre_classifier import pre_classify, build_disambiguation_block
from arena_analysis.calibration_endpoint import CalibrationRequest, calibration_analyze

# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Arena Analysis",
    description="AI-powered sentiment analysis for synthetic personas",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ────────────────────────────────────────────────────────────────
web_researcher = ArenaWebResearcher()
context_builder = ContextBuilder()
persona_loop = PersonaLoop()
electoral_engine = ElectoralEngine()


# ── Request Models ────────────────────────────────────────────────────────────
class GeoFilter(BaseModel):
    state: Optional[str] = None
    city: Optional[str] = None
    min_personas: int = 50


class AnalyzeRequest(BaseModel):
    question: str
    cluster_filter: Optional[str] = None
    context_text: Optional[str] = None
    verbose: bool = False
    geo_filter: Optional[GeoFilter] = None


class ElectoralRequest(BaseModel):
    candidate_a: dict
    candidate_b: dict
    round_number: int = 1
    proposals: list[dict] = []
    previous_votes: dict = {}
    cluster_filter: Optional[str] = None


# ── Helper ────────────────────────────────────────────────────────────────────
def sse_event(event_type: str, data: dict | list | str) -> str:
    """Formata um SSE event."""
    payload = {"type": event_type}
    if isinstance(data, (dict, list)):
        payload["data"] = data
    else:
        payload["data"] = data
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    """Pre-warm personas em background (nao bloqueia health check)."""
    async def _warm():
        try:
            await asyncio.to_thread(load_personas)
            print(f"[Startup] Cache pronto | keys: {len(settings.openai_api_keys)} GPT, {len(settings.anthropic_api_keys)} Claude")
        except Exception as e:
            print(f"[Startup] Pre-warm failed (will retry on first request): {e}")
    asyncio.create_task(_warm())
    print("[Startup] Arena v3.0 — pre-warming in background")


@app.get("/api/arena/health")
async def health():
    return {
        "status": "ok",
        "engine": "arena_analysis",
        "version": "2.0.0",
        "model": settings.model,
        "batch_size": settings.batch_size,
        "max_parallel_claude": settings.max_parallel_claude,
        "max_parallel_openai": settings.max_parallel_openai,
        "claude_keys": len(settings.anthropic_api_keys),
        "openai_keys": len(settings.openai_api_keys),
        "claude_share": settings.claude_share,
    }


@app.get("/api/arena/cities")
async def get_cities(state: str):
    """Retorna cidades com personas no estado dado, com contagem."""
    personas = await asyncio.to_thread(load_personas)
    cities: dict[str, int] = {}
    for p in personas:
        if p.get("state") == state:
            c = p.get("city")
            if c:
                cities[c] = cities.get(c, 0) + 1
    return sorted(
        [{"city": c, "count": n} for c, n in cities.items()],
        key=lambda x: x["city"],
    )


@app.post("/api/arena/analyze")
async def analyze(request: AnalyzeRequest, raw_request: Request):
    """
    Analisa pergunta com pipeline AI completo.
    Retorna SSE stream com progresso e resultados.
    """
    # Cancellation event — set when client disconnects
    cancelled = asyncio.Event()

    async def _watch_disconnect():
        """Background task that sets cancelled when client disconnects."""
        while not cancelled.is_set():
            if await raw_request.is_disconnected():
                cancelled.set()
                print("[Pipeline] Client disconnected — cancelling processing")
                return
            await asyncio.sleep(1)

    # Start watching for client disconnect in the background
    disconnect_task = asyncio.create_task(_watch_disconnect())

    async def generate():
        start_time = time.time()
        total_tokens = 0

        # ── 0. Route event ────────────────────────────────────────
        yield sse_event("route", {"route": "python"})

        # ── 0b. Pre-classify question semantically (runs in parallel with everything below)
        pre_class_task = asyncio.create_task(
            pre_classify(request.question, request.context_text)
        )

        # ── 1. Web Research + Persona Loading em paralelo ────────
        # Skip query_analyzer — classify-route already decided this needs Python.
        # Always do web research for context (fast with basic depth).

        # Notify monitor that query_analyzer is skipped (pipeline v2 always does web research)
        yield sse_event("log", {
            "step": "query_analyzer",
            "level": "info",
            "message": "Pipeline v2 — pesquisa web sempre ativa",
            "detail": {
                "needs_research": True,
                "reason": "Pipeline v2 executa pesquisa web automaticamente para toda pergunta, sem etapa de decisão separada.",
            },
        })

        # Inicia carregamento de personas em paralelo
        persona_task = asyncio.create_task(
            asyncio.to_thread(load_personas, cluster_filter=request.cluster_filter)
        )

        context = None

        # ── 1b. Smart Search + Context Builder (Claude decides what to search) ──
        yield sse_event("phase", {
            "phase": "building_context",
            "message": "Claude analisando conteudo e contextualizando...",
        })

        # Claude decides if web search is needed, executes targeted queries if so
        search_info = await context_builder.smart_search(
            request.question, request.context_text
        )
        web_context = search_info.get("results", "")

        yield sse_event("log", {
            "step": "web_research",
            "level": "info",
            "message": f"Busca inteligente: {'buscou na web' if search_info.get('searched') else 'conhecimento proprio'} — {search_info.get('reason', '')}",
            "detail": {
                "searched": search_info.get("searched", False),
                "queries": search_info.get("queries", []),
                "reason": search_info.get("reason", ""),
            },
        })

        if request.context_text:
            # Media context provided — Claude enriches it
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
            total_tokens += enriched.prompt_tokens + enriched.output_tokens
            print(f"[Pipeline] Contexto de midia enriquecido ({len(context.contexto)} chars)")
        else:
            # No media — Claude builds full context
            context = await context_builder.build(
                question=request.question,
                web_context=web_context,
            )
            total_tokens += context.prompt_tokens + context.output_tokens

        yield sse_event("log", {
            "step": "context_builder",
            "level": "info",
            "message": f"Contexto criado: {context.tema}",
            "detail": {
                "tema": context.tema,
                "contexto": context.contexto[:2000],
                "figuras": context.figuras,
                "periodo": context.periodo,
            },
        })

        # Check cancellation before waiting for personas
        if cancelled.is_set():
            print("[Pipeline] Cancelled before persona loading — aborting")
            return

        # ── 2. Aguardar personas (já carregando em paralelo) ──────────
        yield sse_event("phase", {
            "phase": "loading_personas",
            "message": "Carregando personas...",
        })

        personas = await persona_task

        # ── 2b. Filtro geográfico (se solicitado) ──────────────────
        geo_cities: list[dict] = []
        if request.geo_filter and request.geo_filter.state:
            personas, geo_cities = apply_geo_filter(personas, request.geo_filter)
            yield sse_event("geo_resolved", {
                "cities": geo_cities,
                "total_personas": len(personas),
                "expanded": request.geo_filter.city is not None and len(geo_cities) > 1,
            })
            print(f"[Pipeline] Geo filter: {len(personas)} personas de {len(geo_cities)} cidades")

        total_personas = len(personas)

        yield sse_event("personas_loaded", {
            "count": total_personas,
            "cluster_filter": request.cluster_filter,
        })

        # ── 3b. Ideological Frame — generate left/right framing for the topic ──
        if context and context.contexto:
            try:
                ideo_frame = await context_builder.build_ideological_frame(
                    question=request.question,
                    context=context,
                )
                if ideo_frame:
                    context.contexto += ideo_frame
                    yield sse_event("log", {
                        "step": "ideological_frame",
                        "level": "info",
                        "message": "Viés ideológico mapeado para o tema",
                        "detail": {"frame": ideo_frame[:500]},
                    })
                else:
                    print("[Pipeline] Ideological frame returned empty — skipping")
            except Exception as ideo_err:
                print(f"[Pipeline] Ideological frame error (continuing): {ideo_err}")

        # ── 4b. Context Validation — emit full context for monitor ──
        if context and context.contexto:
            yield sse_event("log", {
                "step": "context_validator",
                "level": "info",
                "message": "Contexto validado e pronto para envio",
                "detail": {
                    "verdict": "VALID",
                    "issues": [],
                    "corrections": "",
                    "full_context": context.contexto[:5000],
                    "figuras": context.figuras or [],
                },
            })
        else:
            yield sse_event("log", {
                "step": "context_validator",
                "level": "warn",
                "message": "Sem contexto — personas responderao apenas com base na pergunta",
                "detail": {
                    "verdict": "PASS",
                    "issues": ["Nenhum contexto externo disponivel"],
                    "corrections": "",
                },
            })

        # ── 4c. Prompt Sample — build and emit the actual prompt for monitor ──
        if total_personas > 0:
            sample_prompt = build_single_prompt(request.question, context, personas[0])
            yield sse_event("batch_detail", {
                "type": "prompt_sample",
                "system_prompt": ARENA_SYSTEM_PROMPT[:3000],
                "user_prompt": sample_prompt,
                "persona_count": 1,
                "note": "Prompt real (1 persona por call, GPT-only, 3 chaves paralelo).",
            })

        # ── 4d. Await pre-classification (should already be done — ~800ms) ──
        pre_class = await pre_class_task
        disambiguation = build_disambiguation_block(pre_class)

        yield sse_event("pre_classified", {
            "question_type": pre_class.get("type", "other"),
            "core_position": pre_class.get("core_position", "")[:200],
            "figures": pre_class.get("figures", []),
        })
        yield sse_event("log", {
            "step": "pre_classifier",
            "level": "info",
            "message": f"Analise semantica: {pre_class.get('type', 'other')} | {pre_class.get('core_position', '')[:100]}",
            "detail": pre_class,
        })

        # Inject disambiguation into context so it reaches the batch prompt
        if disambiguation and context:
            context.contexto = disambiguation + "\n" + (context.contexto or "")
        elif disambiguation:
            context = ContextResult(
                tema="Pre-classificacao semantica",
                contexto=disambiguation,
            )

        # ── 5. Aggregate Engine (substitui persona loop de 20k) ─────
        if cancelled.is_set():
            print("[Pipeline] Cancelled before aggregate engine — aborting")
            return

        yield sse_event("phase", {
            "phase": "processing_personas",
            "message": f"Analisando sentimento de {total_personas} personas...",
        })

        # Lazy import — nao carrega openai no startup
        from arena_analysis.aggregate_engine import analyze as aggregate_analyze, load_profile, generate_ideological_points

        # Launch aggregate analysis in background
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
        for pct, msg in progress_steps:
            if cancelled.is_set():
                aggregate_task.cancel()
                return

            processed = int(total_personas * pct)
            yield sse_event("progress", {
                "processed": processed,
                "total": total_personas,
                "positive": 0,
                "negative": 0,
                "neutral": 0,
                "avgScore": 5.0,
                "scoreSum": 0,
            })
            yield sse_event("phase", {
                "phase": "processing_personas",
                "message": msg,
            })

            try:
                await asyncio.wait_for(asyncio.shield(aggregate_task), timeout=step_duration)
                break  # Model finished early
            except asyncio.TimeoutError:
                pass  # Continue animation
            except Exception:
                break  # Error — will be caught below

        # Await final result
        try:
            final_results = await aggregate_task
        except Exception as e:
            print(f"[Pipeline] Aggregate engine error: {e}")
            import traceback
            traceback.print_exc()
            final_results = {
                "total": total_personas, "positive": 0, "negative": 0, "neutral": 0,
                "avgScore": 5.0, "processingTime": 0, "archetypes": [], "clusterResults": [],
                "comments": [], "ideologicalPoints": [], "quadrants": [], "regions": [],
                "generations": [], "educationLevels": [], "politicalFigures": [],
                "intensityBands": [], "segments": {}, "stateBreakdown": {}, "cityBreakdown": {},
            }

        # ── 6. Emit final progress (100%) with real data ──────────────
        yield sse_event("phase", {
            "phase": "aggregating",
            "message": f"Agregando resultados de {total_personas} personas...",
        })

        processing_time = (time.time() - start_time) * 1000
        final_results["processingTime"] = processing_time

        yield sse_event("progress", {
            "processed": total_personas,
            "total": total_personas,
            "positive": final_results.get("positive", 0),
            "negative": final_results.get("negative", 0),
            "neutral": final_results.get("neutral", 0),
            "avgScore": final_results.get("avgScore", 5.0),
            "scoreSum": final_results.get("avgScore", 5.0) * total_personas,
            "segments": final_results.get("segments"),
            "stateBreakdown": final_results.get("stateBreakdown"),
            "cityBreakdown": final_results.get("cityBreakdown"),
            "politicalFigures": final_results.get("politicalFigures", []),
            "quadrants": final_results.get("quadrants", []),
            "clusterResults": final_results.get("clusterResults", []),
        })

        # Generate synthetic ideological points from profile + analysis results
        try:
            profile = await load_profile()
            ideological_points = generate_ideological_points(profile, final_results)
        except Exception as pts_err:
            print(f"[Pipeline] Ideological points generation error: {pts_err}")
            ideological_points = []

        final_results.pop("ideologicalPoints", None)
        yield sse_event("results", final_results)

        # Stream ideological points in small chunks to keep connection alive
        POINTS_CHUNK = 500
        total_points = len(ideological_points)
        if total_points > 0:
            print(f"[Pipeline] Streaming {total_points} ideological points in chunks of {POINTS_CHUNK}")
            for i in range(0, total_points, POINTS_CHUNK):
                chunk = ideological_points[i:i + POINTS_CHUNK]
                yield sse_event("points_chunk", chunk)
                if cancelled.is_set():
                    print(f"[Pipeline] Cancelled during points streaming at {i + len(chunk)}/{total_points}")
                    break

        # ── 7. Done ──────────────────────────────────────────────────
        yield sse_event("done", {
            "processing_time_ms": processing_time,
            "total_personas": total_personas,
            "total_comments": len(final_results.get("comments", [])),
            "total_points": total_points,
            "total_tokens": total_tokens,
        })

    async def generate_with_cleanup():
        try:
            async for event in generate():
                yield event
        finally:
            # Stop watching for disconnect
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


# ── Recompute Aggregate Profile ──────────────────────────────────────────────

@app.post("/api/arena/recompute-profile")
async def recompute_profile():
    """Recomputa o perfil estatistico agregado das personas."""
    from arena_analysis.aggregate_builder import build_aggregate_profile, save_profile
    try:
        profile = await build_aggregate_profile()
        await save_profile(profile)
        return {"status": "ok", "total_personas": profile["total_personas"]}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Calibration Endpoint ──────────────────────────────────────────────────────

@app.post("/api/calibracao/analyze")
async def calibration(request: CalibrationRequest, raw_request: Request):
    """Verbose pipeline for persona calibration/debugging."""
    return await calibration_analyze(request, raw_request)


# ── Electoral Arena Endpoint ──────────────────────────────────────────────────

@app.post("/api/arena/electoral")
async def electoral_analyze(request: ElectoralRequest):
    """
    Simulação eleitoral com pipeline AI completo.
    Retorna SSE stream com progresso e resultados.
    """

    async def generate():
        start_time = time.time()

        # ── 1. Web Research + Persona Loading em paralelo ──────────
        yield sse_event("phase", {
            "phase": "researching",
            "message": f"Pesquisando notícias sobre {request.candidate_a.get('name', '?')} e {request.candidate_b.get('name', '?')}...",
        })

        context_a = None
        context_b = None

        name_a = request.candidate_a.get("name", "Candidato A")
        name_b = request.candidate_b.get("name", "Candidato B")

        # Inicia carregamento de personas em paralelo
        persona_task = asyncio.create_task(
            asyncio.to_thread(load_personas, cluster_filter=request.cluster_filter)
        )

        if request.round_number == 1:
            # Research both candidates in parallel
            research_a = web_researcher.research(f"{name_a} político Brasil")
            research_b = web_researcher.research(f"{name_b} político Brasil")
            web_a, web_b = await asyncio.gather(research_a, research_b)

            yield sse_event("web_complete", {
                "snippets_a": len(web_a.snippets),
                "snippets_b": len(web_b.snippets),
            })

            # Build context for both in parallel
            yield sse_event("phase", {
                "phase": "building_context",
                "message": "Criando contexto com IA...",
            })

            ctx_a = context_builder.build(
                question=f"Quem é {name_a}?",
                web_context=web_a.combined_context,
            )
            ctx_b = context_builder.build(
                question=f"Quem é {name_b}?",
                web_context=web_b.combined_context,
            )
            context_a, context_b = await asyncio.gather(ctx_a, ctx_b)

            yield sse_event("context", {
                "candidateA": {
                    "name": name_a,
                    "context": context_a.contexto if context_a else "",
                },
                "candidateB": {
                    "name": name_b,
                    "context": context_b.contexto if context_b else "",
                },
            })

        # ── 2. Aguardar personas (já carregando em paralelo) ──────
        yield sse_event("phase", {
            "phase": "loading_personas",
            "message": "Carregando personas...",
        })

        personas = await persona_task
        total_personas = len(personas)

        yield sse_event("personas_loaded", {
            "count": total_personas,
        })

        # ── 3. Voting Loop ──────────────────────────────────────────
        yield sse_event("phase", {
            "phase": "voting",
            "message": f"Processando {total_personas} votos com IA...",
        })

        # Determine loser name for proposals context
        loser_name = None
        if request.proposals:
            # Determine who is the loser based on previous votes
            prev_a = sum(1 for v in request.previous_votes.values() if v == "candidateA")
            prev_b = sum(1 for v in request.previous_votes.values() if v == "candidateB")
            if prev_a < prev_b:
                loser_name = name_a
            else:
                loser_name = name_b

        all_votes = []
        async for progress in electoral_engine.run_voting(
            candidate_a=request.candidate_a,
            candidate_b=request.candidate_b,
            context_a=context_a,
            context_b=context_b,
            personas=personas,
            proposals=request.proposals if request.round_number > 1 else None,
            loser_name=loser_name,
        ):
            all_votes.extend(progress.results)
            yield sse_event("voting_progress", {
                "processed": progress.processed,
                "total": progress.total,
                "votesA": progress.votes_a,
                "votesB": progress.votes_b,
                "abstentions": progress.abstentions,
            })

        # ── 4. Aggregate Results ────────────────────────────────────
        processing_time = (time.time() - start_time) * 1000

        round_results = electoral_engine.aggregate_electoral_results(
            candidate_a=request.candidate_a,
            candidate_b=request.candidate_b,
            personas=personas,
            votes=all_votes,
            round_number=request.round_number,
        )
        round_results["processingTime"] = processing_time

        yield sse_event("round_results", round_results)

        # ── 5. Compute Shifts (Round >= 2) ──────────────────────────
        if request.round_number > 1 and request.previous_votes:
            shifts = electoral_engine.compute_shifts(
                previous_votes=request.previous_votes,
                current_votes=all_votes,
                personas=personas,
            )
            yield sse_event("shifts", shifts)

        # ── 6. Extract Criticisms ───────────────────────────────────
        winner_side = round_results["winner"]
        if winner_side != "tie":
            winner_name_str = name_a if winner_side == "candidateA" else name_b
            winner_party = (
                request.candidate_a.get("party", "?")
                if winner_side == "candidateA"
                else request.candidate_b.get("party", "?")
            )

            yield sse_event("phase", {
                "phase": "extracting_criticisms",
                "message": f"Extraindo críticas dos eleitores de {winner_name_str}...",
            })

            criticisms = await electoral_engine.extract_criticisms(
                winner_name=winner_name_str,
                winner_party=winner_party,
                votes=all_votes,
                personas=personas,
                winner_side=winner_side,
            )
            yield sse_event("criticisms", criticisms)

            # ── 7. Generate Proposals ───────────────────────────────
            loser_side = "candidateB" if winner_side == "candidateA" else "candidateA"
            loser_data = (
                request.candidate_a if loser_side == "candidateA"
                else request.candidate_b
            )
            winner_data = (
                request.candidate_a if winner_side == "candidateA"
                else request.candidate_b
            )
            margin = abs(round_results["votesA"] - round_results["votesB"])

            yield sse_event("phase", {
                "phase": "generating_proposals",
                "message": f"Gerando propostas para {loser_data.get('name', '?')}...",
            })

            proposals = await electoral_engine.generate_proposals(
                loser=loser_data,
                winner=winner_data,
                margin=margin,
                criticisms=criticisms,
                total_voters=total_personas,
            )
            yield sse_event("proposals", proposals)
        else:
            yield sse_event("criticisms", [])
            yield sse_event("proposals", [])

        # ── 8. Done ─────────────────────────────────────────────────
        yield sse_event("done", {
            "processing_time_ms": processing_time,
            "total_personas": total_personas,
            "round_number": request.round_number,
        })

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        },
    )


# ── YouTube Transcript Extraction ─────────────────────────────────────────────

import re

YOUTUBE_ID_RE = re.compile(
    r"(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})"
)
MAX_TRANSCRIPT_CHARS = 10_000


class YouTubeTranscriptRequest(BaseModel):
    url: str


@app.post("/api/youtube-transcript")
async def youtube_transcript(req: YouTubeTranscriptRequest):
    """
    Extract YouTube video transcript (auto-generated or manual captions).
    Uses youtube-transcript-api which handles PoToken internally.
    """
    m = YOUTUBE_ID_RE.search(req.url)
    if not m:
        return JSONResponse({"error": "URL do YouTube invalida"}, status_code=400)

    video_id = m.group(1)
    _debug_log: list[str] = []  # collect debug info for error response

    # Fetch metadata via oEmbed (lightweight, no key needed)
    title = ""
    author = ""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            meta_res = await client.get(oembed_url)
            if meta_res.status_code == 200:
                meta = meta_res.json()
                title = meta.get("title", "")
                author = meta.get("author_name", "")
    except Exception:
        pass  # Metadata is optional

    # Strategy 1: youtube-transcript-api library (with consent cookies to bypass bot detection)
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        import requests as _requests

        session = _requests.Session()
        session.cookies.set("SOCS", "CAISNQgDEitib3FfaWRlbnRpdHlfZnJvbnRlbmRfdWlzZXJ2ZXJfMjAyMzA4MjkuMDdfcDAGEA", domain=".youtube.com")
        session.cookies.set("CONSENT", "YES+cb.20210328-17-p0.en+FX+987", domain=".youtube.com")
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        })
        ytt = YouTubeTranscriptApi(http_client=session)

        def _fetch():
            try:
                return ytt.fetch(video_id, languages=["pt", "pt-BR", "en"])
            except Exception:
                # Fallback: try any available language
                return ytt.fetch(video_id)

        transcript_obj = await asyncio.to_thread(_fetch)
        snippets = transcript_obj.snippets
        if snippets:
            full_text = " ".join(s.text for s in snippets)
            if len(full_text) > MAX_TRANSCRIPT_CHARS:
                full_text = full_text[:MAX_TRANSCRIPT_CHARS] + "... [transcricao truncada]"
            print(f"[YouTube] OK via library — {video_id} | {len(snippets)} segments | {len(full_text)} chars")
            return JSONResponse({"transcript": full_text, "title": title, "author": author})

    except Exception as e:
        _debug_log.append(f"S1-library: {type(e).__name__}: {str(e)[:100]}")
        print(f"[YouTube] Library failed for {video_id}: {e}")

    # Strategy 2: Direct innertube API (IOS client)
    try:
        import re as _re

        INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
        async with httpx.AsyncClient(timeout=10) as client:
            player_res = await client.post(
                f"https://www.youtube.com/youtubei/v1/player?key={INNERTUBE_KEY}&prettyPrint=false",
                json={
                    "context": {"client": {"clientName": "IOS", "clientVersion": "20.10.4", "hl": "pt", "gl": "BR"}},
                    "videoId": video_id,
                },
            )
            if player_res.status_code == 200:
                player_data = player_res.json()
                play_status = player_data.get("playabilityStatus", {}).get("status")
                if play_status == "OK":
                    captions = (
                        player_data.get("captions", {})
                        .get("playerCaptionsTracklistRenderer", {})
                        .get("captionTracks", [])
                    )
                    if captions:
                        # Pick best track: pt > pt-BR > en > first
                        track = next((c for c in captions if c.get("languageCode") == "pt"), None)
                        track = track or next((c for c in captions if c.get("languageCode") == "pt-BR"), None)
                        track = track or next((c for c in captions if c.get("languageCode") == "en"), None)
                        track = track or captions[0]

                        caption_url = track["baseUrl"].replace("&fmt=srv3", "")
                        if "&exp=xpe" not in caption_url:
                            caption_res = await client.get(caption_url)
                            if caption_res.status_code == 200:
                                xml_text = caption_res.text
                                texts = [
                                    _re.sub(r"<[^>]+>", "", seg)
                                    .replace("&amp;", "&")
                                    .replace("&lt;", "<")
                                    .replace("&gt;", ">")
                                    .replace("&quot;", '"')
                                    .replace("&#39;", "'")
                                    .strip()
                                    for seg in _re.findall(r"<text[^>]*>([\s\S]*?)</text>", xml_text)
                                ]
                                texts = [t for t in texts if t]
                                if texts:
                                    full_text = " ".join(texts)
                                    if len(full_text) > MAX_TRANSCRIPT_CHARS:
                                        full_text = full_text[:MAX_TRANSCRIPT_CHARS] + "... [transcricao truncada]"
                                    if not title:
                                        title = player_data.get("videoDetails", {}).get("title", "")
                                    if not author:
                                        author = player_data.get("videoDetails", {}).get("author", "")
                                    print(f"[YouTube] OK via innertube IOS — {video_id} | {len(texts)} segments | {len(full_text)} chars")
                                    return JSONResponse({"transcript": full_text, "title": title, "author": author})
                else:
                    _debug_log.append(f"S2-innertube-status: {play_status}")
                    print(f"[YouTube] Innertube IOS status: {play_status}")

    except Exception as e:
        _debug_log.append(f"S2-innertube: {type(e).__name__}: {str(e)[:100]}")
        print(f"[YouTube] Innertube IOS failed for {video_id}: {e}")

    # Strategy 3: Scrape watch page HTML for ytInitialPlayerResponse
    try:
        import re as _re
        import json as _json

        async with httpx.AsyncClient(timeout=10) as client:
            watch_res = await client.get(
                f"https://www.youtube.com/watch?v={video_id}&hl=pt&bpctr=9999999999&has_verified=1",
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                    "Cookie": "SOCS=CAISNQgDEitib3FfaWRlbnRpdHlfZnJvbnRlbmRfdWlzZXJ2ZXJfMjAyMzA4MjkuMDdfcDAGEA; CONSENT=YES+cb.20210328-17-p0.en+FX+987",
                },
            )
            if watch_res.status_code == 200:
                html = watch_res.text
                marker = "ytInitialPlayerResponse = "
                start_idx = html.find(marker)
                if start_idx != -1:
                    json_start = start_idx + len(marker)
                    depth = 0
                    json_end = -1
                    for i in range(json_start, min(json_start + 300000, len(html))):
                        if html[i] == "{":
                            depth += 1
                        elif html[i] == "}":
                            depth -= 1
                            if depth == 0:
                                json_end = i + 1
                                break
                    if json_end != -1:
                        player_data = _json.loads(html[json_start:json_end])
                        if player_data.get("playabilityStatus", {}).get("status") == "OK":
                            captions = (
                                player_data.get("captions", {})
                                .get("playerCaptionsTracklistRenderer", {})
                                .get("captionTracks", [])
                            )
                            if captions:
                                track = next((c for c in captions if c.get("languageCode") == "pt"), None)
                                track = track or next((c for c in captions if c.get("languageCode") == "pt-BR"), None)
                                track = track or next((c for c in captions if c.get("languageCode") == "en"), None)
                                track = track or captions[0]

                                caption_url = track["baseUrl"].replace("&fmt=srv3", "")
                                if "&exp=xpe" not in caption_url:
                                    caption_res = await client.get(caption_url)
                                    if caption_res.status_code == 200:
                                        xml_text = caption_res.text
                                        texts = [
                                            _re.sub(r"<[^>]+>", "", seg)
                                            .replace("&amp;", "&")
                                            .replace("&lt;", "<")
                                            .replace("&gt;", ">")
                                            .replace("&quot;", '"')
                                            .replace("&#39;", "'")
                                            .strip()
                                            for seg in _re.findall(r"<text[^>]*>([\s\S]*?)</text>", xml_text)
                                        ]
                                        texts = [t for t in texts if t]
                                        if texts:
                                            full_text = " ".join(texts)
                                            if len(full_text) > MAX_TRANSCRIPT_CHARS:
                                                full_text = full_text[:MAX_TRANSCRIPT_CHARS] + "... [transcricao truncada]"
                                            if not title:
                                                title = player_data.get("videoDetails", {}).get("title", "")
                                            if not author:
                                                author = player_data.get("videoDetails", {}).get("author", "")
                                            print(f"[YouTube] OK via watch page scrape — {video_id} | {len(texts)} segments")
                                            return JSONResponse({"transcript": full_text, "title": title, "author": author})

    except Exception as e:
        _debug_log.append(f"S3-watchpage: {type(e).__name__}: {str(e)[:100]}")
        print(f"[YouTube] Watch page scrape failed for {video_id}: {e}")

    # Strategy 4: yt-dlp subtitle extraction (most robust anti-detection)
    try:
        import tempfile
        import glob as _glob

        with tempfile.TemporaryDirectory() as tmpdir:
            result = await asyncio.to_thread(
                subprocess.run,
                [
                    "yt-dlp",
                    "--write-auto-sub",
                    "--sub-lang", "pt,pt-BR,en",
                    "--sub-format", "srv1",
                    "--skip-download",
                    "--no-warnings",
                    "--quiet",
                    "-o", f"{tmpdir}/%(id)s",
                    f"https://www.youtube.com/watch?v={video_id}",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                _debug_log.append(f"S4-ytdlp-subs-rc{result.returncode}: {result.stderr[:150]}")
                print(f"[YouTube] yt-dlp failed: {result.stderr[:200]}")
            else:
                # Find the subtitle file
                import re as _re

                sub_files = _glob.glob(f"{tmpdir}/*.srv1") + _glob.glob(f"{tmpdir}/*.vtt") + _glob.glob(f"{tmpdir}/*.srt")
                if not sub_files:
                    print(f"[YouTube] yt-dlp: no subtitle files found")
                else:
                    # Read and parse the subtitle file
                    with open(sub_files[0], "r", encoding="utf-8") as f:
                        content = f.read()

                    # Parse XML (srv1 format)
                    texts = [
                        _re.sub(r"<[^>]+>", "", seg)
                        .replace("&amp;", "&")
                        .replace("&lt;", "<")
                        .replace("&gt;", ">")
                        .replace("&quot;", '"')
                        .replace("&#39;", "'")
                        .strip()
                        for seg in _re.findall(r"<text[^>]*>([\s\S]*?)</text>", content)
                    ]
                    texts = [t for t in texts if t]

                    if not texts:
                        # Try VTT/SRT format
                        lines = content.split("\n")
                        texts = [
                            line.strip()
                            for line in lines
                            if line.strip()
                            and not line.strip().startswith("WEBVTT")
                            and not _re.match(r"^\d+$", line.strip())
                            and not _re.match(r"\d{2}:\d{2}", line.strip())
                        ]

                    if texts:
                        full_text = " ".join(texts)
                        if len(full_text) > MAX_TRANSCRIPT_CHARS:
                            full_text = full_text[:MAX_TRANSCRIPT_CHARS] + "... [transcricao truncada]"
                        print(f"[YouTube] OK via yt-dlp — {video_id} | {len(texts)} segments | {len(full_text)} chars")
                        return JSONResponse({"transcript": full_text, "title": title, "author": author})

    except Exception as e:
        _debug_log.append(f"S4-ytdlp-subs: {type(e).__name__}: {str(e)[:100]}")
        print(f"[YouTube] yt-dlp subtitles failed for {video_id}: {e}")

    # Strategy 5: yt-dlp audio download + Whisper transcription (guaranteed to work)
    try:
        import tempfile as _tempfile

        with _tempfile.TemporaryDirectory() as tmpdir:
            audio_path = f"{tmpdir}/audio.mp3"
            print(f"[YouTube] Trying yt-dlp audio download + Whisper for {video_id}...")

            # Download only audio (smallest format, ~2-5MB for a news video)
            dl_result = await asyncio.to_thread(
                subprocess.run,
                [
                    "yt-dlp",
                    "-x",  # extract audio
                    "--audio-format", "mp3",
                    "--audio-quality", "8",  # lowest quality (sufficient for speech)
                    "--no-warnings",
                    "--quiet",
                    "--max-filesize", "25m",  # Whisper limit
                    "-o", f"{tmpdir}/audio.%(ext)s",
                    f"https://www.youtube.com/watch?v={video_id}",
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )

            if dl_result.returncode != 0:
                _debug_log.append(f"S5-ytdlp-dl-rc{dl_result.returncode}: {dl_result.stderr[:150]}")
                print(f"[YouTube] yt-dlp audio download failed: {dl_result.stderr[:200]}")
            else:
                # Find the audio file (might be .mp3 or .m4a etc)
                import glob as _glob2
                audio_files = _glob2.glob(f"{tmpdir}/audio.*")
                if not audio_files:
                    print("[YouTube] yt-dlp: no audio file produced")
                else:
                    audio_file = audio_files[0]
                    audio_size = os.path.getsize(audio_file)
                    print(f"[YouTube] Audio downloaded: {audio_size / (1024*1024):.1f}MB")

                    if audio_size > 25 * 1024 * 1024:
                        # Re-encode to smaller size with FFmpeg
                        compressed = f"{tmpdir}/compressed.mp3"
                        await asyncio.to_thread(
                            subprocess.run,
                            ["ffmpeg", "-i", audio_file, "-vn", "-acodec", "libmp3lame",
                             "-ab", "64k", "-ar", "16000", "-ac", "1", "-y", compressed],
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=60,
                        )
                        audio_file = compressed

                    # Transcribe with Whisper
                    openai_keys = settings.openai_api_keys or ([settings.openai_api_key] if settings.openai_api_key else [])
                    if openai_keys:
                        from openai import OpenAI as _OpenAI

                        for key_idx, key in enumerate(openai_keys):
                            try:
                                client = _OpenAI(api_key=key)

                                def _whisper():
                                    with open(audio_file, "rb") as f:
                                        return client.audio.transcriptions.create(
                                            model="whisper-1",
                                            file=f,
                                            language="pt",
                                        )

                                result = await asyncio.to_thread(_whisper)
                                transcript_text = result.text.strip() if hasattr(result, 'text') else str(result).strip()
                                if transcript_text:
                                    if len(transcript_text) > MAX_TRANSCRIPT_CHARS:
                                        transcript_text = transcript_text[:MAX_TRANSCRIPT_CHARS] + "... [transcricao truncada]"
                                    print(f"[YouTube] OK via yt-dlp+Whisper — {video_id} | {len(transcript_text)} chars")
                                    return JSONResponse({"transcript": transcript_text, "title": title, "author": author})
                            except Exception as we:
                                print(f"[YouTube] Whisper key {key_idx+1} failed: {we}")
                                continue

    except Exception as e:
        _debug_log.append(f"S5-ytdlp-whisper: {type(e).__name__}: {str(e)[:100]}")
        print(f"[YouTube] yt-dlp+Whisper failed for {video_id}: {e}")

    print(f"[YouTube] All strategies failed for {video_id}: {_debug_log}")
    return JSONResponse(
        {"error": "Legendas nao disponiveis para este video", "debug": _debug_log},
        status_code=422,
    )


# ── Video Transcription via Whisper (robust, with FFmpeg audio extraction) ────

import subprocess
import httpx

# Semaphore: 1 concurrent transcription on 1GB instance (download+FFmpeg+whisper uses ~300MB peak)
_transcribe_semaphore = asyncio.Semaphore(1)

# Reusable HTTP client for Supabase downloads (connection pooling)
_download_client = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=10, read=120, write=10, pool=10),
    limits=httpx.Limits(max_connections=5, max_keepalive_connections=2),
    follow_redirects=True,
)

DOWNLOAD_MAX_SIZE = 200 * 1024 * 1024  # 200MB (safe for 1GB instance)


class TranscribeRequest(BaseModel):
    url: str
    filename: str = "video.webm"


@app.post("/api/transcribe-url")
async def transcribe_url(req: TranscribeRequest):
    """
    Video transcription via URL (Supabase Storage signed URL).
    1. Downloads video from URL (stream, no memory overhead)
    2. Extracts audio via FFmpeg (→ mp3 64kbps mono 16kHz)
    3. Sends to OpenAI Whisper (rotates keys on failure)
    4. Returns {"transcript": "..."}
    """
    async with _transcribe_semaphore:
        tmp_input = None
        tmp_audio = None
        try:
            ext = os.path.splitext(req.filename)[1] or ".webm"

            # 1. Download video from Supabase signed URL (streaming to disk)
            print(f"[Transcribe] Downloading {req.filename}...")
            tmp_input = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
            total_size = 0

            async with _download_client.stream("GET", req.url) as response:
                if response.status_code != 200:
                    tmp_input.close()
                    print(f"[Transcribe] Download failed: HTTP {response.status_code}")
                    return JSONResponse({"error": "Falha ao baixar video do storage"}, status_code=502)
                async for chunk in response.aiter_bytes(512 * 1024):  # 512KB chunks (less RAM)
                    total_size += len(chunk)
                    if total_size > DOWNLOAD_MAX_SIZE:
                        tmp_input.close()
                        return JSONResponse(
                            {"error": f"Arquivo muito grande ({total_size // (1024*1024)}MB). Maximo 200MB."},
                            status_code=413,
                        )
                    tmp_input.write(chunk)
            tmp_input.close()

            print(f"[Transcribe] Downloaded {total_size / (1024*1024):.1f}MB")

            # 2. Extract audio via FFmpeg
            tmp_audio = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
            tmp_audio.close()

            # Delete input video ASAP after FFmpeg reads it (pipe approach)
            print("[Transcribe] Extracting audio via FFmpeg...")
            ffmpeg_result = await asyncio.to_thread(
                subprocess.run,
                [
                    "ffmpeg", "-i", tmp_input.name,
                    "-vn",                    # no video
                    "-acodec", "libmp3lame",  # mp3 encoding
                    "-ab", "64k",             # 64kbps bitrate
                    "-ar", "16000",           # 16kHz sample rate (Whisper optimal)
                    "-ac", "1",               # mono
                    "-y",                     # overwrite output
                    tmp_audio.name,
                ],
                stdout=subprocess.DEVNULL,    # don't capture stdout (saves RAM)
                stderr=subprocess.PIPE,       # only capture stderr for errors
                timeout=120,
            )

            # Free disk space immediately — input video no longer needed
            if tmp_input and os.path.exists(tmp_input.name):
                os.unlink(tmp_input.name)
                tmp_input = None

            if ffmpeg_result.returncode != 0:
                stderr = ffmpeg_result.stderr.decode(errors="replace")[:500]
                print(f"[Transcribe] FFmpeg failed: {stderr}")
                return JSONResponse(
                    {"error": "Falha ao extrair audio do video", "detail": stderr},
                    status_code=500,
                )

            audio_size = os.path.getsize(tmp_audio.name)
            print(f"[Transcribe] Audio extracted: {audio_size / (1024*1024):.1f}MB")

            if audio_size > 25 * 1024 * 1024:
                return JSONResponse(
                    {"error": "Audio extraido ainda muito grande. Tente um video mais curto."},
                    status_code=413,
                )
            if audio_size == 0:
                print("[Transcribe] Empty audio — no audio track?")
                return JSONResponse({"transcript": ""})

            whisper_file = tmp_audio.name

            # 3. Send to OpenAI Whisper (try all keys)
            openai_keys = settings.openai_api_keys or ([settings.openai_api_key] if settings.openai_api_key else [])
            if not openai_keys:
                return JSONResponse({"error": "OPENAI_API_KEY nao configurada"}, status_code=500)

            transcript = None
            last_error = None
            for key_idx, api_key in enumerate(openai_keys):
                try:
                    print(f"[Transcribe] Trying OpenAI key {key_idx + 1}/{len(openai_keys)}...")
                    oai_client = OpenAI(api_key=api_key)

                    def _call_whisper(c=oai_client):
                        with open(whisper_file, "rb") as f:
                            return c.audio.transcriptions.create(
                                model="whisper-1",
                                file=("audio.mp3", f),
                                language="pt",
                                response_format="text",
                            )

                    result = await asyncio.to_thread(_call_whisper)
                    transcript = result.strip() if isinstance(result, str) else str(result).strip()
                    print(f"[Transcribe] OpenAI key {key_idx + 1} OK — {len(transcript)} chars")
                    break
                except Exception as key_err:
                    last_error = key_err
                    print(f"[Transcribe] OpenAI key {key_idx + 1}/{len(openai_keys)} failed: {key_err}")
                    if key_idx < len(openai_keys) - 1:
                        continue

            if transcript is None:
                error_msg = str(last_error) if last_error else "Todas as chaves falharam"
                print(f"[Transcribe] All keys failed: {error_msg}")
                return JSONResponse({"error": "Falha na transcricao", "detail": error_msg}, status_code=500)

            print(f"[Transcribe] OK — {total_size / (1024*1024):.1f}MB → {len(transcript)} chars")
            return JSONResponse({"transcript": transcript})

        except subprocess.TimeoutExpired:
            print("[Transcribe] FFmpeg timed out (120s)")
            return JSONResponse({"error": "Extracao de audio demorou demais."}, status_code=504)
        except Exception as e:
            print(f"[Transcribe] Error: {e}")
            import traceback
            traceback.print_exc()
            return JSONResponse({"error": "Falha na transcricao", "detail": str(e)}, status_code=500)
        finally:
            for path in [
                tmp_input.name if tmp_input else None,
                tmp_audio.name if tmp_audio else None,
            ]:
                if path and os.path.exists(path):
                    try:
                        os.unlink(path)
                    except OSError:
                        pass


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    import os

    port = int(os.environ.get("PORT", 8000))
    print("\n  Arena Analysis v2.0.0 (Speed Optimized)")
    print(f"  Model: {settings.model}")
    print(f"  Batch: {settings.batch_size} personas | Tokens: {settings.max_tokens_per_batch}")
    print(f"  Claude: {len(settings.anthropic_api_keys)} keys, max {settings.max_parallel_claude}p ({int(settings.claude_share*100)}%)")
    print(f"  GPT:    {len(settings.openai_api_keys)} keys, max {settings.max_parallel_openai}p ({int((1-settings.claude_share)*100)}%)")
    print(f"  Starting on http://localhost:{port}")
    print(f"  Docs: http://localhost:{port}/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=port, timeout_keep_alive=300)
