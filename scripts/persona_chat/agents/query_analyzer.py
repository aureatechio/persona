"""
Agent 0: Query Analyzer (com Tool Use)
Usa Claude Haiku com tools para decidir INTELIGENTEMENTE se precisa:
- Pesquisar na web
- Que queries fazer
- Se a resposta vai precisar de validacao factual

NAO usa palavras-chave — a IA decide sozinha.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field

import anthropic

from persona_chat.config import settings


@dataclass
class QueryAnalysis:
    needs_web_search: bool = False
    needs_person_search: bool = False
    needs_factual_validation: bool = False
    search_queries: list[str] = field(default_factory=list)
    person_name: str = ""
    bio_queries: list[str] = field(default_factory=list)
    news_queries: list[str] = field(default_factory=list)
    reasoning: str = ""
    is_greeting: bool = False
    prompt_tokens: int = 0
    output_tokens: int = 0


# Tools que a IA pode invocar
ANALYZER_TOOLS = [
    {
        "name": "person_search",
        "description": (
            "Use quando a mensagem pergunta sobre uma PESSOA ESPECIFICA (politico, celebridade, "
            "figura publica). Exemplos: 'quem e o Lula?', 'o que vc acha do Bolsonaro?', "
            "'viu o que o Neymar fez?', 'conhece o Elon Musk?'. "
            "Gera DUAS buscas separadas: uma para BIOGRAFIA (quem e, carreira, posicoes) "
            "e outra para NOTICIAS ATUAIS (o que fez recentemente)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "person_name": {
                    "type": "string",
                    "description": "Nome da pessoa mencionada. Ex: 'Lula', 'Bolsonaro', 'Neymar'.",
                },
                "bio_queries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Queries para BIOGRAFIA da pessoa (1-2). "
                        "Ex: ['Lula presidente Brasil biografia carreira politica', "
                        "'Lula posicionamento politico partido PT']"
                    ),
                },
                "news_queries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Queries para NOTICIAS ATUAIS da pessoa (1-2). "
                        "Ex: ['Lula noticias hoje 2026', 'Lula ultimas decisoes governo 2026']"
                    ),
                },
                "reasoning": {
                    "type": "string",
                    "description": "Breve explicacao de por que a busca e necessaria.",
                },
            },
            "required": ["person_name", "bio_queries", "news_queries", "reasoning"],
        },
    },
    {
        "name": "web_search",
        "description": (
            "Pesquisa GERAL na internet. Use para temas, eventos, dados — mas NAO para "
            "perguntas sobre uma pessoa especifica (use person_search para isso). "
            "Use quando a mensagem menciona noticias, eventos atuais, "
            "precos, dados economicos, ou qualquer coisa que precise de informacao "
            "atualizada e verificavel. Tambem use quando a pessoa pergunta 'como voce ta' "
            "para buscar contexto da cidade da persona."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "queries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Lista de queries de busca (1-3). Cada query deve ser especifica "
                        "e incluir contexto geografico quando relevante. "
                        "Ex: ['prefeito de Salvador 2026', 'Bruno Reis Salvador noticias']"
                    ),
                },
                "needs_fact_check": {
                    "type": "boolean",
                    "description": (
                        "True se a resposta da persona vai conter FATOS verificaveis "
                        "(nomes de politicos, cargos, datas, numeros, eventos). "
                        "False se e apenas opiniao, saudacao ou conversa casual."
                    ),
                },
                "reasoning": {
                    "type": "string",
                    "description": "Breve explicacao de por que a busca e necessaria.",
                },
            },
            "required": ["queries", "needs_fact_check", "reasoning"],
        },
    },
    {
        "name": "no_search_needed",
        "description": (
            "Use quando NAO precisa pesquisar na internet. "
            "Para perguntas pessoais (sua idade, onde mora, o que faz), "
            "saudacoes simples (oi, ola), ou conversas que nao envolvem "
            "fatos verificaveis do mundo real."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "is_greeting": {
                    "type": "boolean",
                    "description": "True se e uma saudacao simples (oi, ola, e ai).",
                },
                "reasoning": {
                    "type": "string",
                    "description": "Breve explicacao de por que nao precisa buscar.",
                },
            },
            "required": ["is_greeting", "reasoning"],
        },
    },
]


class QueryAnalyzer:
    """Analisa a mensagem usando IA com tool calling."""

    def __init__(self):
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def analyze(
        self,
        message: str,
        persona_city: str = "",
        persona_state: str = "",
        persona_age: int = 0,
    ) -> QueryAnalysis:
        """
        Analisa a mensagem do usuario e decide se precisa de web search.
        Usa Claude Haiku com tool use para decisao inteligente.
        """
        result = QueryAnalysis()

        system_prompt = (
            "Voce e um classificador de mensagens. "
            "Sua funcao e decidir se uma mensagem precisa de pesquisa na internet "
            "para ser respondida corretamente por uma persona sintetica. "
            f"A persona mora em {persona_city}/{persona_state} e tem {persona_age} anos. "
            "Analise a mensagem e use a tool adequada."
        )

        user_prompt = (
            f"Mensagem recebida pela persona de {persona_city}/{persona_state}: "
            f'"{message}"\n\n'
            "Decida: precisa pesquisar na internet para responder, ou nao?"
        )

        try:
            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.messages.create(
                    model=settings.validator_model,  # Haiku — rapido e barato
                    max_tokens=300,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                    tools=ANALYZER_TOOLS,
                    tool_choice={"type": "any"},
                    temperature=0.0,
                ),
            )

            result.prompt_tokens = response.usage.input_tokens
            result.output_tokens = response.usage.output_tokens

            # Processa tool calls
            for block in response.content:
                if block.type == "tool_use":
                    if block.name == "person_search":
                        result.needs_person_search = True
                        result.needs_web_search = True
                        result.needs_factual_validation = True
                        result.person_name = block.input.get("person_name", "")
                        result.bio_queries = block.input.get("bio_queries", [])
                        result.news_queries = block.input.get("news_queries", [])
                        result.search_queries = result.bio_queries + result.news_queries
                        result.reasoning = block.input.get("reasoning", "")

                    elif block.name == "web_search":
                        result.needs_web_search = True
                        result.search_queries = block.input.get("queries", [])
                        result.needs_factual_validation = block.input.get("needs_fact_check", False)
                        result.reasoning = block.input.get("reasoning", "")

                    elif block.name == "no_search_needed":
                        result.needs_web_search = False
                        result.is_greeting = block.input.get("is_greeting", False)
                        result.reasoning = block.input.get("reasoning", "")

            return result

        except Exception as e:
            print(f"[QueryAnalyzer] Erro na analise (fallback sem busca): {e}")
            return result
