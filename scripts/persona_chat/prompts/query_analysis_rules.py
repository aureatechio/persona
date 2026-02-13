"""
Regras locais (sem LLM) para classificacao de queries.
Detecta entidades, topicos e decide se precisa de web search.
"""
from __future__ import annotations

import re
import unicodedata


def _normalize(text: str) -> str:
    """Remove acentos e converte para minusculo."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


# Politicos brasileiros (nomes e apelidos comuns)
POLITICIANS = [
    "lula", "bolsonaro", "jair", "dilma", "temer", "fhc", "fernando henrique",
    "collor", "itamar", "sarney", "lula da silva", "boulos", "pablo marcal",
    "pablo marçal", "marcal", "marçal", "haddad", "ciro", "ciro gomes",
    "marina silva", "tabata amaral", "tabata", "joao campos", "joão campos",
    "eduardo paes", "doria", "joao doria", "tarcisio", "tarcísio",
    "ricardo nunes", "guilherme boulos", "lira", "arthur lira", "pacheco",
    "rodrigo pacheco", "flavio dino", "flávio dino", "zanin",
    "alexandre de moraes", "moraes", "xandao", "xandão", "barroso",
    "moro", "sergio moro", "sérgio moro", "janones", "nikolas ferreira",
    "nikolas", "carla zambelli", "zambelli", "damares", "simone tebet",
    "tebet", "gleisi", "gleisi hoffmann", "lewandowski", "ratinho jr",
    "zema", "romeu zema", "helder barbalho", "renan filho",
    "ronaldo caiado", "caiado", "eduardo leite", "marconi perillo",
    "aldo rebelo", "luciano hang", "hang", "elon musk", "trump", "biden",
    "milei", "maduro", "putin", "zelensky",
]

# Partidos politicos
PARTIES = [
    "pt", "psl", "pl", "mdb", "psdb", "pode", "podemos", "psol",
    "pdt", "dem", "novo", "uniao brasil", "pp", "psd", "republicanos",
    "avante", "solidariedade", "pcb", "pcdob", "rede", "patriota",
]

# Perguntas factuais que EXIGEM dados corretos da web
FACTUAL_TRIGGERS = [
    "quem e o prefeito", "quem é o prefeito", "quem eh o prefeito",
    "quem e o governador", "quem é o governador", "quem eh o governador",
    "quem e o presidente", "quem é o presidente",
    "quem e o vereador", "quem é o vereador",
    "quem e o deputado", "quem é o deputado",
    "quem e o senador", "quem é o senador",
    "quem e o ministro", "quem é o ministro",
    "quem e o secretario", "quem é o secretário",
    "quem ganhou", "quem venceu", "quem foi eleito",
    "de que partido", "qual o partido",
    "quando foi", "quando aconteceu", "que dia foi",
    "quantos habitantes", "populacao de", "população de",
    "capital de", "capital do",
    "prefeito de", "governador de", "governador do",
    "que time", "qual o time",
    "quem manda", "quem governa", "quem ta no poder",
    "quem morreu", "o que houve com",
]

# Termos que indicam assuntos atuais/noticias
NEWS_TRIGGERS = [
    "noticia", "aconteceu", "acontecendo", "hoje", "ontem", "recentemente",
    "essa semana", "esse mes", "ultimamente", "atualmente", "agora",
    "vi no jornal", "vi na tv", "li que", "soube que", "ouvi dizer",
    "ta rolando", "esta acontecendo", "novidade", "ultimo",
    "votacao", "eleicao", "eleição", "votou", "aprovaram", "aprovação",
    "congresso", "senado", "camara", "stf", "supremo", "planalto",
    "ministerio", "ministério", "reforma", "lei", "projeto de lei",
    "pec", "mp ", "medida provisoria",
]

# Termos que indicam necessidade de dados atualizados
DATA_TRIGGERS = [
    "quanto custa", "preco", "preço", "salario minimo", "salário mínimo",
    "inflacao", "inflação", "dolar", "dólar", "selic", "juros",
    "gasolina", "diesel", "gas de cozinha", "gás", "ipca", "pib",
    "desemprego", "taxa", "cotacao", "cotação",
    "resultado", "placar", "jogo", "campeonato",
    "guerra", "conflito", "crise",
]

# Topicos que NAO precisam de web search (perguntas pessoais)
PERSONAL_TRIGGERS = [
    "voce", "você", "vc", "tu ", "tua ", "teu ",
    "sua idade", "quantos anos", "onde mora", "de onde",
    "o que voce faz", "trabalha com", "casado", "solteiro",
    "gosta de", "prefere", "favorito", "time",
    "nome", "como se chama",
]

# Saudacoes e perguntas casuais que se beneficiam de contexto da cidade
GREETING_TRIGGERS = [
    "oi", "ola", "olá", "e ai", "eai", "eae", "opa", "fala",
    "salve", "bom dia", "boa tarde", "boa noite", "buenas",
]

HOWRU_TRIGGERS = [
    "tudo bem", "tudo bom", "como vai", "como voce ta",
    "como vc ta", "como tu ta", "como esta", "como ce ta",
    "como voce esta", "tranquilo", "de boa", "suave",
    "beleza", "firmeza", "tudo certo", "como anda",
]


class QueryAnalysis:
    def __init__(self):
        self.needs_web_search: bool = False
        self.needs_factual_validation: bool = False
        self.entities: list[str] = []
        self.topics: list[str] = []
        self.search_queries: list[str] = []
        self.is_personal_question: bool = False
        self.is_opinion_question: bool = False
        self.is_factual_question: bool = False
        self.is_greeting: bool = False
        self.is_howru: bool = False


def analyze_query(message: str, persona_city: str = "", persona_state: str = "") -> QueryAnalysis:
    """
    Analisa a mensagem do usuario e decide se precisa de web search.
    Operacao local, sem chamada LLM (~5ms).

    Args:
        message: Mensagem do usuario
        persona_city: Cidade da persona (para buscar contexto local)
        persona_state: Estado da persona
    """
    result = QueryAnalysis()
    normalized = _normalize(message)
    lower = message.lower().strip()

    # 0. Detecta saudacoes e "como vc ta"
    for trigger in GREETING_TRIGGERS:
        if _normalize(trigger) in normalized:
            result.is_greeting = True
            break

    for trigger in HOWRU_TRIGGERS:
        if _normalize(trigger) in normalized:
            result.is_howru = True
            break

    # Se e uma saudacao com "como vc ta" e temos cidade, busca contexto local
    if result.is_howru and persona_city:
        result.needs_web_search = True
        result.topics.append("contexto_local")
        result.search_queries.append(f"{persona_city} {persona_state} notícias hoje 2026")
        result.search_queries.append(f"{persona_city} clima trânsito eventos hoje")
        return result

    # Se e so um "oi" simples sem nada mais (mensagem curta), nao precisa de web search
    if result.is_greeting and len(lower) < 15 and not result.is_howru:
        return result

    # 0.5. Detecta perguntas FACTUAIS (EXIGEM web search + validacao factual)
    for trigger in FACTUAL_TRIGGERS:
        if _normalize(trigger) in normalized:
            result.is_factual_question = True
            result.needs_web_search = True
            result.needs_factual_validation = True
            # Monta query de busca especifica
            result.search_queries.append(f"{lower} {persona_city} {persona_state} 2026")
            if persona_city:
                result.search_queries.append(f"{trigger} {persona_city} 2026")
            break

    # 1. Detecta perguntas pessoais (NAO precisa de web search)
    for trigger in PERSONAL_TRIGGERS:
        if trigger in normalized:
            result.is_personal_question = True
            break

    # 2. Detecta politicos mencionados
    for politician in POLITICIANS:
        pattern = r"\b" + re.escape(_normalize(politician)) + r"\b"
        if re.search(pattern, normalized):
            result.entities.append(politician)

    # 3. Detecta partidos
    for party in PARTIES:
        pattern = r"\b" + re.escape(_normalize(party)) + r"\b"
        if re.search(pattern, normalized):
            result.topics.append(f"partido {party}")

    # 4. Detecta triggers de noticias
    for trigger in NEWS_TRIGGERS:
        if _normalize(trigger) in normalized:
            result.topics.append("noticias_atuais")
            break

    # 5. Detecta triggers de dados atualizados
    for trigger in DATA_TRIGGERS:
        if _normalize(trigger) in normalized:
            result.topics.append("dados_atualizados")
            break

    # 6. Detecta perguntas de opiniao
    opinion_patterns = [
        r"o que (voce|vc|tu) acha",
        r"qual sua opiniao",
        r"qual sua opini[aã]o",
        r"concorda",
        r"a favor",
        r"contra ",
        r"apoia",
        r"votaria",
        r"melhor presidente",
        r"melhor prefeito",
        r"melhor governador",
    ]
    for pattern in opinion_patterns:
        if re.search(pattern, normalized):
            result.is_opinion_question = True
            break

    # 7. Decide se precisa de web search
    # Precisa se: menciona politico + e pergunta de opiniao, OU menciona noticias/dados
    if result.entities and (result.is_opinion_question or "noticias_atuais" in result.topics):
        result.needs_web_search = True
    elif "dados_atualizados" in result.topics:
        result.needs_web_search = True
    elif "noticias_atuais" in result.topics and not result.is_personal_question:
        result.needs_web_search = True
    elif len(result.entities) > 0 and not result.is_personal_question:
        # Mencionou politico, busca contexto
        result.needs_web_search = True

    # 8. Monta queries de busca
    if result.needs_web_search:
        if result.entities:
            for entity in result.entities[:2]:
                result.search_queries.append(f"{entity} Brasil últimas notícias 2026")
            if result.is_opinion_question:
                result.search_queries.append(f"{result.entities[0]} opiniões aprovação rejeição 2026")
        elif "dados_atualizados" in result.topics:
            # Extrai termos relevantes da mensagem
            result.search_queries.append(f"{lower} Brasil 2026")
        else:
            result.search_queries.append(f"{lower} Brasil notícias 2026")

    return result
