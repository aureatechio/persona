"""
Arena Analysis — FastAPI com SSE streaming.

Orquestra o pipeline completo:
  1. Web Research (SEMPRE)
  2. Context Builder (IA cria contexto)
  3. Context Validator (IA verifica)
  4. Persona Loop (processa TODAS em batches)
  5. Results Aggregator (agrega → dashboard)

Uso:
  cd scripts
  uvicorn arena_analysis.main:app --port 8001 --reload
"""
from __future__ import annotations

import json
import time
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from arena_analysis.config import settings
from arena_analysis.web_researcher import ArenaWebResearcher
from arena_analysis.context_builder import ContextBuilder
from arena_analysis.context_validator import ContextValidator
from arena_analysis.persona_loader import load_personas
from arena_analysis.persona_loop import PersonaLoop
from arena_analysis.results_aggregator import aggregate_results

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
context_validator = ContextValidator()
persona_loop = PersonaLoop()


# ── Request Model ─────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    question: str
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
@app.get("/api/arena/health")
async def health():
    return {
        "status": "ok",
        "engine": "arena_analysis",
        "version": "2.0.0",
        "model": settings.model,
        "batch_size": settings.batch_size,
        "max_parallel": settings.max_parallel,
    }


@app.post("/api/arena/analyze")
async def analyze(request: AnalyzeRequest):
    """
    Analisa pergunta com pipeline AI completo.
    Retorna SSE stream com progresso e resultados.
    """

    async def generate():
        start_time = time.time()
        total_tokens = 0

        # ── 1. Web Research (SEMPRE) ──────────────────────────────────
        yield sse_event("phase", {
            "phase": "web_research",
            "message": "Pesquisando contexto na web...",
        })

        web_result = await web_researcher.research(request.question)
        total_tokens += 0  # Tavily nao usa tokens LLM

        yield sse_event("web_complete", {
            "snippets_count": len(web_result.snippets),
            "sources_count": len(web_result.sources),
            "has_context": bool(web_result.combined_context),
        })

        # ── 2. Context Builder ────────────────────────────────────────
        yield sse_event("phase", {
            "phase": "building_context",
            "message": "Criando contexto com IA...",
        })

        context = await context_builder.build(
            question=request.question,
            web_context=web_result.combined_context,
        )
        total_tokens += context.prompt_tokens + context.output_tokens

        yield sse_event("context", {
            "tema": context.tema,
            "contexto": context.contexto[:500],  # Preview
            "figuras": context.figuras,
            "periodo": context.periodo,
        })

        # ── 3. Context Validator ──────────────────────────────────────
        yield sse_event("phase", {
            "phase": "validating_context",
            "message": "Verificando precisão do contexto...",
        })

        validation = await context_validator.validate(
            question=request.question,
            context=context,
            web_context=web_result.combined_context,
        )
        total_tokens += validation.prompt_tokens + validation.output_tokens

        # Se REVISE, roda context_builder de novo com feedback
        if validation.verdict == "REVISE" and validation.corrections:
            yield sse_event("phase", {
                "phase": "rebuilding_context",
                "message": "Corrigindo contexto...",
            })

            context = await context_builder.build(
                question=request.question,
                web_context=web_result.combined_context,
                feedback=validation.corrections,
            )
            total_tokens += context.prompt_tokens + context.output_tokens

            yield sse_event("context", {
                "tema": context.tema,
                "contexto": context.contexto[:500],
                "figuras": context.figuras,
                "periodo": context.periodo,
            })

        yield sse_event("validation", {
            "verdict": validation.verdict,
            "issues": validation.issues,
        })

        # ── 4. Carregar Personas ──────────────────────────────────────
        yield sse_event("phase", {
            "phase": "loading_personas",
            "message": "Carregando personas...",
        })

        personas = load_personas(cluster_filter=request.cluster_filter)
        total_personas = len(personas)

        yield sse_event("personas_loaded", {
            "count": total_personas,
            "cluster_filter": request.cluster_filter,
        })

        # ── 5. Persona Loop ──────────────────────────────────────────
        yield sse_event("phase", {
            "phase": "processing_personas",
            "message": f"Processando {total_personas} personas com IA...",
        })

        all_results = []

        async for progress in persona_loop.run(request.question, context, personas):
            all_results.extend(progress.results)

            yield sse_event("progress", {
                "processed": progress.processed,
                "total": progress.total,
                "positive": progress.positive,
                "negative": progress.negative,
                "neutral": progress.neutral,
            })

        # ── 6. Aggregate Results ──────────────────────────────────────
        yield sse_event("phase", {
            "phase": "aggregating",
            "message": "Compilando resultados...",
        })

        processing_time = (time.time() - start_time) * 1000
        final_results = aggregate_results(personas, all_results, request.question)
        final_results["processingTime"] = processing_time

        yield sse_event("results", final_results)

        # ── 7. Done ──────────────────────────────────────────────────
        yield sse_event("done", {
            "processing_time_ms": processing_time,
            "total_personas": total_personas,
            "total_comments": len(final_results.get("comments", [])),
            "total_tokens": total_tokens,
        })

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    print("\n  Arena Analysis v2.0.0")
    print(f"  Model: {settings.model}")
    print(f"  Batch: {settings.batch_size} personas × {settings.max_parallel} parallel")
    print("  Starting on http://localhost:8001")
    print("  Docs: http://localhost:8001/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=3002)
