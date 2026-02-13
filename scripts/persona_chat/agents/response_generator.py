"""
Agent 2: Response Generator
Gera a resposta da persona usando Claude Opus 4.6.
Usa persona JSON + web context + historico de chat.
"""
from __future__ import annotations

from typing import Any

import anthropic

from persona_chat.config import settings
from persona_chat.prompts.persona_system_prompt import build_persona_system_prompt
from persona_chat.agents.web_researcher import WebResearchResult


class ResponseGenerator:
    """Gera respostas encarnando a persona via Claude Opus 4.6."""

    def __init__(self):
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def _build_messages(
        self,
        chat_history: list[dict[str, Any]],
        user_message: str,
        validator_feedback: str | None = None,
    ) -> list[dict[str, str]]:
        """Monta a lista de mensagens para a API."""
        messages: list[dict[str, str]] = []

        # Historico de conversa
        for msg in chat_history:
            role = "assistant" if msg.get("bot_message") else "user"
            content = msg.get("message", "")
            if content:
                messages.append({"role": role, "content": content})

        # Mensagem atual do usuario
        user_content = user_message
        if validator_feedback:
            user_content += (
                f"\n\n[NOTA INTERNA - NAO MOSTRAR: A resposta anterior foi revisada. "
                f"Ajuste: {validator_feedback}]"
            )

        messages.append({"role": "user", "content": user_content})

        # Garante alternancia user/assistant (requisito da API)
        cleaned: list[dict[str, str]] = []
        for msg in messages:
            if cleaned and cleaned[-1]["role"] == msg["role"]:
                cleaned[-1]["content"] += "\n" + msg["content"]
            else:
                cleaned.append(msg)

        # Garante que comeca com "user"
        if cleaned and cleaned[0]["role"] == "assistant":
            cleaned.insert(0, {"role": "user", "content": "[inicio da conversa]"})

        return cleaned

    async def generate(
        self,
        persona: dict[str, Any],
        message: str,
        chat_history: list[dict[str, Any]],
        web_context: WebResearchResult | None = None,
        validator_feedback: str | None = None,
    ) -> tuple[str, str, int, int]:
        """
        Gera resposta da persona.

        Returns:
            tuple: (response_text, thought_text, prompt_tokens, output_tokens)
        """
        # Monta system prompt — com contexto de pessoa separado se disponivel
        web_ctx = None
        person_bio = None
        person_news = None
        person_name = None

        if web_context:
            if web_context.person_bio_context or web_context.person_news_context:
                # Busca de PESSOA: bio e news separados
                person_bio = web_context.person_bio_context
                person_news = web_context.person_news_context
                person_name = web_context.person_name
                # combined_context ainda vai pro factual validator via routes.py
                web_ctx = None  # nao injeta como contexto geral
            else:
                # Busca GERAL
                web_ctx = web_context.combined_context

        system_prompt = build_persona_system_prompt(
            persona,
            web_context=web_ctx,
            person_bio_context=person_bio,
            person_news_context=person_news,
            person_name=person_name,
        )

        # Monta mensagens
        messages = self._build_messages(chat_history, message, validator_feedback)

        # Chama Claude Opus 4.6
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self._client.messages.create(
                model=settings.primary_model,
                max_tokens=300,
                system=system_prompt,
                messages=messages,
                temperature=0.85,
            ),
        )

        # Extrai resposta
        response_text = ""
        for block in response.content:
            if block.type == "text":
                response_text += block.text

        # Token usage (real, do response object)
        prompt_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens

        # Thought: o que influenciou a resposta
        thought_parts = []
        if web_context and web_context.snippets:
            thought_parts.append(f"Pesquisa web: {web_context.query}")
        if validator_feedback:
            thought_parts.append(f"Ajustado pelo validador: {validator_feedback[:100]}")

        thought = " | ".join(thought_parts) if thought_parts else ""

        return response_text, thought, prompt_tokens, output_tokens
