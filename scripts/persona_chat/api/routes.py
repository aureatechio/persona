"""
Endpoints da API — Orquestracao completa do pipeline multi-agente.

Pipeline (3 IAs):
  1. Request Handler → busca persona + historico do Supabase
  2. Query Analyzer → classificacao LOCAL (sem LLM, ~5ms)
  3. Web Researcher → Tavily Search (so se necessario, ~500ms)
  4. IA 1: Response Generator → Claude Opus 4.6 (~2-3s) — gera resposta como persona
  5. IA 2: Factual Validator → Claude Haiku 4.5 (~500ms) — verifica FATOS contra web
  6. IA 3: Persona Validator → Claude Haiku 4.5 (~500ms) — verifica coerencia de persona
  7. Se REVISE → IA 1 roda de novo com correcoes
  8. Response → retorna { response, thought }
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from persona_chat.api.models import ChatRequest, ChatResponse, HealthResponse
from persona_chat.config import settings
from persona_chat.data.persona_repository import get_persona
from persona_chat.data.chat_repository import get_recent_messages
from persona_chat.data.usage_tracker import update_chat_usage, update_user_usage
from persona_chat.agents.query_analyzer import QueryAnalyzer
from persona_chat.agents.web_researcher import WebResearcher
from persona_chat.agents.response_generator import ResponseGenerator
from persona_chat.agents.factual_validator import FactualValidator
from persona_chat.agents.persona_validator import PersonaValidator

router = APIRouter()

# Instancias dos agentes (singleton)
query_analyzer = QueryAnalyzer()
web_researcher = WebResearcher()
response_generator = ResponseGenerator()
factual_validator = FactualValidator()
persona_validator = PersonaValidator()


@router.get("/api/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse()


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Endpoint principal de chat — substitui o webhook n8n.
    Compativel com o frontend existente.

    Pipeline de 3 IAs:
      IA 1 (Opus 4.6): gera resposta encarnando a persona
      IA 2 (Haiku 4.5): verifica se fatos estao corretos (prefeito, governador, etc.)
      IA 3 (Haiku 4.5): verifica coerencia com persona (idade, escolaridade, regiao)
    """

    # ── 1. Busca persona do Supabase (com cache) ──
    persona = get_persona(request.persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona nao encontrada")

    persona_city = persona.get("city", "")
    persona_state = persona.get("state", "")

    # ── 2. Busca historico de mensagens ──
    chat_history = get_recent_messages(request.chat_id)
    print(f"[Pipeline] Chat history: {len(chat_history)} mensagens no chat {request.chat_id[:8]}...")

    # ── 3. IA 0: Analisa a query (Claude Haiku com tool use, ~300ms) ──
    analysis = await query_analyzer.analyze(
        request.message,
        persona_city=persona_city,
        persona_state=persona_state,
        persona_age=persona.get("age", 0),
    )
    if analysis.reasoning:
        print(f"[Pipeline] Analyzer: {analysis.reasoning}")

    # ── 4. Web research (condicional, ~500ms) ──
    web_context = None
    if analysis.needs_person_search and analysis.person_name:
        # Busca SEPARADA: biografia + noticias da pessoa
        try:
            web_context = await web_researcher.research_person(
                person_name=analysis.person_name,
                bio_queries=analysis.bio_queries,
                news_queries=analysis.news_queries,
            )
            print(f"[Pipeline] Person search: {analysis.person_name} "
                  f"(bio: {len(analysis.bio_queries)} queries, news: {len(analysis.news_queries)} queries)")
        except Exception as e:
            print(f"[Pipeline] Person search falhou (continuando sem): {e}")
            web_context = None
    elif analysis.needs_web_search and analysis.search_queries:
        # Busca GERAL na web
        try:
            web_context = await web_researcher.research(analysis.search_queries)
        except Exception as e:
            print(f"[Pipeline] Web search falhou (continuando sem): {e}")
            web_context = None

    # ── 5. IA 1: Gera resposta (Claude Opus 4.6, ~2-3s) ──
    response_text, thought, gen_prompt_tokens, gen_output_tokens = (
        await response_generator.generate(
            persona=persona,
            message=request.message,
            chat_history=chat_history,
            web_context=web_context,
        )
    )

    total_prompt_tokens = gen_prompt_tokens + analysis.prompt_tokens
    total_output_tokens = gen_output_tokens + analysis.output_tokens
    validation_passed = True
    all_feedback: list[str] = []

    # ── 6. IA 2: Validacao FACTUAL (Claude Haiku 4.5, ~500ms) ──
    # Roda SEMPRE que tiver dados da web — nao depende do analyzer
    if web_context and web_context.combined_context:
        try:
            factual_result = await factual_validator.validate(
                user_message=request.message,
                generated_response=response_text,
                web_context=web_context.combined_context,
                persona_city=persona_city,
                persona_state=persona_state,
            )
            total_prompt_tokens += factual_result.prompt_tokens
            total_output_tokens += factual_result.output_tokens

            if factual_result.verdict == "REVISE" and factual_result.corrections:
                all_feedback.append(
                    f"ERRO FACTUAL: {'; '.join(factual_result.factual_errors)}. "
                    f"CORRECAO: {factual_result.corrections}"
                )
                print(f"[Pipeline] Factual REVISE: {factual_result.factual_errors}")

        except Exception as e:
            print(f"[Pipeline] Validacao factual falhou (continuando sem): {e}")

    # ── 7. IA 3: Validacao de PERSONA (Claude Haiku 4.5, ~500ms) ──
    try:
        persona_result = await persona_validator.validate(
            persona=persona,
            user_message=request.message,
            generated_response=response_text,
        )
        total_prompt_tokens += persona_result.prompt_tokens
        total_output_tokens += persona_result.output_tokens

        if persona_result.verdict == "REVISE" and persona_result.suggestions:
            all_feedback.append(
                f"PERSONA INCOERENTE: {'; '.join(persona_result.issues)}. "
                f"AJUSTE: {persona_result.suggestions}"
            )
            print(f"[Pipeline] Persona REVISE: {persona_result.issues}")

        if persona_result.verdict == "BLOCK":
            validation_passed = False

    except Exception as e:
        print(f"[Pipeline] Validacao persona falhou (continuando sem): {e}")

    # ── 8. Se algum validador pediu REVISE, roda IA 1 de novo com feedback ──
    if all_feedback and settings.max_retries_on_validation_fail > 0:
        combined_feedback = "\n".join(all_feedback)
        response_text, thought_retry, retry_prompt, retry_output = (
            await response_generator.generate(
                persona=persona,
                message=request.message,
                chat_history=chat_history,
                web_context=web_context,
                validator_feedback=combined_feedback,
            )
        )
        total_prompt_tokens += retry_prompt
        total_output_tokens += retry_output

        if thought_retry:
            thought = (thought + " | " + thought_retry) if thought else thought_retry

    # ── 9. Atualiza uso de tokens ──
    try:
        update_chat_usage(request.chat_id, total_prompt_tokens, total_output_tokens)
        update_user_usage(request.user_id, total_prompt_tokens, total_output_tokens)
    except Exception as e:
        print(f"[Pipeline] Erro ao atualizar tokens (nao-bloqueante): {e}")

    # ── 10. Retorna resposta ──
    return ChatResponse(
        response=response_text,
        thought=thought if thought else None,
        tokens_used=total_prompt_tokens + total_output_tokens,
        web_search_used=web_context is not None and bool(web_context.snippets),
        validation_passed=validation_passed,
    )
