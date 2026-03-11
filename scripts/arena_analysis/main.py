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
from arena_analysis.query_analyzer import QueryAnalyzer
from arena_analysis.web_researcher import ArenaWebResearcher
from arena_analysis.context_builder import ContextBuilder, ContextResult
from arena_analysis.context_validator import ContextValidator
from arena_analysis.persona_loader import load_personas
from arena_analysis.persona_loop import PersonaLoop
from arena_analysis.results_aggregator import aggregate_results
from arena_analysis.electoral_engine import ElectoralEngine

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
query_analyzer = QueryAnalyzer()
web_researcher = ArenaWebResearcher()
context_builder = ContextBuilder()
context_validator = ContextValidator()
persona_loop = PersonaLoop()
electoral_engine = ElectoralEngine()


# ── Request Models ────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    question: str
    cluster_filter: Optional[str] = None
    context_text: Optional[str] = None
    verbose: bool = False


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
    """Pre-warm: carrega personas no cache para eliminar latencia do primeiro request."""
    print("[Startup] Pre-warming persona cache...")
    await asyncio.to_thread(load_personas)
    print(f"[Startup] Cache pronto | Claude keys: {len(settings.anthropic_api_keys)} | GPT keys: {len(settings.openai_api_keys)}")


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


@app.post("/api/arena/analyze")
async def analyze(request: AnalyzeRequest):
    """
    Analisa pergunta com pipeline AI completo.
    Retorna SSE stream com progresso e resultados.
    """

    async def generate():
        start_time = time.time()
        total_tokens = 0

        # ── 0. Route event ────────────────────────────────────────
        yield sse_event("route", {"route": "python"})

        # ── 1. Query Analysis + Persona Loading em paralelo ────────
        yield sse_event("phase", {
            "phase": "analyzing_query",
            "message": "Analisando pergunta...",
        })

        # Inicia carregamento de personas em paralelo com query analysis
        persona_task = asyncio.create_task(
            asyncio.to_thread(load_personas, cluster_filter=request.cluster_filter)
        )

        analysis = await query_analyzer.analyze(request.question)
        context = None

        if request.verbose:
            yield sse_event("log", {
                "step": "query_analyzer",
                "level": "info",
                "message": f"research={'yes' if analysis.needs_research else 'no'}: {analysis.reason}",
                "detail": {
                    "needs_research": analysis.needs_research,
                    "reason": analysis.reason,
                },
            })

        # Se já temos contexto da mídia (imagem/arquivo analisado), usar diretamente
        if request.context_text:
            context = ContextResult(
                tema="Conteúdo de mídia analisado",
                contexto=request.context_text,
            )
            print(f"[Pipeline] Contexto de mídia recebido ({len(request.context_text)} chars)")

            # Web research complementar se o query analyzer achar necessário
            if analysis.needs_research:
                yield sse_event("phase", {
                    "phase": "web_research",
                    "message": "Pesquisando contexto complementar na web...",
                })
                web_result = await web_researcher.research(request.question)
                if web_result.combined_context:
                    context.contexto += f"\n\n--- Contexto web complementar ---\n{web_result.combined_context[:500]}"

        elif analysis.needs_research:
            # ── 1b. Web Research ─────────────────────────────────────
            yield sse_event("phase", {
                "phase": "web_research",
                "message": "Pesquisando contexto na web...",
            })

            web_result = await web_researcher.research(request.question)

            yield sse_event("web_complete", {
                "snippets_count": len(web_result.snippets),
                "sources_count": len(web_result.sources),
            })

            if request.verbose:
                yield sse_event("log", {
                    "step": "web_research",
                    "level": "info",
                    "message": f"{len(web_result.snippets)} snippets found",
                    "detail": {
                        "queries": web_result.queries,
                        "snippets": [s[:300] for s in web_result.snippets],
                        "sources": web_result.sources,
                    },
                })

            # ── 1c. Context Builder ──────────────────────────────────
            yield sse_event("phase", {
                "phase": "building_context",
                "message": "Criando contexto com IA...",
            })

            context = await context_builder.build(
                question=request.question,
                web_context=web_result.combined_context,
            )
            total_tokens += context.prompt_tokens + context.output_tokens

            if request.verbose:
                yield sse_event("log", {
                    "step": "context_builder",
                    "level": "info",
                    "message": "Context built",
                    "detail": {
                        "tema": context.tema,
                        "contexto": context.contexto,
                        "figuras": context.figuras,
                        "periodo": context.periodo,
                    },
                })

            # ── 1d. Context Validator (skip para velocidade) ─────────
            validation = await context_validator.validate(
                question=request.question,
                context=context,
                web_context=web_result.combined_context,
            )
            total_tokens += validation.prompt_tokens + validation.output_tokens

            if request.verbose:
                yield sse_event("log", {
                    "step": "context_validator",
                    "level": "info",
                    "message": validation.verdict,
                    "detail": {
                        "verdict": validation.verdict,
                        "issues": validation.issues or [],
                        "corrections": validation.corrections or "",
                    },
                })

            if validation.verdict == "REVISE" and validation.corrections:
                context = await context_builder.build(
                    question=request.question,
                    web_context=web_result.combined_context,
                    feedback=validation.corrections,
                )
                total_tokens += context.prompt_tokens + context.output_tokens

                if request.verbose:
                    yield sse_event("log", {
                        "step": "context_builder",
                        "level": "info",
                        "message": "Context revised after validation",
                        "detail": {
                            "tema": context.tema,
                            "contexto": context.contexto,
                            "figuras": context.figuras,
                            "periodo": context.periodo,
                            "revised": True,
                        },
                    })
        else:
            print(f"[Pipeline] Pesquisa pulada: {analysis.reason}")
            if request.verbose:
                yield sse_event("log", {
                    "step": "query_analyzer",
                    "level": "info",
                    "message": f"Research skipped: {analysis.reason}",
                })

        # ── 2. Aguardar personas (já carregando em paralelo) ──────────
        yield sse_event("phase", {
            "phase": "loading_personas",
            "message": "Carregando personas...",
        })

        personas = await persona_task
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

        async for progress in persona_loop.run(request.question, context, personas, verbose=request.verbose):
            all_results.extend(progress.results)

            yield sse_event("progress", {
                "processed": progress.processed,
                "total": progress.total,
                "positive": progress.positive,
                "negative": progress.negative,
                "neutral": progress.neutral,
            })

            if request.verbose and progress.batch_meta:
                yield sse_event("batch_detail", progress.batch_meta)

        # ── 6. Aggregate Results ──────────────────────────────────────
        yield sse_event("phase", {
            "phase": "aggregating",
            "message": f"Agregando resultados de {total_personas} personas...",
        })

        processing_time = (time.time() - start_time) * 1000

        try:
            final_results = await asyncio.to_thread(
                aggregate_results, personas, all_results, request.question
            )
            final_results["processingTime"] = processing_time
        except Exception as e:
            print(f"[Pipeline] Aggregator error: {e}")
            import traceback
            traceback.print_exc()
            # Fallback: retorna dados mínimos do progress
            pos = sum(1 for r in all_results if r.sentiment == "positive")
            neg = sum(1 for r in all_results if r.sentiment == "negative")
            neu = sum(1 for r in all_results if r.sentiment == "neutral")
            final_results = {
                "total": len(all_results),
                "positive": pos,
                "negative": neg,
                "neutral": neu,
                "processingTime": processing_time,
                "archetypes": [],
                "clusterResults": [],
                "comments": [{"personaName": r.persona_id, "sentiment": r.sentiment, "comment": r.comment, "archetype": "", "age": 0, "location": "", "state": "", "region": "", "generation": ""} for r in all_results],
                "ideologicalPoints": [],
                "quadrants": [],
                "regions": [],
                "generations": [],
                "educationLevels": [],
                "politicalFigures": [],
                "intensityBands": [],
            }

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
            "Transfer-Encoding": "chunked",
        },
    )


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


# ── Video Transcription via Whisper (robust, with FFmpeg audio extraction) ────

import subprocess
from fastapi import UploadFile, File as FastAPIFile

# Semaphore: limit concurrent FFmpeg/Whisper to avoid OOM on 1GB instance
_transcribe_semaphore = asyncio.Semaphore(2)

WHISPER_MAX_SIZE = 24 * 1024 * 1024  # 24MB (safe margin below Whisper's 25MB)
UPLOAD_MAX_SIZE = 500 * 1024 * 1024  # 500MB hard limit


@app.post("/api/transcribe-upload")
async def transcribe_upload(file: UploadFile = FastAPIFile(...)):
    """
    Robust multipart video transcription:
    1. Receives raw video file (no base64 overhead)
    2. If >24MB, extracts audio via FFmpeg (video→mp3 at 64kbps mono 16kHz)
    3. Sends audio to Whisper API
    4. Returns {"transcript": "..."} or {"error": "..."}
    """
    openai_key = settings.openai_api_key
    if not openai_key:
        return JSONResponse({"error": "OPENAI_API_KEY not configured"}, status_code=500)

    async with _transcribe_semaphore:
        tmp_input = None
        tmp_audio = None
        try:
            # Determine extension from filename
            original_name = file.filename or "recording.mp4"
            ext = os.path.splitext(original_name)[1] or ".mp4"

            # Stream-write to temp file (memory-efficient for large files)
            tmp_input = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
            total_size = 0
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > UPLOAD_MAX_SIZE:
                    tmp_input.close()
                    return JSONResponse(
                        {"error": f"Arquivo muito grande ({total_size // (1024*1024)}MB). Maximo 500MB."},
                        status_code=413,
                    )
                tmp_input.write(chunk)
            tmp_input.close()

            print(f"[Transcribe] Received {original_name} ({total_size / (1024*1024):.1f}MB)")

            whisper_file = tmp_input.name
            whisper_name = original_name

            # If file > 24MB, extract audio with FFmpeg
            if total_size > WHISPER_MAX_SIZE:
                print(f"[Transcribe] File too large for Whisper ({total_size / (1024*1024):.1f}MB), extracting audio...")
                tmp_audio = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
                tmp_audio.close()

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
                    capture_output=True,
                    timeout=120,
                )

                if ffmpeg_result.returncode != 0:
                    stderr = ffmpeg_result.stderr.decode(errors="replace")[:500]
                    print(f"[Transcribe] FFmpeg failed: {stderr}")
                    return JSONResponse(
                        {"error": "Falha ao extrair audio do video", "detail": stderr},
                        status_code=500,
                    )

                audio_size = os.path.getsize(tmp_audio.name)
                print(f"[Transcribe] Audio extracted: {audio_size / (1024*1024):.1f}MB (from {total_size / (1024*1024):.1f}MB)")

                if audio_size > 25 * 1024 * 1024:
                    return JSONResponse(
                        {"error": "Audio extraido ainda muito grande. Tente um video mais curto."},
                        status_code=413,
                    )
                if audio_size == 0:
                    print("[Transcribe] Audio extraction produced empty file — no audio track?")
                    return JSONResponse({"transcript": ""})

                whisper_file = tmp_audio.name
                whisper_name = "audio.mp3"

            # Send to Whisper API
            client = OpenAI(api_key=openai_key)

            def _call_whisper():
                with open(whisper_file, "rb") as f:
                    return client.audio.transcriptions.create(
                        model="whisper-1",
                        file=(whisper_name, f),
                        language="pt",
                        response_format="text",
                    )

            result = await asyncio.to_thread(_call_whisper)
            transcript = result.strip() if isinstance(result, str) else str(result).strip()
            print(f"[Transcribe] OK — {total_size / (1024*1024):.1f}MB → {len(transcript)} chars transcript")
            return JSONResponse({"transcript": transcript})

        except subprocess.TimeoutExpired:
            print("[Transcribe] FFmpeg timed out (120s)")
            return JSONResponse({"error": "Extracao de audio demorou demais. Tente um video menor."}, status_code=504)
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
